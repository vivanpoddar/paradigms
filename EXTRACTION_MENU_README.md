# Document Extraction Info Menu Integration Guide

## Overview

This implementation provides a structured extraction info menu that displays document analysis results according to your legislative document schema. The menu shows extracted information like bill details, sponsors, appropriations, definitions, and more in an organized, expandable tree format.

## Components Created

### 1. `ExtractionInfoMenu` Component
- **Location**: `/components/extraction-info-menu.tsx`
- **Purpose**: Displays structured extraction results in an expandable tree format
- **Features**:
  - Collapsible sections for each data category
  - Icon-based navigation
  - Count badges for arrays
  - Responsive design with dark mode support
  - Fixed positioning with toggle functionality

### 2. Extraction API Endpoint
- **Location**: `/app/api/extraction/route.ts`
- **Purpose**: Processes OCR text and extracts structured data according to your schema
- **Features**:
  - Pattern matching for legislative documents
  - Extracts bill IDs, sponsors, dates, appropriations, etc.
  - Stores results as JSON in Supabase storage
  - Fallback to parsed JSON if OCR text unavailable

### 3. `useExtraction` Hook
- **Location**: `/hooks/use-extraction.ts`
- **Purpose**: Manages extraction data fetching and state
- **Features**:
  - Automatic data fetching
  - Loading and error states
  - Refetch capability
  - TypeScript support

### 4. Integration Wrapper
- **Location**: `/components/document-viewer-with-extraction.tsx`
- **Purpose**: Wraps any document viewer with extraction functionality
- **Features**:
  - Loading indicators
  - Error handling
  - Status notifications
  - Easy integration with existing viewers

## Integration Examples

### Basic Integration with PDF Viewer

```tsx
import { DocumentViewerWithExtraction } from './components/document-viewer-with-extraction';
import { PdfViewerWithOverlay } from './components/pdf-viewer-with-overlay';

function MyDocumentPage() {
  const documentProps = {
    fileName: 'hr1234.pdf',
    bucketName: 'documents',
    uploadPath: 'user123/hr1234.pdf',
    userId: 'user123'
  };

  return (
    <DocumentViewerWithExtraction {...documentProps}>
      <PdfViewerWithOverlay
        fileUrl="/path/to/document.pdf"
        boundingBoxes={[]}
        annotations={[]}
        // ... other props
      />
    </DocumentViewerWithExtraction>
  );
}
```

### Direct Component Usage

```tsx
import { ExtractionInfoMenu } from './components/extraction-info-menu';
import { useExtraction } from './hooks/use-extraction';

function MyComponent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const { extractionResult, isLoading, error } = useExtraction(
    'document.pdf',
    'my-bucket',
    'path/to/document.pdf',
    'user-id'
  );

  if (isLoading) return <div>Loading extraction data...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!extractionResult) return <div>No data available</div>;

  return (
    <div>
      {/* Your existing UI */}
      <ExtractionInfoMenu
        extractionResult={extractionResult}
        isOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen(!isMenuOpen)}
      />
    </div>
  );
}
```

## Data Schema

The extraction menu supports the following data structure:

```typescript
interface ExtractionResult {
  // Bill identification
  bill_id?: string;                    // e.g., "H.R. 1234"
  congressional_session?: string;      // e.g., "118th Congress"
  
  // Sponsor information
  sponsor?: {
    name: string;                      // e.g., "John Smith"
    party: string;                     // e.g., "R", "D"
    state: string;                     // e.g., "CA", "TX"
  };
  
  // Legal amendments
  amendments_to_existing_law?: {
    law_reference: string;             // Reference to existing law
    modification: string;              // Description of change
  }[];
  
  // Financial appropriations
  appropriations?: {
    amount: string;                    // e.g., "$50 million"
    purpose: string;                   // Purpose of funding
  }[];
  
  // Definitions section
  definitions?: {
    term: string;                      // Term being defined
    meaning: string;                   // Definition text
  }[];
  
  // Document provisions
  provisions?: {
    heading: string;                   // Section heading
    section_number: string;            // e.g., "101", "202"
    text: string;                      // Section content
  }[];
  
  // Implementation details
  implementation_enforcement?: {
    agency: string;                    // Responsible agency
    penalties: string;                 // Penalty information
    responsibilities: string;          // Agency responsibilities
  };
  
  // Key dates and clauses
  effective_date?: string;             // When law takes effect
  enacting_clause?: string;            // Standard enacting language
  sunset_clause?: string;              // Expiration information
  
  // Additional information
  findings_purpose?: string;           // Congressional findings
  notes?: string;                      // Additional notes
  miscellaneous?: string;              // Other information
}
```

## API Usage

### Extract Data from Processed Document

```javascript
// POST /api/extraction
const response = await fetch('/api/extraction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'document.pdf',
    bucketName: 'your-bucket',
    uploadPath: 'path/to/document.pdf',
    userId: 'user-id'
  })
});

const data = await response.json();
// Returns: { success: true, extractionResult: {...}, ... }
```

## Workflow Integration

### Complete Document Processing Workflow

1. **Upload Document**: User uploads PDF to your application
2. **Process with nparse**: Document goes through batch processing
3. **Extract Structure**: Extraction API analyzes OCR results
4. **Display Results**: ExtractionInfoMenu shows structured data

```tsx
// Example workflow component
function DocumentProcessor({ file }) {
  const [processingStage, setProcessingStage] = useState('upload');
  const [documentData, setDocumentData] = useState(null);

  const processDocument = async () => {
    // 1. Upload to Supabase
    setProcessingStage('uploading');
    const uploadResult = await uploadFile(file);
    
    // 2. Process with Document AI
    setProcessingStage('processing');
    const parseResult = await fetch('/api/nparse', {
      method: 'POST',
      body: JSON.stringify(uploadResult)
    });
    
    // 3. Extract structured data
    setProcessingStage('extracting');
    const extractionResult = await fetch('/api/extraction', {
      method: 'POST',
      body: JSON.stringify(uploadResult)
    });
    
    setProcessingStage('complete');
    setDocumentData(extractionResult);
  };

  return (
    <div>
      {processingStage === 'complete' && documentData && (
        <DocumentViewerWithExtraction {...documentData}>
          <PdfViewer file={file} />
        </DocumentViewerWithExtraction>
      )}
    </div>
  );
}
```

## Customization

### Custom Icons and Styling

```tsx
// Customize icons for different data types
const customIcons = {
  billInfo: <FileText size={16} />,
  sponsor: <Users size={16} />,
  appropriations: <DollarSign size={16} />,
  // ... add more custom icons
};
```

### Custom Data Parsing

```typescript
// Extend the parsing logic in /app/api/extraction/route.ts
const parseExtractionData = (text: string): ExtractionResult => {
  // Add your custom parsing patterns here
  const customPattern = /your-custom-regex/gi;
  // ... implement custom extraction logic
};
```

## Testing

### Test the Extraction Menu

1. **Prepare test data**:
   ```bash
   # Use the test file we created earlier
   node test-batch-processing.js
   ```

2. **Check extraction results**:
   ```bash
   # After processing, call the extraction API
   curl -X POST http://localhost:3000/api/extraction \
     -H "Content-Type: application/json" \
     -d '{"fileName":"test.pdf","bucketName":"documents","uploadPath":"test.pdf","userId":"test-user"}'
   ```

3. **View in UI**:
   - Integration the ExtractionInfoMenu component
   - Check that data displays correctly
   - Test expand/collapse functionality

## Troubleshooting

### Common Issues

1. **No extraction data showing**:
   - Ensure document was processed with `/api/nparse` first
   - Check that OCR text or parsed JSON exists in storage
   - Verify file paths match exactly

2. **Parsing errors**:
   - Document text may not match expected patterns
   - Legislative documents vary in format
   - Consider adding more flexible regex patterns

3. **UI issues**:
   - Check that all UI components are properly imported
   - Verify Tailwind CSS classes are available
   - Ensure dark mode styling works correctly

### Debug Mode

Enable detailed logging:

```typescript
// In extraction API
console.log('Extracted text:', extractedText.substring(0, 500));
console.log('Parsing result:', extractionResult);
```

This implementation provides a complete solution for displaying structured extraction results from your legislative documents in an intuitive, user-friendly interface.
