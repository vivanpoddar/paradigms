# PDF Viewer with Integrated Extraction Menu

## Overview

The PDF viewer now includes an integrated extraction info menu in the toolbar that displays structured document analysis results. The menu appears as a button in the toolbar and shows organized data extracted from legislative documents.

## Features Added

### 🎯 **Toolbar Integration**
- **FileText icon button** in the toolbar next to annotations
- **Green indicator dot** when extraction data is available
- **Loading spinner** while extraction is in progress
- **Error indicator** with retry functionality when extraction fails
- **Tooltip indicators** showing current status

### 📊 **Smart State Management**
- **Automatic data fetching** when document props are provided
- **Real-time loading states** with visual feedback
- **Error handling** with retry capabilities
- **Conditional rendering** based on data availability

### 🎨 **Visual Indicators**
- ✅ **Green button** when extraction data is available
- 🔄 **Loading spinner** during data extraction
- ❌ **Red error button** when extraction fails
- 💚 **Green dot badge** indicating successful extraction

## Props Added to PdfViewerWithOverlay

```typescript
interface PdfViewerWithOverlayProps {
  // Existing props...
  pdfUrl: string;
  boundingBoxes?: BoundingBox[];
  user?: string;
  fileName?: string;
  onExplain?: (problemText: string, solution: string) => void;
  
  // New extraction-related props
  bucketName?: string;        // Supabase bucket name
  uploadPath?: string;        // Path to document in storage
  userId?: string;           // User ID for extraction data
}
```

## Usage Examples

### Basic Usage
```tsx
<PdfViewerWithOverlay
  pdfUrl="/path/to/document.pdf"
  fileName="hr1234.pdf"
  user="user123"
  userId="user123"
  bucketName="documents"
  uploadPath="user123/processed/hr1234.pdf"
/>
```

### With All Features
```tsx
<PdfViewerWithOverlay
  pdfUrl="/api/pdf/hr1234.pdf"
  fileName="hr1234.pdf"
  user="user123"
  userId="user123"
  bucketName="documents"
  uploadPath="user123/processed/hr1234.pdf"
  boundingBoxes={boundingBoxData}
  onExplain={(problem, solution) => {
    console.log('Explanation requested:', { problem, solution });
  }}
/>
```

## Extraction Menu Features

### 📋 **Data Categories Displayed**
- **Bill Information** (ID, Congressional Session)
- **Sponsor Details** (Name, Party, State)
- **Amendments to Existing Law**
- **Appropriations** (Amount, Purpose)
- **Definitions** (Terms and Meanings)
- **Provisions** (Sections, Headings, Text)
- **Implementation & Enforcement**
- **Key Dates** (Effective Date, Sunset Clause)
- **Additional Information** (Findings, Notes)

### 🎮 **Interactive Features**
- **Expandable sections** for each data category
- **Count badges** showing number of items
- **Scrollable content** for large documents
- **Toggle functionality** to show/hide menu
- **Responsive design** adapting to screen size

## Toolbar Layout

```
[Search] [Prev] [Page Navigation] [Next] [📄] [🎨] | [Download] [Fullscreen]
                                         ^      ^
                                   Extraction  Annotations
```

### Button States

1. **No Data Available**: Button hidden
2. **Loading**: Spinner icon displayed
3. **Error**: Red FileText icon (click to retry)
4. **Data Available**: Green FileText icon with dot badge
5. **Menu Open**: Green background, white icon

## Workflow Integration

### 1. Document Upload & Processing
```typescript
// Document gets processed through batch processing
const processResult = await fetch('/api/nparse', {
  method: 'POST',
  body: JSON.stringify({
    fileName: 'document.pdf',
    bucketName: 'documents',
    uploadPath: 'user/document.pdf',
    userId: 'user123'
  })
});
```

### 2. Automatic Extraction
```typescript
// useExtraction hook automatically triggers when props are available
const { extractionResult, isLoading, error, hasData } = useExtraction(
  fileName, bucketName, uploadPath, userId
);
```

### 3. Toolbar Button Appears
- Button becomes visible when `hasData` is true
- Shows loading state during extraction
- Displays error state if extraction fails
- Shows success state with green indicator

### 4. Menu Interaction
- Click button to open/close extraction menu
- Menu displays organized document data
- Expandable sections for different categories
- Scrollable content for large datasets

## Styling & Theming

### Dark Mode Support
- All components support dark mode
- Consistent styling with existing toolbar
- Proper contrast ratios maintained

### Responsive Design
- Menu adapts to screen size
- Fixed positioning prevents overlap
- Scrollable content prevents overflow

### Visual Consistency
- Matches existing toolbar button styles
- Consistent hover and active states
- Proper spacing and alignment

## Error Handling

### 1. Missing Required Props
```typescript
// Extraction only activates if all required props provided
if (!fileName || !bucketName || !uploadPath || !userId) {
  // Button remains hidden
  return null;
}
```

### 2. API Errors
```typescript
// Error state shows red button with retry functionality
{extractionError && (
  <button onClick={refetchExtraction} className="text-red-600">
    <FileText className="w-4 h-4" />
  </button>
)}
```

### 3. Loading States
```typescript
// Loading state shows spinner
{isExtractionLoading && (
  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
)}
```

## Accessibility

### Screen Reader Support
- Proper ARIA labels on buttons
- Descriptive tooltips for all states
- Keyboard navigation support

### Keyboard Navigation
- Tab navigation through toolbar buttons
- Enter/Space to activate buttons
- Escape to close menu

### Visual Indicators
- High contrast indicators for all states
- Clear visual feedback for interactions
- Consistent iconography

## Performance Considerations

### 1. Conditional Rendering
- Menu only renders when data is available
- Extraction hook only activates with proper props
- Lazy loading of extraction data

### 2. Efficient State Management
- Uses React hooks for optimal re-rendering
- Memoized components where appropriate
- Efficient data structures for large datasets

### 3. Error Recovery
- Automatic retry mechanisms
- Graceful degradation when data unavailable
- Non-blocking error states

## Testing

### Unit Tests
```typescript
// Test button visibility
expect(screen.queryByTitle('Show extraction data')).not.toBeInTheDocument();

// With data
expect(screen.getByTitle('Show extraction data')).toBeInTheDocument();

// Test loading state
expect(screen.getByTitle('Extracting document data...')).toBeInTheDocument();
```

### Integration Tests
```typescript
// Test full workflow
1. Load PDF viewer with extraction props
2. Wait for extraction to complete
3. Click extraction button
4. Verify menu opens with correct data
5. Test menu interactions
```

## Migration Notes

### From Previous Version
- Add new props to existing PdfViewerWithOverlay usage
- Existing functionality remains unchanged
- New extraction features are opt-in

### Backwards Compatibility
- All existing props continue to work
- No breaking changes to existing API
- New features only activate with new props

This integration provides a seamless way to view structured document extraction results directly within the PDF viewer interface, enhancing the user experience and providing immediate access to analyzed document data.
