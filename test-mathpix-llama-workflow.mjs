import fetch from 'node-fetch';

const testMathpixToLlamaIndex = async () => {
  console.log('Testing Mathpix OCR + LlamaIndex embedding workflow...');
  
  try {
    // This would typically be called after uploading a file
    console.log('Note: This test requires a file to be uploaded through the normal upload process');
    console.log('The new workflow will:');
    console.log('1. Extract text from PDF using Mathpix OCR');
    console.log('2. Send the extracted text to LlamaIndex for embedding generation');
    console.log('3. Store both the original file and the embedded text');
    console.log('4. Allow querying against the embedded text using metadata filtering');
    
    // Test query with a sample filename
    const testQuery = {
      query: 'What mathematical concepts are covered in this document?',
      fileName: 'sample-homework.pdf'
    };
    
    console.log('\nTesting query with sample filename...');
    const response = await fetch('http://localhost:3000/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testQuery),
    });

    console.log('Query response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Query successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('Query failed:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

testMathpixToLlamaIndex();
