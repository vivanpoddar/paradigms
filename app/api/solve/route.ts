import { NextRequest, NextResponse } from 'next/server'
import { LlamaCloudIndex, Settings } from "llamaindex";
import { openai } from "@llamaindex/openai";

export async function POST(request: NextRequest) {
  console.log('=== QUERY API CALLED ===');
  try {
    const { query, fileName, messageHistory, multiModal = false } = await request.json();
    console.log('Received query:', query);
    console.log('Received fileName:', fileName);
    console.log('Received message history length:', messageHistory?.length || 0);
    console.log('Multi-modal enabled:', multiModal);

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
      model: "gpt-4.1-mini",
      reasoningEffort: "medium",
      apiKey: process.env.OPENAI_API_KEY,
      maxTokens: 1000,
    });

    const index = new LlamaCloudIndex({
      name: "paradigms",
      projectName: "Default",
      organizationId: "99f533dc-e4b9-4270-b176-6fe3cd20578b",
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    const answerQuery = async (query: string, fileName: string, useChatHistory: boolean, messageHistory?: any[], multiModal?: boolean) => {
      // Build conversation context from message history
      let conversationContext = '';
      if (messageHistory && messageHistory.length > 0) {
        conversationContext = '\n\nConversation History:\n';
        messageHistory.slice(-10).forEach((msg, index) => { // Use last 10 messages for context
          const role = msg.user?.name === 'Document Assistant' ? 'Assistant' : 'User';
          const content = msg.content.replace(/🤖 \*\*Document Assistant\*\*: /, ''); // Clean assistant prefix
          conversationContext += `${role}: ${content}\n`;
        });
        conversationContext += '\n';
      }

      const enhancedQuery = `${query}`

      console.log('Creating query engine...');
      const fileNameTxt = fileName.replace(/\.[^.]+$/, '') + '.txt';
      console.log('File name for query:', fileNameTxt);
      console.log('Multi-modal retrieval:', multiModal);
      
      // Configure query engine based on multi-modal setting
      const queryEngineConfig: any = {
        similarityTopK: 30, // Number of candidates to consider during retrieval
        filters: {
          filters: [
            {
              key: "file_name",
              value: fileNameTxt,
              operator: "text_match"
            }
          ]
        }
      };

      // Add multi-modal retrieval configuration if enabled
      if (multiModal) {
        queryEngineConfig.multiModal = true;
        queryEngineConfig.imageRetrievalTopK = 5; // Number of images to retrieve
        queryEngineConfig.enableImageSearch = true;
        console.log('Multi-modal retrieval enabled with image search');
      }

      const queryEngine = index.asQueryEngine(queryEngineConfig);
      
      console.log('Executing streaming query...');
      const streamingResponse = await queryEngine.query({ 
        query: enhancedQuery,
        stream: true 
      });
      console.log('Query completed successfully');
      return streamingResponse;
    };

    // Create a readable stream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamingResponse = await answerQuery(query, fileName, messageHistory, multiModal);
          
          // Handle streaming response - streamingResponse is AsyncIterable
          try {
            for await (const chunk of streamingResponse) {
              // Extract text content from the chunk
              const text = chunk.message?.content || chunk.toString();
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