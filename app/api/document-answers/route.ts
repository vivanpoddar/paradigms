import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { fileName, response, tooltipId, metadata } = await request.json()

    if (!fileName || !response || !tooltipId) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, response, tooltipId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // First, delete any existing answers for this tooltip
    const { error: deleteError } = await supabase
      .from('document_answers')
      .delete()
      .eq('user_id', user.id)
      .eq('file_name', fileName)
      .eq('tooltip_id', tooltipId)

    if (deleteError) {
      console.error('Error deleting previous answers:', deleteError)
      // Continue with insertion even if delete fails
    }

    // Save answer to document_answers table
    const { data, error } = await supabase
      .from('document_answers')
      .insert([
        {
          user_id: user.id,
          file_name: fileName,
          response: response,
          tooltip_id: tooltipId,
          metadata: metadata || {}
        }
      ])

    if (error) {
      console.error('Error saving document answer:', error)
      return NextResponse.json(
        { error: `Failed to save answer: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Answer saved successfully', data },
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
    const fileName = searchParams.get('fileName')
    const tooltipId = searchParams.get('tooltipId')

    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Build query
    let query = supabase
      .from('document_answers')
      .select('*')
      .eq('user_id', user.id)
      .order('id', { ascending: false })

    // Add filters if provided
    if (fileName) {
      query = query.eq('file_name', fileName)
    }
    if (tooltipId) {
      query = query.eq('tooltip_id', tooltipId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching document answers:', error)
      return NextResponse.json(
        { error: `Failed to fetch answers: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { answers: data },
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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName')
    const tooltipId = searchParams.get('tooltipId')

    if (!fileName || !tooltipId) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileName and tooltipId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Delete answers for the specific tooltip
    const { error } = await supabase
      .from('document_answers')
      .delete()
      .eq('user_id', user.id)
      .eq('file_name', fileName)
      .eq('tooltip_id', tooltipId)

    if (error) {
      console.error('Error deleting document answers:', error)
      return NextResponse.json(
        { error: `Failed to delete answers: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Answers deleted successfully' },
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
