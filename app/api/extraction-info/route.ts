import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename parameter is required' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Remove file extension to get base filename
    const filenameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    
    // Construct the extraction filename in bill_info bucket
    const extractionPath = `${user.id}/${filenameWithoutExtension}_extraction.json`;
    
    console.log('Fetching extraction data from:', extractionPath);
    
    // Download the extraction file from Supabase storage
    const { data, error } = await supabase.storage
      .from('bill_info')
      .download(extractionPath);

    if (error) {
      console.error('Error downloading extraction data from Supabase:', error);
      
      // Return empty extraction data if file doesn't exist
      if (error.message?.includes('The resource was not found')) {
        return NextResponse.json({
          message: 'No extraction data found for this document',
          extractionData: null
        });
      }
      
      return NextResponse.json(
        { error: `Failed to download extraction data: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Convert blob to text and parse JSON
    const text = await data.text();
    const extractionData = JSON.parse(text);

    console.log('Successfully fetched extraction data for:', filename);
    
    return NextResponse.json({
      message: 'Extraction data retrieved successfully',
      extractionData,
      path: extractionPath
    });

  } catch (error) {
    console.error('Error fetching extraction data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extraction data' },
      { status: 500 }
    );
  }
}
