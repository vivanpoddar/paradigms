'use client'

import { useEffect, useState } from 'react';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone";
import { useSupabaseUpload } from "@/hooks/use-supabase-upload";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function FileUpload({ onUploadSuccess }: { onUploadSuccess?: () => void } = {}) {
  const [enableMathParsing, setEnableMathParsing] = useState(false);
  
  const parseMethod = enableMathParsing ? 'mparse' : 'nparse';
    
  const uploadProps = useSupabaseUpload({
    bucketName: 'documents', // You'll need to create this bucket in Supabase
    allowedMimeTypes: ['image/*', 'application/pdf', 'text/*'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
    parseMethod,
  });

  // Call onUploadSuccess when files are successfully uploaded
  useEffect(() => {
    if (uploadProps.isSuccess && onUploadSuccess) {
      onUploadSuccess();
    }
  }, [uploadProps.isSuccess, onUploadSuccess]);

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
          Enable math parsing (Mathpix OCR)
        </Label>
      </div>
      <div className="text-xs text-muted-foreground">
        {enableMathParsing 
          ? "Uses Mathpix OCR for better mathematical content recognition" 
          : "Uses Google Document AI (Gemini OCR) for general document parsing"
        }
      </div>
      <Dropzone {...uploadProps}>
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
    </div>
  );
}
