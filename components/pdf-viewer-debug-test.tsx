import React, { useState } from 'react';
import { PdfViewerWithOverlay } from './pdf-viewer-with-overlay';

// Debug component to test extraction button visibility
export const PdfViewerDebugTest: React.FC = () => {
  const [testProps, setTestProps] = useState({
    fileName: 'test-document.pdf',
    bucketName: 'documents',
    uploadPath: 'user123/test-document.pdf',
    userId: 'user123'
  });

  return (
    <div className="w-full h-screen">
      {/* Debug controls */}
      <div className="fixed top-0 left-0 z-50 bg-yellow-100 p-4 border-b border-yellow-300">
        <h3 className="font-bold mb-2">🔧 Debug Controls</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <label className="block">fileName:</label>
            <input
              type="text"
              value={testProps.fileName}
              onChange={(e) => setTestProps(prev => ({ ...prev, fileName: e.target.value }))}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block">bucketName:</label>
            <input
              type="text"
              value={testProps.bucketName}
              onChange={(e) => setTestProps(prev => ({ ...prev, bucketName: e.target.value }))}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block">uploadPath:</label>
            <input
              type="text"
              value={testProps.uploadPath}
              onChange={(e) => setTestProps(prev => ({ ...prev, uploadPath: e.target.value }))}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block">userId:</label>
            <input
              type="text"
              value={testProps.userId}
              onChange={(e) => setTestProps(prev => ({ ...prev, userId: e.target.value }))}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          ⚠️ Make sure these values match your actual document that has been processed through /api/nparse
        </div>
      </div>

      {/* PDF Viewer with extraction */}
      <div className="pt-32">
        <PdfViewerWithOverlay
          pdfUrl="/sample-document.pdf" // Replace with your actual PDF URL
          fileName={testProps.fileName}
          user={testProps.userId}
          userId={testProps.userId}
          bucketName={testProps.bucketName}
          uploadPath={testProps.uploadPath}
        />
      </div>
    </div>
  );
};

// Usage instructions
/*
To test the extraction button:

1. Import and use this component temporarily:
   import { PdfViewerDebugTest } from './components/pdf-viewer-debug-test';
   
   // In your page component
   <PdfViewerDebugTest />

2. Fill in the debug controls with your actual document details

3. Check the debug overlay in the bottom-left corner to see:
   - What props are being passed
   - Whether extraction is loading
   - Any errors that occur

4. Look for the FileText button in the toolbar next to the Palette (annotations) button

Expected button states:
- ⚪ Gray FileText icon: Ready to extract (no data yet)
- 🔄 Spinning icon: Currently extracting
- 🟢 Green FileText icon with dot: Data available
- 🔴 Red FileText icon with dot: Error occurred

The button should appear as long as all four props (fileName, bucketName, uploadPath, userId) are provided.
*/
