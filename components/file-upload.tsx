'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone";
import { useSupabaseUpload } from "@/hooks/use-supabase-upload";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function FileUpload({ onUploadSuccess }: { onUploadSuccess?: () => void } = {}) {
  const [enableMathParsing, setEnableMathParsing] = useState(false);
  const onUploadSuccessRef = useRef(onUploadSuccess);
  
  // Update ref when prop changes
  useEffect(() => {
    onUploadSuccessRef.current = onUploadSuccess;
  }, [onUploadSuccess]);
  
  // Memoize the parse method to ensure proper reactivity
  const parseMethod = useMemo(() => {
    const method = enableMathParsing ? 'mparse' : 'nparse';
    console.log(`Math parsing ${enableMathParsing ? 'ENABLED' : 'DISABLED'} - using ${method} endpoint`);
    return method;
  }, [enableMathParsing]);

  // Handle checkbox change with proper logging
  const handleMathParsingChange = useCallback((checked: boolean | string) => {
    const isChecked = checked === true;
    console.log(`Math parsing checkbox changed to: ${isChecked}`);
    setEnableMathParsing(isChecked);
  }, []);
    
  const uploadProps = useSupabaseUpload({
    bucketName: 'documents',
    allowedMimeTypes: ['image/*', 'application/pdf', 'text/*'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
    parseMethod,
  });

  // Call onUploadSuccess when files are successfully uploaded
  useEffect(() => {
    if (uploadProps.isSuccess && onUploadSuccessRef.current) {
      onUploadSuccessRef.current();
    }
  }, [uploadProps.isSuccess]);

  // Debug log when parseMethod changes
  useEffect(() => {
    console.log(`FileUpload: parseMethod updated to ${parseMethod}`);
  }, [parseMethod]);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="math-parsing" 
          checked={enableMathParsing}
          onCheckedChange={handleMathParsingChange}
        />
        <Label 
          htmlFor="math-parsing"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          Upload with Math Recognition
        </Label>
      </div>
      <Dropzone {...uploadProps}>
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
    </div>
  );
}
