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

    const answerQuery = async (query: string, fileName: string, messageHistory?: any[]) => {
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

      // Enhanced query with action-oriented instructions and conversation context
      const enhancedQuery = `You are an intelligent assistant that takes action based on user requests. When responding:
1. If the user asks for information, provide comprehensive details with actionable insights
2. If they ask you to analyze, create, or solve something, actively do it
3. If they ask for recommendations, provide specific, actionable advice with steps
4. If they ask you to explain something, provide step-by-step guidance with examples
5. Always be proactive - don't just extract information, provide actionable insights and next steps
6. Consider the conversation history to provide contextually relevant responses

${conversationContext}Current user request: ${query}

Please respond in a helpful, action-oriented manner based on the available context from the file: ${fileName.replace(/\.[^.]+$/, '') + '.txt'} and the conversation history above.`;

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

    const response = await answerQuery(query, fileName, messageHistory);

    console.log('Query response:', response);

    return NextResponse.json({
      query,
      response: response.message.content
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