import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pdfUrl = searchParams.get('url');
    
    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'Missing PDF URL parameter' },
        { status: 400 }
      );
    }
    
    // Validate that the URL is from congress.gov
    if (!pdfUrl.includes('congress.gov')) {
      return NextResponse.json(
        { error: 'Invalid PDF URL - must be from congress.gov' },
        { status: 400 }
      );
    }
    
    console.log(`Proxying PDF from: ${pdfUrl}`);
    
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CongressBillViewer/1.0)',
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch PDF:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const pdfBuffer = await response.arrayBuffer();
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('Error proxying PDF:', error);
    return NextResponse.json(
      { error: 'Failed to proxy PDF' },
      { status: 500 }
    );
  }
}
