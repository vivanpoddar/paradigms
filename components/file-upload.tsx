'use client'

import { useEffect, useState, useRef } from 'react';
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
  
  const parseMethod = enableMathParsing ? 'mparse' : 'nparse';
    
  const uploadProps = useSupabaseUpload({
    bucketName: 'documents', // You'll need to create this bucket in Supabase
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
  }, [uploadProps.isSuccess]); // Remove onUploadSuccess from dependencies

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="math-parsing" 
          checked={enableMathParsing}
          onCheckedChange={(checked) => setEnableMathParsing(checked as boolean)}
        />
        <Label 
          htmlFor="math-parsing"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Select Math Recognition
        </Label>
      </div>
      <Dropzone {...uploadProps}>
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
    </div>
  );
}
