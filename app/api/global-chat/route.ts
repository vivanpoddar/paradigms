import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai';
import { compactChatHistory, sanitizeChatContent } from '@/lib/chat-context';

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
  console.log('=== GLOBAL CHAT API CALLED ===');
  try {
    const { query, messageHistory, multiModal = false, images = [], previousResponseId } = await request.json();
    const queryPreview =
      typeof query === 'string'
        ? `${query.substring(0, 100)}...`
        : '[invalid query payload]';
    console.log('Received query:', queryPreview);
    console.log('Received message history length:', messageHistory?.length || 0);
    console.log('Multi-modal enabled:', multiModal);
    const normalizedImages: string[] = Array.isArray(images)
      ? images.filter((image: unknown): image is string => typeof image === 'string')
      : [];
    console.log('Images received:', normalizedImages.length);
    const normalizedPreviousResponseId =
      typeof previousResponseId === 'string' && previousResponseId.trim()
        ? previousResponseId.trim()
        : null;
    console.log('Has previousResponseId:', Boolean(normalizedPreviousResponseId));

    const sanitizedQuery = sanitizeChatContent(query);
    if (!sanitizedQuery) {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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

    const conversationHistorySeed: OpenAI.Responses.EasyInputMessage[] = [];
    if (!normalizedPreviousResponseId && compactContext.summary) {
      conversationHistorySeed.push({
        role: 'developer',
        content: `Conversation summary from older turns:\n${compactContext.summary}`,
      });
    }

    if (!normalizedPreviousResponseId) {
      for (const turn of compactContext.recentTurns) {
        conversationHistorySeed.push({
          role: turn.role,
          content: turn.content,
        });
      }
    }

    const boundedImages = normalizedImages.slice(0, 3);
    const boundedQuery = truncateText(sanitizedQuery, 3500);

    // Use appropriate model based on whether images are provided
    const model = boundedImages.length > 0 ? "gpt-4o" : "gpt-4o-mini";
    const configuredMaxTokens = Number.parseInt(
      process.env.OPENAI_CHAT_MAX_OUTPUT_TOKENS ?? '',
      10
    );
    const maxTokens = Number.isFinite(configuredMaxTokens)
      ? configuredMaxTokens
      : boundedImages.length > 0
        ? 900
        : 700;

    const systemInstructions = `You are a patient and knowledgeable AI tutor assistant. You help students with general questions, homework, and learning concepts across various subjects. 

Your approach:
- Provide clear, step-by-step explanations
- Encourage critical thinking and understanding rather than just giving answers
- Use examples and analogies to clarify complex concepts
- Break down problems into manageable parts
- Ask follow-up questions to ensure understanding

IMPORTANT: When including mathematical expressions in your responses, always use LaTeX syntax (e.g., $x^2 + 1$ for inline math, $$\\frac{a}{b}$$ for display math).

Remember: You're in global chat mode, so you don't have access to specific documents. Base your responses on your general knowledge and the conversation context.`;

    const userInputMessage: OpenAI.Responses.EasyInputMessage =
      boundedImages.length > 0
        ? {
            role: "user",
            content: [
              {
                type: "input_text",
                text: boundedQuery
              },
              ...boundedImages.map((imageBase64: string) => ({
                type: "input_image" as const,
                image_url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "auto" as const,
              }))
            ]
          }
        : {
            role: "user",
            content: boundedQuery,
          };

    const inputMessages: OpenAI.Responses.ResponseInput = [
      ...conversationHistorySeed,
      userInputMessage
    ];

    const createConversationStream = async (conversationResponseId: string | null) => {
      return openaiClient.responses.create({
        model,
        instructions: systemInstructions,
        input: inputMessages,
        previous_response_id: conversationResponseId ?? undefined,
        stream: true,
        temperature: 0.7,
        max_output_tokens: maxTokens,
      });
    };

    let stream: Awaited<ReturnType<typeof createConversationStream>>;
    try {
      stream = await createConversationStream(normalizedPreviousResponseId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetryWithoutPrevious =
        Boolean(normalizedPreviousResponseId) &&
        /previous_response_id|not found|invalid/i.test(message);

      if (!shouldRetryWithoutPrevious) {
        throw error;
      }

      console.warn('Retrying global chat without previous_response_id due to invalid conversation state.');
      stream = await createConversationStream(null);
    }

    console.log('Sending request to OpenAI Responses API...');

    // Create a readable stream for the response
    const readableStream = new ReadableStream({
      async start(controller) {
        let latestResponseId: string | null = null;
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta' && event.delta) {
              const data = JSON.stringify({ content: event.delta, done: false }) + '\n';
              controller.enqueue(new TextEncoder().encode(data));
              continue;
            }

            if (event.type === 'response.completed') {
              latestResponseId = event.response.id;
              continue;
            }

            if (event.type === 'response.failed') {
              const failureMessage =
                event.response.error?.message ||
                'Model response failed';
              throw new Error(failureMessage);
            }

            if (event.type === 'error') {
              throw new Error(event.message || 'Streaming error');
            }
          }

          // Send final chunk to indicate completion
          const finalData = JSON.stringify({
            content: '',
            done: true,
            responseId: latestResponseId,
          }) + '\n';
          controller.enqueue(new TextEncoder().encode(finalData));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            done: true
          }) + '\n';
          controller.enqueue(new TextEncoder().encode(errorData));
          controller.close();
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('=== ERROR IN GLOBAL CHAT ROUTE ===');
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
