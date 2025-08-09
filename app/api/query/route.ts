import { NextRequest, NextResponse } from 'next/server'
import { LlamaCloudIndex, Settings,  } from "llamaindex";
import { gemini, GEMINI_MODEL } from "@llamaindex/google";

export async function POST(request: NextRequest) {
  console.log('=== QUERY API CALLED ===');
  try {
    const { query, fileName, messageHistory } = await request.json();
    console.log('Received query:', query);
    console.log('Received fileName:', fileName);
    console.log('Received message history length:', messageHistory?.length || 0);

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

    Settings.llm = gemini({
      model: GEMINI_MODEL.GEMINI_PRO_FLASH_LATEST,
      temperature: 0.7, // Add some creativity for more actionable responses
    });

    const index = new LlamaCloudIndex({
      name: "paradigms",
      projectName: "Default",
      organizationId: "99f533dc-e4b9-4270-b176-6fe3cd20578b",
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    const answerQuery = async (query: string, fileName: string, useChatHistory: boolean, messageHistory?: any[]) => {
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

      const enhancedQuery = `${query}
      ${useChatHistory ? `If needed, respond based on the available conversation history: ${conversationContext}` : ''}
      `

      console.log('Creating query engine...');
      const fileNameTxt = fileName.replace(/\.[^.]+$/, '') + '.txt';
      console.log('File name for query:', fileNameTxt);
      
      // Only handle OCR-processed documents with .txt extension
      const queryEngine = index.asQueryEngine({
        similarityTopK: 5,
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
      
      console.log('Executing query...');
      const response = await queryEngine.query({ query: enhancedQuery });
      console.log('Query completed successfully');
      return response;
    };

    // Create a readable stream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await answerQuery(query, fileName, messageHistory);
          const content = response.message.content;
          
          // Stream the content in chunks
          const chunkSize = 50; // Adjust chunk size as needed
          for (let i = 0; i < content.length; i += chunkSize) {
            const chunk = content.slice(i, i + chunkSize);
            const data = JSON.stringify({ content: chunk, done: false }) + '\n';
            controller.enqueue(new TextEncoder().encode(data));
            
            // Add a small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
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
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
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