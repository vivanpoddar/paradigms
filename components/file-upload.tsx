'use client'

import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone";
import { useSupabaseUpload } from "@/hooks/use-supabase-upload";

export function FileUpload() {
  const uploadProps = useSupabaseUpload({
    bucketName: 'documents', // You'll need to create this bucket in Supabase
    allowedMimeTypes: ['image/*', 'application/pdf', 'text/*'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
  });

  return (
    <Dropzone {...uploadProps}>
      <DropzoneEmptyState />
      <DropzoneContent />
    </Dropzone>
  );
}
