import { useState, useEffect, useCallback } from 'react';

interface ExtractionResult {
  amendments_to_existing_law?: {
    law_reference: string;
    modification: string;
  }[];
  appropriations?: {
    amount: string;
    purpose: string;
  }[];
  bill_id?: string;
  congressional_session?: string;
  definitions?: {
    meaning: string;
    term: string;
  }[];
  effective_date?: string;
  enacting_clause?: string;
  findings_purpose?: string;
  implementation_enforcement?: {
    agency: string;
    penalties: string;
    responsibilities: string;
  };
  miscellaneous?: string;
  notes?: string;
  provisions?: {
    heading: string;
    section_number: string;
    text: string;
  }[];
  sponsor?: {
    name: string;
    party: string;
    state: string;
  };
  sunset_clause?: string;
}

interface UseExtractionResult {
  extractionResult: ExtractionResult | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasData: boolean;
}

interface ExtractionApiResponse {
  success: boolean;
  extractionResult: ExtractionResult;
  extractionResultPath: string;
  textLength: number;
  fieldsExtracted: number;
  error?: string;
}

export const useExtraction = (
  fileName?: string,
  bucketName?: string,
  uploadPath?: string,
  userId?: string
): UseExtractionResult => {
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExtraction = useCallback(async () => {
    if (!fileName || !bucketName || !uploadPath || !userId) {
      console.log('🔍 useExtraction: Missing required parameters', { fileName, bucketName, uploadPath, userId });
      setError('Missing required parameters for extraction');
      return;
    }

    console.log('🔍 useExtraction: Starting fetch with', { fileName, bucketName, uploadPath, userId });
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extraction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          bucketName,
          uploadPath,
          userId,
        }),
      });

      console.log('🔍 useExtraction: API response', { status: response.status, ok: response.ok });
      const data: ExtractionApiResponse = await response.json();
      console.log('🔍 useExtraction: API data', data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (data.success && data.extractionResult) {
        console.log('🔍 useExtraction: Success, setting result');
        setExtractionResult(data.extractionResult);
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch extraction data';
      console.error('🔍 useExtraction: Error', err);
      setError(errorMessage);
      setExtractionResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [fileName, bucketName, uploadPath, userId]);

  useEffect(() => {
    if (fileName && bucketName && uploadPath && userId) {
      fetchExtraction();
    }
  }, [fetchExtraction]);

  const hasData = extractionResult !== null && Object.keys(extractionResult).length > 0;

  return {
    extractionResult,
    isLoading,
    error,
    refetch: fetchExtraction,
    hasData,
  };
};
