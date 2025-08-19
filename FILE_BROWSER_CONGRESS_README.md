# File Browser with Congress Bills Integration

## Overview
The file browser component now features two main sections:
1. **Your Files** - User uploaded documents
2. **Congress Bills** - Latest bills from Congress.gov API with **PDF viewing capability**

## Features

### Files Section
- Upload and manage personal documents
- View PDF files with annotation support
- Download and delete files
- File type icons and size display
- Chat history integration

### Congress Bills Section
- Automatically fetches the latest 50 bills from Congress.gov
- Real-time data from the official Congress.gov API
- **NEW: PDF viewing** - Click on any bill to view the actual PDF document
- Bill metadata including:
  - Bill number and type (HR, S, etc.)
  - Title and description
  - Latest action and date
  - Policy area (if available)
  - Congress session number

## PDF Integration

### Automatic PDF Loading
When a Congress bill is selected:
1. **Fetches bill details** from Congress.gov API
2. **Locates PDF version** of the bill text
3. **Displays PDF** using the same viewer as uploaded files
4. **Supports annotations** on Congress bill PDFs
5. **Fallback to text** if PDF is unavailable

### PDF Sources
- **Enrolled Bills**: Final versions signed into law
- **Engrossed Bills**: Passed by one chamber
- **Introduced Bills**: Original versions as submitted
- **House/Senate Versions**: Chamber-specific versions

## API Integration

### Congress.gov API Endpoints
- **Bills List**: `https://api.congress.gov/v3/bill`
- **Bill Details**: `https://api.congress.gov/v3/bill/{congress}/{type}/{number}`
- **Text Versions**: `https://api.congress.gov/v3/bill/{congress}/{type}/{number}/text`

### Internal API Routes
- **Bills List**: `/api/congress-bills` - Fetches bill summaries
- **Bill Details**: `/api/bill-details` - Gets specific bill with PDF URLs
- **PDF Proxy**: `/api/bill-pdf` - Proxies PDF content from Congress.gov

### Request Flow
```
User clicks bill → /api/bill-details → Congress.gov API → PDF URL → /api/bill-pdf → PDF display
```

## Data Structure

### Congress Bill Object
```typescript
interface CongressBill {
  number: string;           // Bill number (e.g., "1316")
  title: string;           // Full bill title
  congress: number;        // Congress session (e.g., 119)
  type: string;           // Bill type (HR, S, etc.)
  introducedDate: string; // When bill was introduced
  url: string;            // Full API URL for bill details
  latestAction?: {        // Most recent action taken
    actionDate: string;
    text: string;
  };
  policyArea?: string;    // Policy category
  sponsors?: Array<{      // Bill sponsors
    bioguideId: string;
    firstName: string;
    lastName: string;
    party: string;
    state: string;
  }>;
}
```

## Configuration

### Environment Variables
Add to `.env.local`:
```bash
CONGRESS_API_KEY=your_congress_api_key_here
```

### Middleware Configuration
The Congress bills API is excluded from authentication requirements in `middleware.ts`.

## Usage

### Switching Between Sections
Users can toggle between "Your Files" and "Congress Bills" using the tab buttons at the top of the file browser.

### Selecting Items
- **Files**: Click to view content, use buttons to download/delete
- **Bills**: Click to view bill metadata and details

### Refreshing Data
- **Files**: Refresh button reloads user files from Supabase
- **Bills**: Refresh button fetches latest bills from Congress.gov

## Display Features

### Files Section
- File icons based on type (PDF, image, text)
- File size display
- Upload date and metadata
- Action buttons (download, delete)

### Bills Section
- Bill type and number badges
- Truncated title with full text on select
- Latest action date and text
- Policy area tags (when available)
- Congress session indicator

## Error Handling

### API Errors
- Network connectivity issues
- API rate limiting
- Invalid API key
- Server errors

### User Feedback
- Loading states during data fetch
- Error messages with retry options
- Success indicators for actions

## Performance

### Caching
- Bills data is cached in component state
- Refresh button allows manual updates
- No automatic polling (user-initiated only)

### Pagination
- Congress API supports pagination
- Currently shows latest 50 bills
- Could be extended for infinite scroll

## Security

### API Key Protection
- Congress API key stored server-side only
- Never exposed to client
- Proxy through internal API route

### Authentication
- File operations require user authentication
- Congress bills accessible without login
- Proper access control via middleware
