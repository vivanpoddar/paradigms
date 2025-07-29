import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const userId = searchParams.get('userId');
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename parameter is required' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createClient();
    
    console.log("Before constructing parsedFilename");
    // Construct the parsed filename
    console.log("userid: " + userId);
    const parsedFilename = `${userId}/${filename}_parsed.json`;
    console.log("parsed file: " + parsedFilename)
    
    // Download the parsed file from Supabase storage
    const { data, error } = await supabase.storage
      .from('documents')
      .download(parsedFilename);

    if (error) {
      console.error('Error downloading from Supabase:', error);
      throw error;
    }
    
    // Convert blob to text and parse JSON
    const text = await data.text();
    const parsedData = JSON.parse(text);
    
    // Transform the data from pages.lines.region structure to our expected format
    const boundingBoxes: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      pageNumber: number;
    }> = [];
    
    if (parsedData.pages && Array.isArray(parsedData.pages)) {
      parsedData.pages.forEach((page: any, pageIndex: number) => {
        if (page.lines && Array.isArray(page.lines)) {
          page.lines.forEach((line: any, lineIndex: number) => {
            if ((line.type === 'text' || line.type === 'simple_cell') && line.region) {
              const region = line.region;
              boundingBoxes.push({
                id: region.id || `page-${pageIndex + 1}-line-${lineIndex}`,
                x: region.top_left_x || 0,
                y: region.top_left_y || 0,
                width: region.width || 0,
                height: region.height || 0,
                text: region.text || line.text || `Line ${lineIndex + 1}`,
                pageNumber: pageIndex + 1
              });
            }
          });
        }
      });
    }
    
    return NextResponse.json(boundingBoxes);
  } catch (error) {
    console.error('Error reading bounding boxes from Supabase:', error);
    
    // Return fallback data if file can't be read from Supabase
    const fallbackData = [
      {
        id: "supabase-fallback-1",
        x: 50,
        y: 100,
        width: 200,
        height: 30,
        text: "Supabase Fallback Title",
        pageNumber: 1
      },
      {
        id: "supabase-fallback-2",
        x: 50,
        y: 150,
        width: 300,
        height: 20,
        text: "Could not load parsed file from Supabase storage",
        pageNumber: 1
      },
      {
        id: "supabase-fallback-3",
        x: 50,
        y: 200,
        width: 250,
        height: 18,
        text: "Check that the parsed file exists in documents bucket",
        pageNumber: 1
      }
    ];
    
    return NextResponse.json(fallbackData);
  }
}
