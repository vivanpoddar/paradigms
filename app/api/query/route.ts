import { NextRequest, NextResponse } from 'next/server'
import { LlamaCloudIndex, Settings } from "llamaindex";
import { openai } from "@llamaindex/openai";
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  console.log('=== QUERY API CALLED ===');
  try {
    const { query, fileName, messageHistory, multiModal = false, images = [] } = await request.json();
    console.log('Received query:', query.substring(0, 100) + '...');
    console.log('Received fileName:', fileName);
    console.log('Received message history length:', messageHistory?.length || 0);
    console.log('Multi-modal enabled:', multiModal);
    console.log('Images received:', images.length);
    console.log('Images data types:', images.map((img: any) => typeof img));
    console.log('First image preview (if any):', images[0] ? images[0].substring(0, 50) + '...' : 'No images');

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json(
        { error: 'fileName is required and must be a string' },
        { status: 400 }
      );
    }

    Settings.llm = openai({
      model: images.length > 0 ? "gpt-4o" : "gpt-4.1-nano", // Use vision model if images provided
      temperature: 1,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const index = new LlamaCloudIndex({
      name: "cultural-cardinal-2025-10-01",
      projectName: "Default",
      organizationId: "99f533dc-e4b9-4270-b176-6fe3cd20578b",
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    const answerQuery = async (query: string, fileName: string, useChatHistory: boolean, messageHistory?: any[], multiModal?: boolean, images?: string[]) => {
      // Build conversation context from message history in compact {{user:"..."},{assistant:"..."}} form
      let conversationContext = '';
      if (messageHistory && messageHistory.length > 0) {
        // Use last 10 messages for context, compacted into a single-line representation
        const pairs = messageHistory.slice(-5).map((msg) => {
          const roleKey = msg.user?.name === 'Document Assistant' ? 'assistant' : 'user';
          // Remove assistant prefix, collapse newlines and escape double quotes
          const raw = String(msg.content || '').replace(/🤖 \*\*Document Assistant\*\*: /, '');
          const collapsed = raw.replace(/\s+/g, ' ').trim();
          const escaped = collapsed.replace(/"/g, '\\"');
          return roleKey === 'user' ? `{user:"${escaped}"}` : `{assistant:"${escaped}"}`;
        });

        // Wrap with double braces as requested and join without line breaks
        conversationContext = `{{${pairs.join(',')}}}`;
      }

      // If images are provided, handle vision query differently
      if (images && images.length > 0) {
        console.log('Processing vision query with', images.length, 'images');
        
        // For vision queries, we'll first get document context, then combine with vision
        const documentQuery = `${query}
        ${useChatHistory ? `If needed, respond based on the available conversation history: ${conversationContext}` : ''}`;

        console.log('Getting document context for vision query...');
        
        // Get document context first
        const fileNameTxt = fileName.replace(/\.[^.]+$/, '') + '.txt';
        const documentQueryEngine = index.asQueryEngine({
          similarityTopK: 10,
          filters: {
            filters: [
              {
                key: "file_name",
                value: fileNameTxt,
                operator: "text_match"
              }
            ]
          }
        });
        
        const documentResponse = await documentQueryEngine.query({
          query: documentQuery,
          stream: false
        });
        const documentContext = documentResponse.toString();
        
        // Now create a vision query directly to OpenAI
        console.log('Creating vision query with document context...');
        
        const visionMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          {
            role: "system",
            content: `You are a patient and knowledgeable homework tutor. Answer the user's questions based on the provided text and images.

Document Context: ${documentContext}

${useChatHistory ? `Conversation History: ${conversationContext}` : ''}

IMPORTANT: When including mathematical expressions in your responses always use LaTeX syntax.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: query
              },
              ...images.map(imageBase64 => ({
                type: "image_url" as const,
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }))
            ]
          }
        ];

        // Use OpenAI directly for vision
        const openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        console.log('Sending vision query to OpenAI...');
        const visionResponse = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          messages: visionMessages,
          stream: true
        });

        return visionResponse;
      }

      // Regular document-only query
      const enhancedQuery = `${query}
      ${useChatHistory ? ` ${conversationContext}` : ''}`;

      console.log('Creating query engine...');
      const fileNameTxt = fileName.replace(/\.[^.]+$/, '') + '.txt';
      console.log('File name for query:', fileNameTxt);
      
      const queryEngine = index.asQueryEngine({
        similarityTopK: 30,
        filters: {
          filters: [
            {
              key: "file_name",
              value: fileNameTxt,
              operator: "text_match"
            }
          ]
        }
      });
      
      console.log('enhancedQuery:', enhancedQuery);
      const streamingResponse = await queryEngine.query({
        query: enhancedQuery,
        stream: true 
      });

      console.log(enhancedQuery)
      
      console.log('Query completed successfully');
      return streamingResponse;
    };

    // Create a readable stream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamingResponse = await answerQuery(query, fileName, true, messageHistory, multiModal, images);
          
          // Handle streaming response - streamingResponse is AsyncIterable
          try {
            for await (const chunk of streamingResponse) {
              let text = '';
              
              // Handle different response types
              if ('choices' in chunk && chunk.choices && chunk.choices.length > 0) {
                // OpenAI ChatCompletion chunk
                text = chunk.choices[0]?.delta?.content || '';
              } else if ('message' in chunk) {
                // LlamaIndex EngineResponse
                const messageContent = chunk.message?.content;
                if (typeof messageContent === 'string') {
                  text = messageContent;
                } else {
                  text = chunk.toString();
                }
              } else {
                // Fallback
                text = chunk.toString();
              }
              
              if (text) {
                const data = JSON.stringify({ content: text, done: false }) + '\n';
                controller.enqueue(new TextEncoder().encode(data));
              }
            }
          } catch (streamError) {
            console.warn('Streaming failed, falling back to regular response:', streamError);
            
            // Fallback: try to get the full response
            const content = streamingResponse.toString();
            
            // Stream the content in chunks with delay for better UX
            const chunkSize = 10;
            for (let i = 0; i < content.length; i += chunkSize) {
              const chunk = content.slice(i, i + chunkSize);
              const data = JSON.stringify({ content: chunk, done: false }) + '\n';
              controller.enqueue(new TextEncoder().encode(data));
              
              // Add delay between chunks to simulate streaming
              if (i + chunkSize < content.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            }
          }
          
          // Send final chunk to indicate completion
          const finalData = JSON.stringify({ content: '', done: true }) + '\n';
          controller.enqueue(new TextEncoder().encode(finalData));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = JSON.stringify({ error: error instanceof Error ? error.message : String(error), done: true }) + '\n';
          controller.enqueue(new TextEncoder().encode(errorData));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('=== ERROR IN QUERY ROUTE ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    console.error('=== END ERROR LOG ===');
    
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}