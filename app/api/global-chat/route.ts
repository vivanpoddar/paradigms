import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  console.log('=== GLOBAL CHAT API CALLED ===');
  try {
    const { query, messageHistory, multiModal = false, images = [] } = await request.json();
    console.log('Received query:', query.substring(0, 100) + '...');
    console.log('Received message history length:', messageHistory?.length || 0);
    console.log('Multi-modal enabled:', multiModal);
    console.log('Images received:', images.length);

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Initialize OpenAI client
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build conversation context from message history
    let conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
    if (messageHistory && messageHistory.length > 0) {
      // Convert message history to OpenAI format, taking last 10 messages for context
      const recentMessages = messageHistory.slice(-10);
      
      for (const msg of recentMessages) {
        const role = msg.user?.name === 'Document Assistant' ? 'assistant' : 'user';
        const content = msg.content.replace(/🤖 \*\*Document Assistant\*\*: /, ''); // Clean assistant prefix
        
        conversationHistory.push({
          role: role as 'user' | 'assistant',
          content: content
        });
      }
    }

    // Prepare the messages array
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a patient and knowledgeable AI tutor assistant. You help students with general questions, homework, and learning concepts across various subjects. 

Your approach:
- Provide clear, step-by-step explanations
- Encourage critical thinking and understanding rather than just giving answers
- Use examples and analogies to clarify complex concepts
- Break down problems into manageable parts
- Ask follow-up questions to ensure understanding

IMPORTANT: When including mathematical expressions in your responses, always use LaTeX syntax (e.g., $x^2 + 1$ for inline math, $$\\frac{a}{b}$$ for display math).

Remember: You're in global chat mode, so you don't have access to specific documents. Base your responses on your general knowledge and the conversation context.`
      },
      ...conversationHistory,
      // Add the current query
      {
        role: "user",
        content: images.length > 0 ? [
          {
            type: "text",
            text: query
          },
          ...images.map((imageBase64: string) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }))
        ] : query
      }
    ];

    console.log('Sending request to OpenAI...');
    
    // Use appropriate model based on whether images are provided
    const model = images.length > 0 ? "gpt-4o" : "gpt-4o-mini";
    
    const stream = await openaiClient.chat.completions.create({
      model: model,
      messages: messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000
    });

    // Create a readable stream for the response
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            
            if (content) {
              const data = JSON.stringify({ content: content, done: false }) + '\n';
              controller.enqueue(new TextEncoder().encode(data));
            }
          }
          
          // Send final chunk to indicate completion
          const finalData = JSON.stringify({ content: '', done: true }) + '\n';
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
