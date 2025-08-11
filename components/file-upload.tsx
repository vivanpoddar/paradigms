'use client'

import { useEffect } from 'react';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone";
import { useSupabaseUpload } from "@/hooks/use-supabase-upload";

export function FileUpload({ onUploadSuccess }: { onUploadSuccess?: () => void } = {}) {
  const uploadProps = useSupabaseUpload({
    bucketName: 'documents', // You'll need to create this bucket in Supabase
    allowedMimeTypes: ['image/*', 'application/pdf', 'text/*'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
  });

  // Call onUploadSuccess when files are successfully uploaded
  useEffect(() => {
    if (uploadProps.isSuccess && onUploadSuccess) {
      onUploadSuccess();
    }
  }, [uploadProps.isSuccess, onUploadSuccess]);

  return (
    <Dropzone {...uploadProps}>
      <DropzoneEmptyState />
      <DropzoneContent />
    </Dropzone>
  );
}
