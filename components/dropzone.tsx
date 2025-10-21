'use client'

import { cn } from '@/lib/utils'
import { type UseSupabaseUploadReturn } from '@/hooks/use-supabase-upload'
import { Button } from '@/components/ui/button'
import { CheckCircle, File, Loader2, Upload, X, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import { createContext, type PropsWithChildren, useCallback, useContext } from 'react'

export const formatBytes = (
  bytes: number,
  decimals = 2,
  size?: 'bytes' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB' | 'EB' | 'ZB' | 'YB'
) => {
  const k = 1000
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  if (bytes === 0 || bytes === undefined) return size !== undefined ? `0 ${size}` : '0 bytes'
  const i = size !== undefined ? sizes.indexOf(size) : Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

type DropzoneContextType = Omit<UseSupabaseUploadReturn, 'getRootProps' | 'getInputProps'>

const DropzoneContext = createContext<DropzoneContextType | undefined>(undefined)

type DropzoneProps = UseSupabaseUploadReturn & {
  className?: string
}

const Dropzone = ({
  className,
  children,
  getRootProps,
  getInputProps,
  ...restProps
}: PropsWithChildren<DropzoneProps>) => {
  const isSuccess = restProps.isSuccess
  const isActive = restProps.isDragActive
  const isInvalid =
    (restProps.isDragActive && restProps.isDragReject) ||
    (restProps.errors.length > 0 && !restProps.isSuccess) ||
    restProps.files.some((file) => file.errors.length !== 0)

  return (
    <DropzoneContext.Provider value={{ ...restProps }}>
      <div
        {...getRootProps({
          className: cn(
            'border-2 border-gray-300 rounded-lg p-6 text-center bg-card transition-colors duration-300 text-foreground',
            className,
            isSuccess ? 'border-solid' : 'border-dashed',
            isActive && 'border-primary bg-primary/10',
            isInvalid && 'border-destructive bg-destructive/10'
          ),
        })}
      >
        <input {...getInputProps()} />
        {children}
      </div>
    </DropzoneContext.Provider>
  )
}
const DropzoneContent = ({ className }: { className?: string }) => {
  const {
    files,
    setFiles,
    onUpload,
    loading,
    successes,
    errors,
    maxFileSize,
    maxFiles,
    isSuccess,
    parseResults,
    inputRef,
  } = useDropzoneContext()

  const exceedMaxFiles = files.length > maxFiles

  const handleRemoveFile = useCallback(
    (fileName: string) => {
      setFiles(files.filter((file) => file.name !== fileName))
    },
    [files, setFiles]
  )

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0) {
        const newFiles = [...files]
        const temp = newFiles[index]
        newFiles[index] = newFiles[index - 1]
        newFiles[index - 1] = temp
        setFiles(newFiles)
      }
    },
    [files, setFiles]
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < files.length - 1) {
        const newFiles = [...files]
        const temp = newFiles[index]
        newFiles[index] = newFiles[index + 1]
        newFiles[index + 1] = temp
        setFiles(newFiles)
      }
    },
    [files, setFiles]
  )

  const handleAddMore = () => {
    inputRef.current?.click()
  }

  if (isSuccess) {
    return (
      <div className={cn('flex flex-col gap-y-2', className)}>
        <div className="flex flex-row items-center gap-x-2 justify-center">
          <CheckCircle size={16} className="text-primary" />
          <p className="text-primary text-sm">
            Successfully uploaded and parsed {files.length} file{files.length > 1 ? 's' : ''}
          </p>
        </div>
        {Object.keys(parseResults).length > 0 && (
          <div className="text-left">
            <p className="text-sm font-medium mb-2">Parse Results:</p>
            {Object.entries(parseResults).map(([fileName, result]) => (
              <div key={fileName} className="mb-2 p-2 bg-muted rounded">
                <p className="text-xs font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {result.documents?.length || result.documentsCreated || 0} document(s) parsed
                </p>
                {result.ocrMethod && (
                  <p className="text-xs text-blue-600 font-medium">
                    Method: {result.ocrMethod === 'gemini-ocr' ? 'Standard OCR' : 'Math OCR'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {files.map((file, idx) => {
        const fileError = errors.find((e) => e.name === file.name)
        const isSuccessfullyUploaded = !!successes.find((e) => e === file.name)
        const canMoveUp = idx > 0 && !loading && !isSuccessfullyUploaded
        const canMoveDown = idx < files.length - 1 && !loading && !isSuccessfullyUploaded

        return (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center gap-x-2 border-b py-2 first:mt-4 last:mb-4"
          >
            {!loading && !isSuccessfullyUploaded && files.length > 1 && (
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-5 w-5 p-0",
                    !canMoveUp && "opacity-30 cursor-not-allowed"
                  )}
                  onClick={() => canMoveUp && handleMoveUp(idx)}
                  disabled={!canMoveUp}
                >
                  <ChevronUp size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-5 w-5 p-0",
                    !canMoveDown && "opacity-30 cursor-not-allowed"
                  )}
                  onClick={() => canMoveDown && handleMoveDown(idx)}
                  disabled={!canMoveDown}
                >
                  <ChevronDown size={16} />
                </Button>
              </div>
            )}
            {file.type.startsWith('image/') ? (
              <div className="h-10 w-10 rounded border overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                <img src={file.preview} alt={file.name} className="object-cover" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center">
                <File size={18} />
              </div>
            )}

            <div className="shrink grow flex flex-col items-start truncate">
              <p title={file.name} className="text-sm truncate max-w-full">
                {file.name}
              </p>
              {file.errors.length > 0 ? (
                <p className="text-xs text-destructive">
                  {file.errors
                    .map((e) =>
                      e.message.startsWith('File is larger than')
                        ? `File is larger than ${formatBytes(maxFileSize, 2)} (Size: ${formatBytes(file.size, 2)})`
                        : e.message
                    )
                    .join(', ')}
                </p>
              ) : loading && !isSuccessfullyUploaded ? (
                <p className="text-xs text-muted-foreground">Uploading file...</p>
              ) : !!fileError ? (
                <p className="text-xs text-destructive">Failed to upload: {fileError.message}</p>
              ) : isSuccessfullyUploaded ? (
                <p className="text-xs text-primary">Successfully uploaded file</p>
              ) : (
                <p className="text-xs text-muted-foreground">{formatBytes(file.size, 2)}</p>
              )}
            </div>

            {!loading && !isSuccessfullyUploaded && (
              <Button
                size="icon"
                variant="link"
                className="shrink-0 justify-self-end text-muted-foreground hover:text-foreground"
                onClick={() => handleRemoveFile(file.name)}
              >
                <X />
              </Button>
            )}
          </div>
        )
      })}
      {exceedMaxFiles && (
        <p className="text-sm text-left mt-2 text-destructive">
          You may upload only up to {maxFiles} files, please remove {files.length - maxFiles} file
          {files.length - maxFiles > 1 ? 's' : ''}.
        </p>
      )}
      {files.length > 0 && !exceedMaxFiles && (
        <div className="mt-2 space-y-2">
          {!loading && files.length < maxFiles && (
            <Button
              variant="outline"
              onClick={handleAddMore}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add More Files
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onUpload}
            disabled={files.some((file) => file.errors.length !== 0) || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>Upload files</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

const DropzoneEmptyState = ({ className }: { className?: string }) => {
  const { maxFiles, maxFileSize, inputRef, isSuccess } = useDropzoneContext()

  if (isSuccess) {
    return null
  }

  return (
    <div className={cn('flex flex-col items-center gap-y-2', className)}>
      <Upload size={20} className="text-muted-foreground" />
      <p className="text-sm">
        Upload{!!maxFiles && maxFiles > 1 ? ` ${maxFiles}` : ''} file
        {!maxFiles || maxFiles > 1 ? 's' : ''}
      </p>
      <div className="flex flex-col items-center gap-y-1">
        <p className="text-xs text-muted-foreground">
          Drag and drop or{' '}
          <a
            onClick={() => inputRef.current?.click()}
            className="underline cursor-pointer transition hover:text-foreground"
          >
            select {maxFiles === 1 ? `file` : 'files'}
          </a>{' '}
          to upload
        </p>
        {maxFileSize !== Number.POSITIVE_INFINITY && (
          <p className="text-xs text-muted-foreground">
            Maximum file size: {formatBytes(maxFileSize, 2)}
          </p>
        )}
      </div>
    </div>
  )
}

const useDropzoneContext = () => {
  const context = useContext(DropzoneContext)

  if (!context) {
    throw new Error('useDropzoneContext must be used within a Dropzone')
  }

  return context
}

export { Dropzone, DropzoneContent, DropzoneEmptyState, useDropzoneContext }
