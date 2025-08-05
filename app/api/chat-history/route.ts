import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { userId, query, response, selectedFileName, metadata } = await request.json()

    if (!userId || !query || !response) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, query, response' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Save message to chat_history table
    const { data, error } = await supabase
      .from('chat_history')
      .insert([
        {
          user_id: userId,
          file_name: selectedFileName,
          query: query,
          response: response,
          timestamp: new Date().toISOString(),
          metadata: metadata || {}
        }
      ])

    if (error) {
      console.error('Error saving chat message:', error)
      return NextResponse.json(
        { error: `Failed to save message: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Message saved successfully', data },
      { status: 200 }
    )
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { 
        error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const fileName = searchParams.get('fileName')

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: true })

    // Add fileName filter if provided
    if (fileName) {
      query = query.eq('file_name', fileName)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching chat history:', error)
      return NextResponse.json(
        { error: `Failed to fetch messages: ${error.message}` },
        { status: 500 }
      )
    }

    // Convert database records back to a format suitable for display
    const conversations = data.map((record: any) => ({
      id: record.id,
      userId: record.user_id,
      fileName: record.file_name,
      query: record.query,
      response: record.response,
      timestamp: record.timestamp,
      metadata: record.metadata
    }))

    return NextResponse.json(
      { conversations },
      { status: 200 }
    )
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { 
        error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    )
  }
}
