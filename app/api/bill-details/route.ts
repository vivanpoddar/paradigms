import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const congress = searchParams.get('congress');
    const type = searchParams.get('type');
    const number = searchParams.get('number');
    
    if (!congress || !type || !number) {
      return NextResponse.json(
        { error: 'Missing required parameters: congress, type, number' },
        { status: 400 }
      );
    }
    
    const apiKey = process.env.CONGRESS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Congress API key not configured' },
        { status: 500 }
      );
    }
    
    console.log(`Fetching bill details for ${congress}/${type}/${number}`);
    
    // First, get the bill details
    const billResponse = await fetch(
      `https://api.congress.gov/v3/bill/${congress}/${type.toLowerCase()}/${number}?api_key=${apiKey}&format=json`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!billResponse.ok) {
      const errorText = await billResponse.text();
      console.error('Congress API error for bill details:', billResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch bill details: ${billResponse.status} ${billResponse.statusText}` },
        { status: billResponse.status }
      );
    }
    
    const billData = await billResponse.json();
    
    // Then, get the text versions to find PDF links
    const textResponse = await fetch(
      `https://api.congress.gov/v3/bill/${congress}/${type.toLowerCase()}/${number}/text?api_key=${apiKey}&format=json`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    let pdfUrl = null;
    if (textResponse.ok) {
      const textData = await textResponse.json();
      // Find the latest version with a PDF
      if (textData.textVersions && textData.textVersions.length > 0) {
        for (const version of textData.textVersions) {
          const pdfFormat = version.formats?.find((format: any) => format.type === 'PDF');
          if (pdfFormat) {
            pdfUrl = pdfFormat.url;
            break; // Use the first (latest) version with PDF
          }
        }
      }
    }
    
    console.log(`Found PDF URL for bill: ${pdfUrl || 'None'}`);
    
    return NextResponse.json({
      bill: billData.bill,
      pdfUrl
    });
    
  } catch (error) {
    console.error('Error fetching bill details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bill details' },
      { status: 500 }
    );
  }
}
