import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const userId = searchParams.get('userId');
    
    if (!filename || !userId) {
      return NextResponse.json(
        { error: 'Filename and userId parameters are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Fetch annotations from database
    const { data: annotations, error } = await supabase
      .from('annotations')
      .select('*')
      .eq('user_id', userId)
      .eq('document_name', filename)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching annotations:', error);
      return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
    }

    return NextResponse.json(annotations || []);
  } catch (error) {
    console.error('Error in annotations API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      documentName,
      pageNumber,
      x,
      y,
      width,
      height,
      text,
      color = '#fbbf24', // Default yellow color
      type = 'highlight' // Default type
    } = body;

    console.log('POST /api/annotations received:', body);

    if (!userId || !documentName || pageNumber === undefined || x === undefined || y === undefined) {
      console.log('Missing required fields:', { userId, documentName, pageNumber, x, y });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Insert new annotation
    const { data: annotation, error } = await supabase
      .from('annotations')
      .insert({
        user_id: userId,
        document_name: documentName,
        page_number: pageNumber,
        x,
        y,
        width,
        height,
        text,
        color,
        type,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating annotation:', error);
      return NextResponse.json({ error: 'Failed to create annotation', details: error.message }, { status: 500 });
    }

    console.log('Successfully created annotation:', annotation);
    return NextResponse.json(annotation);
  } catch (error) {
    console.error('Error in annotations POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('id');
    const userId = searchParams.get('userId');
    const body = await request.json();
    const { text, color, type } = body;

    if (!annotationId || !userId) {
      return NextResponse.json(
        { error: 'Annotation ID and user ID are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Update annotation (ensure user owns it)
    const { data: annotation, error } = await supabase
      .from('annotations')
      .update({
        text,
        color,
        type,
        updated_at: new Date().toISOString()
      })
      .eq('id', annotationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating annotation:', error);
      return NextResponse.json({ error: 'Failed to update annotation' }, { status: 500 });
    }

    return NextResponse.json(annotation);
  } catch (error) {
    console.error('Error in annotations PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!annotationId || !userId) {
      return NextResponse.json(
        { error: 'Annotation ID and user ID are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Delete annotation (ensure user owns it)
    const { error } = await supabase
      .from('annotations')
      .delete()
      .eq('id', annotationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting annotation:', error);
      return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in annotations DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
