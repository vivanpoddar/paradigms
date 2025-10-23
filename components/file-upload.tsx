'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone";
import { useSupabaseUpload } from "@/hooks/use-supabase-upload";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function FileUpload({ onUploadSuccess }: { onUploadSuccess?: () => void } = {}) {
  const [enableQuestionDetection, setEnableQuestionDetection] = useState(true);
  const onUploadSuccessRef = useRef(onUploadSuccess);
  
  // Update ref when prop changes
  useEffect(() => {
    onUploadSuccessRef.current = onUploadSuccess;
  }, [onUploadSuccess]);
  
  // Memoize the parse method to ensure proper reactivity
  const parseMethod = useMemo(() => {
    const method = enableQuestionDetection ? 'mparse' : 'mparse-simple';
    console.log(`Question detection ${enableQuestionDetection ? 'ENABLED' : 'DISABLED'} - using ${method} endpoint`);
    return method;
  }, [enableQuestionDetection]);

  // Handle checkbox change with proper logging
  const handleQuestionDetectionChange = useCallback((checked: boolean | string) => {
    const isChecked = checked === true;
    console.log(`Question detection checkbox changed to: ${isChecked}`);
    setEnableQuestionDetection(isChecked);
  }, []);
    
  const uploadProps = useSupabaseUpload({
    bucketName: 'documents',
    allowedMimeTypes: [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff'
    ],
    maxFileSize: 20 * 1024 * 1024, // 20MB (increased for images)
    maxFiles: 10, // Allow multiple images
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
          id="question-detection" 
          checked={enableQuestionDetection}
          onCheckedChange={handleQuestionDetectionChange}
        />
        <Label 
          htmlFor="question-detection"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          Enable Question Detection
        </Label>
      </div>
      <Dropzone {...uploadProps}>
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
    </div>
  );
}
