import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const search = searchParams.get('search');
    const congress = searchParams.get('congress');
    const billType = searchParams.get('type');
    const billNumber = searchParams.get('billNumber');
    
    const apiKey = process.env.CONGRESS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Congress API key not configured' },
        { status: 500 }
      );
    }
    
    // Build the API URL based on the search type
    let apiUrl: string;
    
    if (billNumber && billType && congress) {
      // Search for specific bill by number and type
      apiUrl = `https://api.congress.gov/v3/bill/${congress}/${billType}/${billNumber}?api_key=${apiKey}`;
      console.log('Fetching specific bill:', billType.toUpperCase(), billNumber, 'from', congress + 'th Congress');
    } else if (congress && billType && congress !== 'all' && billType !== 'all') {
      // Filter by both congress and bill type
      apiUrl = `https://api.congress.gov/v3/bill/${congress}/${billType}?api_key=${apiKey}&limit=${limit}&sort=updateDate:desc`;
      console.log('Fetching', billType.toUpperCase(), 'bills from', congress + 'th Congress');
    } else if (congress && congress !== 'all') {
      // Filter by congress only
      apiUrl = `https://api.congress.gov/v3/bill/${congress}?api_key=${apiKey}&limit=${limit}&sort=updateDate:desc`;
      console.log('Fetching bills from', congress + 'th Congress');
    } else {
      // General search or no specific filters
      apiUrl = `https://api.congress.gov/v3/bill?api_key=${apiKey}&limit=${limit}&sort=updateDate:desc`;
      
      if (billType && billType !== 'all') {
        // Note: For general search with type filter, we may need to use query parameters
        // since the path-based filtering requires a congress number
        console.log('Fetching', billType.toUpperCase(), 'bills from all sessions');
      } else {
        console.log('Fetching recent bills from all sessions');
      }
    }
    
    // Add search query if provided (works with any endpoint)
    if (search && search.trim() && !billNumber) {
      const encodedSearch = encodeURIComponent(search.trim());
      apiUrl += apiUrl.includes('?') ? `&q=${encodedSearch}` : `?q=${encodedSearch}`;
      console.log('Adding search query:', search);
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Congress API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Congress API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Handle single bill response vs multiple bills response
    if (billNumber && billType) {
      // Single bill response - wrap in bills array format
      if (data.bill) {
        const result = {
          bills: [data.bill],
          pagination: { count: 1 }
        };
        console.log('Successfully fetched specific bill:', data.bill.type?.toUpperCase(), data.bill.number);
        return NextResponse.json(result);
      } else {
        console.log('Bill not found:', billType.toUpperCase(), billNumber);
        return NextResponse.json({ bills: [], pagination: { count: 0 } });
      }
    } else {
      // Multiple bills response
      if (search && search.trim()) {
        console.log(`Successfully found ${data.bills?.length || 0} bills matching "${search}"`);
      } else {
        console.log(`Successfully fetched ${data.bills?.length || 0} bills`);
      }
      return NextResponse.json(data);
    }  } catch (error) {
    console.error('Error fetching Congress bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Congress bills' },
      { status: 500 }
    );
  }
}
