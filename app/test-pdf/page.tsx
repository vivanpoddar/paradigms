'use client';

import { PdfViewerWithOverlay } from '@/components/pdf-viewer-with-overlay';

export default function TestPdfViewer() {
  return (
    <div className="h-screen w-full">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Test PDF Viewer</h1>
        <div className="h-[calc(100vh-6rem)] border border-gray-300 rounded">
          <PdfViewerWithOverlay
            pdfUrl="/notes.pdf"
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
