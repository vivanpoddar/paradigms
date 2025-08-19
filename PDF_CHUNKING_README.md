# PDF Chunking Implementation

## Overview
The nparse API route now automatically chunks large PDFs into 15-page segments before processing with Google Document AI. This helps handle large documents more efficiently and reduces processing time and potential timeout issues.

## How It Works

### 1. PDF Chunking
- **Chunk Size**: 15 pages per chunk (configurable)
- **Library**: Uses `pdf-lib` for PDF manipulation
- **Process**: Splits the original PDF into smaller segments while preserving page layout and content

### 2. Parallel Processing
- Each 15-page chunk is processed simultaneously with Google Document AI
- Reduces overall processing time through parallel execution
- Provides better error resilience (if one chunk fails, others can still succeed)

### 3. Result Combination
- Text content from all chunks is concatenated
- Page references are adjusted to maintain correct page numbering
- Entities and bounding box coordinates are preserved with proper page offsets

## API Response Changes

The API now returns additional information about chunking:

```json
{
  "message": "File parsed and uploaded successfully with Google Document AI (Gemini OCR) - Processed 3/3 chunks",
  "ocrMethod": "gemini-ocr-chunked",
  "chunksProcessed": 3,
  "totalChunks": 3,
  "documentsCreated": 1,
  "llamaIndexUploaded": true,
  "indexingCompleted": true,
  "parsedJsonPath": "path/to/parsed.json"
}
```

## Benefits

1. **Improved Reliability**: Smaller chunks are less likely to timeout
2. **Better Performance**: Parallel processing reduces total processing time
3. **Error Resilience**: Partial success is possible if some chunks fail
4. **Memory Efficiency**: Processes smaller segments instead of entire large files
5. **Scalability**: Can handle very large documents (hundreds of pages)

## Configuration

The chunk size can be modified by changing the parameter in the `chunkPDF()` function call:

```typescript
const pdfChunks = await chunkPDF(buffer, 15); // 15 pages per chunk
```

## Error Handling

- If PDF chunking fails, the API returns an error
- If some chunks fail processing, the API continues with successful chunks
- Detailed logging shows which chunks succeeded/failed
- Graceful fallback maintains service availability

## Technical Details

- **PDF Library**: pdf-lib v1.17.1+
- **Processing**: Google Document AI (Gemini OCR)
- **Indexing**: LlamaIndex cloud service
- **Storage**: Supabase storage for processed results

## Monitoring

Check the server logs for detailed chunking information:
- `📄 Total pages in PDF: X`
- `📑 Chunking into segments of 15 pages`
- `📋 Creating chunk: pages X to Y`
- `✅ Successfully created N PDF chunks`
- `🔄 Processing chunk N with Document AI...`
- `✅ Successfully processed M/N chunks`
