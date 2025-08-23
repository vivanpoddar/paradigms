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
    maxFileSize: 10 * 1024 * 1024, // 5MB
    maxFiles: 1,
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
      <Dropzone {...uploadProps}>
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
    </div>
  );
}
