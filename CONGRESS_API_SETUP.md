# Congress.gov API Setup

## Overview
The file browser now includes integration with the Congress.gov API to display recent congressional bills alongside your uploaded files.

## Setup Instructions

### 1. Get a Congress.gov API Key
1. Visit [Congress.gov API Registration](https://api.congress.gov/)
2. Sign up for a free API key
3. Save your API key securely

### 2. Add Environment Variable
Create a `.env.local` file in your project root (if it doesn't exist) and add:

```bash
NEXT_PUBLIC_CONGRESS_API_KEY=your_actual_api_key_here
```

**Important**: Replace `your_actual_api_key_here` with your actual API key from Congress.gov.

### 3. Restart Development Server
After adding the environment variable, restart your development server:

```bash
npm run dev
```

## Features

### Two-Section Browser
- **Your Files**: Upload, view, and manage your documents
- **Congress Bills**: Browse the latest 50 congressional bills

### Bill Information Displayed
- Bill number and type (HR, S, etc.)
- Full title
- Congress session
- Introduction date
- Policy area (when available)
- Sponsor information
- Direct link to full bill text

### Functionality
- **Switch Sections**: Click tabs to switch between files and bills
- **View Bill Details**: Click any bill to see formatted metadata
- **Refresh Data**: Use the refresh button to get latest bills
- **Responsive Design**: Works on mobile and desktop

## API Details

### Endpoint Used
```
GET https://api.congress.gov/v3/bill?api_key={key}&limit=50&sort=introducedDate:desc
```

### Parameters
- `limit=50`: Retrieves the latest 50 bills
- `sort=introducedDate:desc`: Orders by newest first

### Rate Limits
The Congress.gov API has usage limits. See their documentation for current limits.

## Troubleshooting

### "Congress API key not configured" Error
- Ensure you've added `NEXT_PUBLIC_CONGRESS_API_KEY` to `.env.local`
- Restart your development server after adding the environment variable
- Check that your API key is valid

### No Bills Showing
- Check your internet connection
- Verify your API key is correct
- Check browser developer console for error messages
- Try refreshing the bills using the refresh button

### Network Errors
- The Congress.gov API may occasionally be unavailable
- Use the "Try Again" button to retry failed requests
- Check if the API is operational at their status page

## File Structure Impact

### Modified Files
- `components/file-browser.tsx`: Main component with dual-section layout
- Added TypeScript interfaces for Congress bill data
- Enhanced state management for both files and bills

### New Features Added
- Tab-based section switching
- Congress bill fetching and display
- Error handling for API failures
- Responsive design updates
- Proper loading states

## Future Enhancements

Potential improvements you could add:
- Search/filter bills by keyword
- Filter by bill type (HR, S, etc.)
- Show bill status (introduced, passed, etc.)
- Download bill text as PDF
- Bookmark favorite bills
- More detailed sponsor information
- Committee assignments
