import { NextRequest, NextResponse } from 'next/server'
import { LlamaCloudIndex, Settings,  } from "llamaindex";
import { gemini, GEMINI_MODEL } from "@llamaindex/google";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    Settings.llm = gemini({
      model: GEMINI_MODEL.GEMINI_PRO_FLASH_LATEST,
      temperature: 0.7, // Add some creativity for more actionable responses
    });

    const index = new LlamaCloudIndex({
      name: "dynamic-cuckoo-2025-08-02",
      projectName: "Default",
      organizationId: "99f533dc-e4b9-4270-b176-6fe3cd20578b",
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    const answerQuery = async (query: string) => {
      // Enhanced query with action-oriented instructions
      const enhancedQuery = `You are an intelligent assistant that takes action based on user requests. When responding:
1. If the user asks for information, provide comprehensive details with actionable insights
2. If they ask you to analyze, create, or solve something, actively do it
3. If they ask for recommendations, provide specific, actionable advice with steps
4. If they ask you to explain something, provide step-by-step guidance with examples
5. Always be proactive - don't just extract information, provide actionable insights and next steps

User's request: ${query}

Please respond in a helpful, action-oriented manner based on the available context.`;

      const queryEngine = index.asQueryEngine({
        similarityTopK: 5, // Get more context for better responses
      });
      const response = await queryEngine.query({ query: enhancedQuery });
      return response;
    };

    const response = await answerQuery(query);

    console.log('Query response:', response);

    return NextResponse.json({
      query,
      response: response.message.content
    });
  } catch (error) {
    console.error('Error in query route:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}