import React from 'react';
import { PdfViewerWithOverlay } from '../components/pdf-viewer-with-overlay';

interface DocumentPageProps {
  // Document information
  pdfUrl: string;
  fileName: string;
  
  // User information
  userId: string;
  
  // Supabase storage information
  bucketName: string;
  uploadPath: string;
  
  // Optional props
  boundingBoxes?: any[];
  onExplain?: (problemText: string, solution: string) => void;
}

export const DocumentPage: React.FC<DocumentPageProps> = ({
  pdfUrl,
  fileName,
  userId,
  bucketName,
  uploadPath,
  boundingBoxes = [],
  onExplain
}) => {
  return (
    <div className="w-full h-screen">
      <PdfViewerWithOverlay
        pdfUrl={pdfUrl}
        fileName={fileName}
        user={userId}
        userId={userId}
        bucketName={bucketName}
        uploadPath={uploadPath}
        boundingBoxes={boundingBoxes}
        onExplain={onExplain}
      />
    </div>
  );
};

// Example usage:
/*
<DocumentPage
  pdfUrl="/api/pdf/hr1234.pdf"
  fileName="hr1234.pdf"
  userId="user123"
  bucketName="documents"
  uploadPath="user123/processed/hr1234.pdf"
  onExplain={(problem, solution) => {
    console.log('Problem:', problem);
    console.log('Solution:', solution);
  }}
/>
*/
