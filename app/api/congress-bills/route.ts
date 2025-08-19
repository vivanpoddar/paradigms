import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    
    const apiKey = process.env.CONGRESS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Congress API key not configured' },
        { status: 500 }
      );
    }
    
    console.log('Fetching Congress bills with limit:', limit);
    
    const response = await fetch(
      `https://api.congress.gov/v3/bill?api_key=${apiKey}&limit=${limit}&sort=updateDate:desc`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Congress API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Congress API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log(`Successfully fetched ${data.bills?.length || 0} bills`);
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching Congress bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Congress bills' },
      { status: 500 }
    );
  }
}
