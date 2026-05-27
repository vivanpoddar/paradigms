import { NextRequest, NextResponse } from 'next/server'
import { LlamaCloudIndex, Settings } from "llamaindex";
import { openai } from "@llamaindex/openai";
import OpenAI from 'openai';
import { compactChatHistory, formatChatContextForPrompt, sanitizeChatContent } from '@/lib/chat-context';

const truncateText = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) {
    return value;
  }

  if (maxChars <= 3) {
    return value.slice(0, maxChars);
  }

  return `${value.slice(0, maxChars - 3)}...`;
};

export async function POST(request: NextRequest) {
  console.log('=== QUERY API CALLED ===');
  try {
    const { query, fileName, messageHistory, multiModal = false, images = [], previousResponseId } = await request.json();
    const queryPreview =
      typeof query === 'string'
        ? `${query.substring(0, 100)}...`
        : '[invalid query payload]';
    console.log('Received query:', queryPreview);
    console.log('Received fileName:', fileName);
    console.log('Received message history length:', messageHistory?.length || 0);
    console.log('Multi-modal enabled:', multiModal);
    const normalizedImages: string[] = Array.isArray(images)
      ? images.filter((image: unknown): image is string => typeof image === 'string')
      : [];
    const boundedImages = normalizedImages.slice(0, 3);
    const normalizedPreviousResponseId =
      typeof previousResponseId === 'string' && previousResponseId.trim()
        ? previousResponseId.trim()
        : null;
    console.log('Images received:', boundedImages.length);
    console.log('Images data types:', boundedImages.map((img) => typeof img));
    console.log('First image preview (if any):', boundedImages[0] ? boundedImages[0].substring(0, 50) + '...' : 'No images');
    console.log('Has previousResponseId:', Boolean(normalizedPreviousResponseId));

    const sanitizedQuery = sanitizeChatContent(query);
    if (!sanitizedQuery) {
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

    const compactContext = compactChatHistory(
      Array.isArray(messageHistory) ? messageHistory : [],
      {
        maxRecentTurns: 6,
        maxCharsPerTurn: 450,
        maxSummaryTurns: 8,
        maxSummaryCharsPerTurn: 140,
        maxContextChars: 3200
      }
    );
    const historyContext = formatChatContextForPrompt(compactContext);
    const boundedQuery = truncateText(sanitizedQuery, 3500);

    Settings.llm = openai({
      model: boundedImages.length > 0 ? "gpt-4o" : "gpt-4.1-nano", // Use vision model if images provided
      temperature: 1,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const index = new LlamaCloudIndex({
      name: "cultural-cardinal-2025-10-01",
      projectName: "Default",
      organizationId: "99f533dc-e4b9-4270-b176-6fe3cd20578b",
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    const answerQuery = async (
      queryText: string,
      targetFileName: string,
      conversationContext: string,
      requestImages: string[],
      conversationResponseId: string | null
    ) => {
      const boundedConversationContext = truncateText(conversationContext, 1400);
      const historyContextBlock = boundedConversationContext
        ? `\n\nConversation context:\n${boundedConversationContext}`
        : '';
      const fileNameTxt = targetFileName.replace(/\.[^.]+$/, '') + '.txt';

      // If images are provided, handle vision query differently
      if (requestImages.length > 0) {
        console.log('Processing vision query with', requestImages.length, 'images');
        
        // For vision queries, we'll first get document context, then combine with vision
        const documentQuery = `${queryText}${historyContextBlock}`;

        console.log('Getting document context for vision query...');
        
        // Get document context first
        const documentQueryEngine = index.asQueryEngine({
          similarityTopK: 8,
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
        const documentContext = truncateText(documentResponse.toString(), 6500);
        
        // Now create a vision query directly with OpenAI Responses API
        console.log('Creating vision query with document context...');
        const systemInstructions = `You are a patient and knowledgeable homework tutor. Answer the user's questions based on the provided text and images.

Document Context: ${documentContext}

IMPORTANT: When including mathematical expressions in your responses always use LaTeX syntax.`;

        const inputMessages: OpenAI.Responses.ResponseInput = [];
        if (!conversationResponseId && boundedConversationContext) {
          inputMessages.push({
            role: "developer",
            content: `Conversation summary from older turns:\n${boundedConversationContext}`,
          });
        }

        inputMessages.push({
          role: "user",
          content: [
            {
              type: "input_text",
              text: queryText
            },
            ...requestImages.map(imageBase64 => ({
              type: "input_image" as const,
              image_url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "auto" as const,
            }))
          ]
        });

        // Use OpenAI directly for vision
        const openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        console.log('Sending vision query to OpenAI...');
        const configuredVisionMaxTokens = Number.parseInt(
          process.env.OPENAI_DOC_VISION_MAX_OUTPUT_TOKENS ?? '',
          10
        );
        const visionMaxTokens = Number.isFinite(configuredVisionMaxTokens)
          ? configuredVisionMaxTokens
          : 900;

        const createVisionConversationStream = async (responseId: string | null) => {
          return openaiClient.responses.create({
            model: "gpt-4o",
            instructions: systemInstructions,
            input: inputMessages,
            previous_response_id: responseId ?? undefined,
            stream: true,
            max_output_tokens: visionMaxTokens
          });
        };

        try {
          return await createVisionConversationStream(conversationResponseId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const shouldRetryWithoutPrevious =
            Boolean(conversationResponseId) &&
            /previous_response_id|not found|invalid/i.test(message);

          if (!shouldRetryWithoutPrevious) {
            throw error;
          }

          console.warn('Retrying document vision query without previous_response_id due to invalid conversation state.');
          return createVisionConversationStream(null);
        }
      }

      // Regular document-only query
      const enhancedQuery = `${queryText}${historyContextBlock}`;

      console.log('Creating query engine...');
      console.log('File name for query:', fileNameTxt);
      
      const queryEngine = index.asQueryEngine({
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
        let latestResponseId: string | null = null;
        try {
          const streamingResponse = await answerQuery(
            boundedQuery,
            fileName,
            historyContext,
            boundedImages,
            normalizedPreviousResponseId
          );
          
          // Handle streaming response - streamingResponse is AsyncIterable
          try {
            for await (const chunk of streamingResponse) {
              let text = '';
              
              // Handle OpenAI Responses stream events
              if ('type' in chunk && chunk.type === 'response.output_text.delta') {
                text = chunk.delta || '';
              } else if ('type' in chunk && chunk.type === 'response.completed') {
                latestResponseId = chunk.response.id;
              } else if ('type' in chunk && chunk.type === 'response.failed') {
                const failureMessage =
                  chunk.response.error?.message ||
                  'Model response failed';
                throw new Error(failureMessage);
              } else if ('type' in chunk && chunk.type === 'error') {
                throw new Error(chunk.message || 'Streaming error');
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
          const finalData = JSON.stringify({
            content: '',
            done: true,
            responseId: latestResponseId
          }) + '\n';
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
