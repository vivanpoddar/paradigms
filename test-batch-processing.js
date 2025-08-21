const fs = require('fs');
const path = require('path');

// Test the batch processing endpoint
async function testBatchProcessing() {
    try {
        console.log('🚀 Testing Document AI Batch Processing...');
        
        // Test data - replace with actual values from your Supabase storage
        const testData = {
            fileName: 'test-document.pdf',
            bucketName: 'documents', // Replace with your actual bucket name
            uploadPath: 'path/to/your/test-document.pdf', // Replace with actual path
            userId: 'test-user-id' // Replace with actual user ID
        };

        // Make API call to the nparse endpoint
        const response = await fetch('http://localhost:3000/api/nparse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Batch processing completed successfully!');
            console.log('📊 Results:', {
                message: result.message,
                ocrMethod: result.ocrMethod,
                chunksProcessed: result.chunksProcessed,
                totalChunks: result.totalChunks,
                gcsUrisUploaded: result.gcsUrisUploaded,
                indexingCompleted: result.indexingCompleted
            });
        } else {
            console.error('❌ Batch processing failed:', result.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Instructions for running the test
console.log(`
📋 Instructions for testing Document AI Batch Processing:

1. Make sure your Next.js development server is running:
   npm run dev

2. Update the testData object above with:
   - fileName: Name of a PDF file in your Supabase storage
   - bucketName: Your Supabase storage bucket name
   - uploadPath: Full path to the PDF file in storage
   - userId: A valid user ID

3. Ensure your Google Cloud Storage bucket 'paradigms-documents' exists and is accessible

4. Run this test:
   node test-batch-processing.js

🔧 Key changes in the batch processing implementation:

✅ PDF chunks are uploaded to Google Cloud Storage first
✅ Document AI batch processing processes all chunks at once
✅ Results are downloaded and combined automatically
✅ More efficient than processing chunks individually
✅ Better error handling and logging
✅ Supports larger documents through proper batching

📁 Google Cloud Storage structure:
   paradigms-documents/
   ├── chunks/
   │   └── {userId}/
   │       ├── document_chunk_1.pdf
   │       ├── document_chunk_2.pdf
   │       └── ...
   └── batch_output/
       └── {userId}/
           └── {timestamp}/
               ├── result_1.json
               ├── result_2.json
               └── ...
`);

// Uncomment the line below to run the test
// testBatchProcessing();
