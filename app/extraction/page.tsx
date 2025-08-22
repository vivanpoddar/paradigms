'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ExtractionInfoViewer } from '@/components/extraction-info-viewer';

export default function ExtractionPage() {
  const searchParams = useSearchParams();
  const filename = searchParams.get('filename');
  const [extractionData, setExtractionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExtractionData = async () => {
      if (!filename) {
        setError('No filename provided');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/extraction-info?filename=${encodeURIComponent(filename)}`);
        const result = await response.json();
        
        if (response.ok) {
          setExtractionData(result.extractionData);
        } else {
          setError(result.error || 'Failed to fetch extraction data');
        }
      } catch (err) {
        setError('Error fetching extraction data');
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExtractionData();
  }, [filename]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading extraction data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4 mx-auto">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Error Loading Data</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ExtractionInfoViewer
      extractionData={extractionData}
      isOpen={true}
      onClose={() => window.close()}
      fileName={filename || 'Unknown'}
      isFullPage={true}
    />
  );
}
