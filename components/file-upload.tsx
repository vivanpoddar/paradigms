'use client'

import { useEffect, useRef } from 'react';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone";
import { useSupabaseUpload } from "@/hooks/use-supabase-upload";

export function FileUpload({ onUploadSuccess }: { onUploadSuccess?: () => void } = {}) {
  const onUploadSuccessRef = useRef(onUploadSuccess);
  
  // Update ref when prop changes
  useEffect(() => {
    onUploadSuccessRef.current = onUploadSuccess;
  }, [onUploadSuccess]);
    
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
    parseMethod: 'mparse',
  });

  // Call onUploadSuccess when files are successfully uploaded
  useEffect(() => {
    if (uploadProps.isSuccess && onUploadSuccessRef.current) {
      onUploadSuccessRef.current();
    }
  }, [uploadProps.isSuccess]);

  return (
    <div className="space-y-4">
      <Dropzone {...uploadProps}>
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
    </div>
  );
}
