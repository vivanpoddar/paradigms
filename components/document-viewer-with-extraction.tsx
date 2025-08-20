import React, { useState } from 'react';
import { ExtractionInfoMenu } from './extraction-info-menu';
import { useExtraction } from '../hooks/use-extraction';

interface DocumentViewerWithExtractionProps {
  fileName: string;
  bucketName: string;
  uploadPath: string;
  userId: string;
  children: React.ReactNode; // The PDF viewer or document display component
}

export const DocumentViewerWithExtraction: React.FC<DocumentViewerWithExtractionProps> = ({
  fileName,
  bucketName,
  uploadPath,
  userId,
  children,
}) => {
  const [isExtractionMenuOpen, setIsExtractionMenuOpen] = useState(false);
  
  const { 
    extractionResult, 
    isLoading, 
    error, 
    refetch, 
    hasData 
  } = useExtraction(fileName, bucketName, uploadPath, userId);

  const toggleExtractionMenu = () => {
    setIsExtractionMenuOpen(!isExtractionMenuOpen);
  };

  return (
    <div className="relative w-full h-full">
      {/* Main document viewer */}
      {children}
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg shadow-lg z-40">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Extracting document data...
          </div>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-4 py-2 rounded-lg shadow-lg z-40">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <div>
              <div className="font-medium">Extraction Failed</div>
              <div className="text-sm">{error}</div>
              <button 
                onClick={refetch}
                className="text-sm underline hover:no-underline mt-1"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extraction Info Menu */}
      {hasData && extractionResult && (
        <ExtractionInfoMenu
          extractionResult={extractionResult}
          isOpen={isExtractionMenuOpen}
          onToggle={toggleExtractionMenu}
        />
      )}

      {/* Extraction status indicator when menu is closed */}
      {hasData && !isExtractionMenuOpen && (
        <div className="fixed top-16 right-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm shadow-lg z-40">
          ✓ Data extracted
        </div>
      )}
    </div>
  );
};
