// Quick test script to run in browser console to check if extraction data is being passed

// Function to check current tab extraction data
function checkExtractionData() {
  console.log('🔍 Checking extraction data in current tab...');
  
  // Check if PdfTabViewer is available
  const tabViewer = document.querySelector('[data-testid="pdf-tab-viewer"]') || document.querySelector('.pdf-tab-viewer');
  if (!tabViewer) {
    console.log('❌ PdfTabViewer not found');
    return;
  }
  
  // Check for extraction debug info in console
  console.log('✅ PdfTabViewer found');
  console.log('🔍 Look for "Extraction Debug Info" logs in console');
  console.log('🔍 The extraction button should appear as a FileText icon (📄) in the PDF toolbar');
  
  // Check if addPdfTab is available
  if ((window as any).addPdfTab) {
    console.log('✅ addPdfTab function is available');
  } else {
    console.log('❌ addPdfTab function not available');
  }
  
  return {
    tabViewerFound: !!tabViewer,
    addPdfTabAvailable: !!(window as any).addPdfTab,
    instructions: [
      '1. Open a PDF file from your documents',
      '2. Look for "🔍 Extraction Debug Info" logs in console',
      '3. Look for FileText icon (📄) in PDF toolbar',
      '4. If bucketName and uploadPath are still undefined, the file might not be from Supabase storage'
    ]
  };
}

// Function to test adding a tab with extraction data
function testAddTabWithExtraction() {
  if (!(window as any).addPdfTab) {
    console.log('❌ addPdfTab not available');
    return;
  }
  
  console.log('🧪 Testing addPdfTab with extraction data...');
  (window as any).addPdfTab(
    'Test Document',
    'data:application/pdf;base64,JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVGl0bGUgKFRlc3QpCi9Db3VudCAyCj4+CmVuZG9iago=', // Minimal PDF
    'test-document.pdf',
    'documents',
    'user123/test-document.pdf'
  );
  
  console.log('✅ Test tab added - check for extraction button in toolbar');
}

// Make functions available globally
(window as any).checkExtractionData = checkExtractionData;
(window as any).testAddTabWithExtraction = testAddTabWithExtraction;

// Auto-run check
console.log('🔧 Extraction debugging tools loaded');
console.log('📝 Run: checkExtractionData() to check current state');
console.log('🧪 Run: testAddTabWithExtraction() to test with sample data');

export {};
