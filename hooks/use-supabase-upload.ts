import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type FileError, type FileRejection, useDropzone } from 'react-dropzone'
import { convertImageToPDF, isImageFile, concatenateImagesToPDF } from '@/lib/image-to-pdf'

const supabase = createClient()

interface FileWithPreview extends File {
  preview?: string
  errors: readonly FileError[]
}

type UseSupabaseUploadOptions = {
  /**
   * Name of bucket to upload files to in your Supabase project
   */
  bucketName: string
  /**
   * Folder to upload files to in the specified bucket within your Supabase project.
   *
   * Defaults to uploading files to the root of the bucket
   *
   * e.g If specified path is `test`, your file will be uploaded as `test/file_name`
   */
  path?: string
  /**
   * Allowed MIME types for each file upload (e.g `image/png`, `text/html`, etc). Wildcards are also supported (e.g `image/*`).
   *
   * Defaults to allowing uploading of all MIME types.
   */
  allowedMimeTypes?: string[]
  /**
   * Maximum upload size of each file allowed in bytes. (e.g 1000 bytes = 1 KB)
   */
  maxFileSize?: number
  /**
   * Maximum number of files allowed per upload.
   */
  maxFiles?: number
  /**
   * Parsing method to use for document processing.
   * 'mparse' uses Mathpix for mathematical content
   */
  parseMethod?: 'mparse'
  /**
   * The number of seconds the asset is cached in the browser and in the Supabase CDN.
   *
   * This is set in the Cache-Control: max-age=<seconds> header. Defaults to 3600 seconds.
   */
  cacheControl?: number
  /**
   * When set to true, the file is overwritten if it exists.
   *
   * When set to false, an error is thrown if the object already exists. Defaults to `false`
   */
  upsert?: boolean
}

type UseSupabaseUploadReturn = ReturnType<typeof useSupabaseUpload>

const useSupabaseUpload = (options: UseSupabaseUploadOptions) => {
  const {
    bucketName,
    path,
    allowedMimeTypes = [],
    maxFileSize = Number.POSITIVE_INFINITY,
    maxFiles = 1,
    parseMethod = 'mparse', 
    cacheControl = 3600,
    upsert = true,
  } = options

  // Log when parseMethod changes
  useEffect(() => {
    console.log(`🔧 useSupabaseUpload: parseMethod set to "${parseMethod}"`)
  }, [parseMethod])

  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([])
  const [successes, setSuccesses] = useState<string[]>([])
  const [parseResults, setParseResults] = useState<{ [fileName: string]: any }>({})
  const [userId, setUserId] = useState<string | null>(null)

  // Get current user ID on mountwhere
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

  const isSuccess = useMemo(() => {
    if (errors.length === 0 && successes.length === 0) {
      return false
    }
    if (errors.length === 0 && successes.length === files.length) {
      return true
    }
    return false
  }, [errors.length, successes.length, files.length])

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const validFiles = acceptedFiles.map((file) => {
        ;(file as FileWithPreview).preview = URL.createObjectURL(file)
        ;(file as FileWithPreview).errors = []
        return file as FileWithPreview
      })

      const invalidFiles = fileRejections.map(({ file, errors }) => {
        ;(file as FileWithPreview).preview = URL.createObjectURL(file)
        ;(file as FileWithPreview).errors = errors
        return file as FileWithPreview
      })

      // Remove existing files with the same names and add new files
      const existingFileNames = [...validFiles, ...invalidFiles].map(f => f.name)
      const filteredExistingFiles = files.filter(file => !existingFileNames.includes(file.name))
      const newFiles = [...filteredExistingFiles, ...validFiles, ...invalidFiles]

      setFiles(newFiles)
    },
    [files, setFiles]
  )

  const dropzoneProps = useDropzone({
    onDrop,
    noClick: true,
    accept: allowedMimeTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize: maxFileSize,
    maxFiles: maxFiles,
    multiple: maxFiles !== 1,
  })

  const onUpload = useCallback(async () => {
    if (!userId) {
      setErrors([{ name: 'authentication', message: 'User not authenticated' }])
      return
    }

    setLoading(true)
    console.log(`🚀 Starting upload with parseMethod: ${parseMethod}`)

    // [Joshen] This is to support handling partial successes
    // If any files didn't upload for any reason, hitting "Upload" again will only upload the files that had errors
    const filesWithErrors = errors.map((x) => x.name)
    const filesToUpload =
      filesWithErrors.length > 0
        ? [
            ...files.filter((f) => filesWithErrors.includes(f.name)),
            ...files.filter((f) => !successes.includes(f.name)),
          ]
        : files

    // Check if all files are images
    const allImages = filesToUpload.every(file => isImageFile(file));
    const multipleImages = allImages && filesToUpload.length > 1;

    if (multipleImages) {
      console.log(`📚 Concatenating ${filesToUpload.length} images into a single PDF...`);
      try {
        // Concatenate all images into a single PDF
        const concatenatedPDF = await concatenateImagesToPDF(filesToUpload);
        
        // Upload the concatenated PDF
        const uploadPath = `${userId}/${concatenatedPDF.name}`;
        
        console.log(`📤 Uploading concatenated PDF ${concatenatedPDF.name} to Supabase storage...`);
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(uploadPath, concatenatedPDF, {
            cacheControl: cacheControl.toString(),
            upsert: true,
          });
        
        if (error) {
          console.error(`❌ Supabase upload failed for ${concatenatedPDF.name}:`, error.message);
          setErrors([{ name: 'concatenated PDF', message: error.message }]);
          setLoading(false);
          return;
        }

        console.log(`✅ Concatenated PDF uploaded successfully to Supabase`);
        console.log(`🔄 Processing with ${parseMethod} endpoint for file: ${concatenatedPDF.name}`);
        
        const parseEndpoint = `/api/${parseMethod}`;
        const parseResponse = await fetch(parseEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: concatenatedPDF.name,
            bucketName,
            uploadPath,
            userId,
          }),
        });

        if (!parseResponse.ok) {
          let errorMessage = `Parse error: ${parseResponse.status} ${parseResponse.statusText}`;
          try {
            const errorData = await parseResponse.json();
            errorMessage = `Parse error: ${errorData.error}`;
          } catch (jsonError) {
            // Ignore JSON parse errors
          }
          setErrors([{ name: 'concatenated PDF', message: errorMessage }]);
          setLoading(false);
          return;
        }

        const parseResult = await parseResponse.json();
        console.log(`✅ Successfully parsed concatenated PDF with ${parseMethod}`);
        
        // Store parse result for all original files
        const newParseResults: { [key: string]: any } = {};
        filesToUpload.forEach(file => {
          newParseResults[file.name] = parseResult;
        });
        setParseResults(prev => ({ ...prev, ...newParseResults }));

        // Mark all files as successful
        const newSuccesses = Array.from(new Set([...successes, ...filesToUpload.map(f => f.name)]));
        setSuccesses(newSuccesses);
        setErrors([]);
        
        console.log(`🏁 Upload process completed. All ${filesToUpload.length} images processed as one PDF.`);
      } catch (error) {
        console.error(`❌ Failed to concatenate images:`, error);
        setErrors([{ 
          name: 'concatenation', 
          message: error instanceof Error ? error.message : 'Failed to concatenate images' 
        }]);
      }
      setLoading(false);
      return;
    }

    // Original single-file or mixed-file upload logic
    const responses = await Promise.all(
      filesToUpload.map(async (file) => {
        try {
          // Convert image to PDF if it's an image file
          let fileToUpload: File = file;
          let uploadFileName = file.name;
          
          if (isImageFile(file)) {
            console.log(`🖼️ Converting image ${file.name} to PDF...`);
            try {
              const convertedFile = await convertImageToPDF(file);
              fileToUpload = convertedFile;
              uploadFileName = convertedFile.name;
              console.log(`✅ Image converted to PDF: ${uploadFileName}`);
            } catch (conversionError) {
              console.error(`❌ Failed to convert image to PDF:`, conversionError);
              return {
                name: file.name,
                message: `Failed to convert image to PDF: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`,
                parseResult: null
              };
            }
          }
          
          // Upload path: bucketName/userUUID/filename
          const uploadPath = `${userId}/${uploadFileName}`;
          
          console.log(`📤 Uploading file ${uploadFileName} to Supabase storage...`);
          const { error } = await supabase.storage
            .from(bucketName)
            .upload(uploadPath, fileToUpload, {
              cacheControl: cacheControl.toString(),
              upsert: true,
            });
          
          if (error) {
            console.error(`❌ Supabase upload failed for ${uploadFileName}:`, error.message);
            return { name: file.name, message: error.message, parseResult: null };
          }

          // After successful upload, send to backend for processing
          console.log(`✅ File ${uploadFileName} uploaded successfully to Supabase`);
          console.log(`🔄 Processing with ${parseMethod} endpoint for file: ${uploadFileName}`);
          
          const parseEndpoint = `/api/${parseMethod}`;
          console.log(`📡 Making request to: ${parseEndpoint}`);
          
          const parseResponse = await fetch(parseEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: uploadFileName,
              bucketName,
              uploadPath,
              userId,
            }),
          });

          console.log(`📨 Parse response status: ${parseResponse.status} ${parseResponse.statusText}`);

          if (!parseResponse.ok) {
            let errorMessage = `Parse error: ${parseResponse.status} ${parseResponse.statusText}`;
            try {
              const errorData = await parseResponse.json();
              errorMessage = `Parse error: ${errorData.error}`;
              console.error(`❌ Parse API error response:`, errorData);
            } catch (jsonError) {
              // If response is not JSON, try to get text
              try {
                const errorText = await parseResponse.text();
                errorMessage = `Parse error: ${errorText.substring(0, 200)}...`;
                console.error(`❌ Parse API error text:`, errorText.substring(0, 200));
              } catch (textError) {
                errorMessage = `Parse error: ${parseResponse.status} ${parseResponse.statusText}`;
                console.error(`❌ Parse API error - no readable response`);
              }
            }
            return { name: file.name, message: errorMessage, parseResult: null };
          }

          let parseResult;
          try {
            parseResult = await parseResponse.json();
            console.log(`✅ Successfully parsed ${uploadFileName} with ${parseMethod}:`, parseResult.message || 'No message');
          } catch (jsonError) {
            const responseText = await parseResponse.text();
            console.error('❌ Failed to parse response as JSON:', responseText.substring(0, 200));
            return { name: file.name, message: `Parse error: Invalid JSON response`, parseResult: null };
          }
          
          // Store parse result
          setParseResults(prev => ({
            ...prev,
            [file.name]: parseResult
          }));

          return { name: file.name, message: undefined, parseResult };
        } catch (error) {
          console.error(`❌ Upload/parse error for ${file.name}:`, error);
          return { 
            name: file.name, 
            message: error instanceof Error ? error.message : 'Unknown error',
            parseResult: null 
          };
        }
      })
    );

    const responseErrors = responses.filter((x) => x.message !== undefined)
    // if there were errors previously, this function tried to upload the files again so we should clear/overwrite the existing errors.
    setErrors(responseErrors)

    const responseSuccesses = responses.filter((x) => x.message === undefined)
    const newSuccesses = Array.from(
      new Set([...successes, ...responseSuccesses.map((x) => x.name)])
    )
    setSuccesses(newSuccesses)

    setLoading(false)
    console.log(`🏁 Upload process completed. Successes: ${newSuccesses.length}, Errors: ${responseErrors.length}`)
  }, [files, bucketName, errors, successes, userId, cacheControl, upsert, parseMethod])

  useEffect(() => {
    if (files.length === 0) {
      setErrors([])
    }

    // If the number of files doesn't exceed the maxFiles parameter, remove the error 'Too many files' from each file
    if (files.length <= maxFiles) {
      let changed = false
      const newFiles = files.map((file) => {
        if (file.errors.some((e) => e.code === 'too-many-files')) {
          file.errors = file.errors.filter((e) => e.code !== 'too-many-files')
          changed = true
        }
        return file
      })
      if (changed) {
        setFiles(newFiles)
      }
    }
  }, [files.length, setFiles, maxFiles])

  return {
    files,
    setFiles,
    successes,
    isSuccess,
    loading,
    errors,
    setErrors,
    onUpload,
    parseResults,
    maxFileSize: maxFileSize,
    maxFiles: maxFiles,
    allowedMimeTypes,
    ...dropzoneProps,
  }
}

export { useSupabaseUpload, type UseSupabaseUploadOptions, type UseSupabaseUploadReturn }
