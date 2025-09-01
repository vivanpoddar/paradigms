'use client'

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File, FileText, Image, Download, Plus, ChevronLeft, ChevronRight, Folder, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { PdfViewerWithOverlay } from "@/components/pdf-viewer-with-overlay";
import { useFileManager, type UseFileManagerReturn } from "@/hooks/use-file-manager";

const supabase = createClient();

interface FileItem {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any>;
}

interface FileBrowserProps {
  onFileSelect?: (fileName: string | null) => void;
  onExplain?: (problemText: string, solution: string) => void;
  forceShowFileList?: boolean; // New prop to force showing file list on mobile
  isVisible?: boolean; // New prop to track if the component is currently visible
}

export interface FileBrowserRef {
  refreshFiles: () => Promise<void>;
}

export const FileBrowser = forwardRef<FileBrowserRef, FileBrowserProps>(({ onFileSelect, onExplain, forceShowFileList = false, isVisible = true }, ref) => {
  // Use the file manager hook
  const { files, loading, userId, refreshFiles, addNewFile, removeFile } = useFileManager();
  
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isFileListCollapsed, setIsFileListCollapsed] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Listen for auth state changes to clear selected file when user logs out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setSelectedFile(null);
        setFileContent(null);
        onFileSelect?.(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [onFileSelect]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    refreshFiles,
  }), [refreshFiles]);

  const selectFile = async (file: FileItem) => {
    if (!userId) return;
    
    setSelectedFile(file);
    setFileContent(null);
    
    // Notify parent component about the selected file
    onFileSelect?.(file.name);
    
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(`${userId}/${file.name}`);

      if (error) {
        console.error('Error downloading file:', error);
        return;
      }

      // Handle different file types
      const mimetype = file.metadata?.mimetype || 'application/octet-stream';
      if (mimetype.startsWith('text/') || 
          mimetype === 'application/json') {
        const text = await data.text();
        setFileContent(text);
      } else if (mimetype.startsWith('image/')) {
        const blob = new Blob([data], { type: mimetype });
        const imageUrl = URL.createObjectURL(blob);
        setFileContent(imageUrl);
      } else if (mimetype === 'application/pdf') {
        const blob = new Blob([data], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        setFileContent(pdfUrl);
      } else {
        setFileContent('Binary file - cannot display content');
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const downloadFile = async (file: FileItem) => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(`${userId}/${file.name}`);

      if (error) {
        console.error('Error downloading file:', error);
        return;
      }

      const blob = new Blob([data], { type: file.metadata?.mimetype || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const deleteFile = (file: FileItem) => {
    if (!userId) return;
        
    setDeletingFile(file.id);
    
    // Update UI immediately for better UX
    removeFile(file.id);
    
    if (selectedFile?.id === file.id) {
      setSelectedFile(null);
      setFileContent(null);
      onFileSelect?.(null);
    }
    
    // Perform deletions in background without awaiting
    const performDeletions = async () => {
      try {
        // Delete main file
        const fileDeletePromise = supabase.storage
          .from('documents')
          .remove([`${userId}/${file.name}`]);

        // Delete parsed JSON file if it exists
        const parsedJsonFileName = file.name.replace(/\.(pdf|doc|docx)$/i, '_parsed.json');
        const parsedDeletePromise = parsedJsonFileName !== file.name 
          ? supabase.storage
              .from('documents')
              .remove([`${userId}/${parsedJsonFileName}`])
          : Promise.resolve({ error: null });

        // Delete chat history
        const chatDeletePromise = supabase
          .from('chat_history')
          .delete()
          .eq('user_id', userId)
          .eq('file_name', file.name);

        // Execute all deletions in parallel
        const [fileResult, parsedResult, chatResult] = await Promise.all([
          fileDeletePromise,
          parsedDeletePromise,
          chatDeletePromise
        ]);

        if (fileResult.error) {
          console.error('Error deleting file from storage:', fileResult.error);
        } else {
          console.log('✅ File deleted from storage');
        }

        if (parsedResult.error && parsedJsonFileName !== file.name) {
          console.error('Error deleting parsed file:', parsedResult.error);
        } else if (parsedJsonFileName !== file.name) {
          console.log('✅ Parsed file deleted from storage');
        }

        if (chatResult.error) {
          console.error('Error deleting chat history:', chatResult.error);
        } else {
          console.log(`✅ Chat history deleted (${chatResult.count || 0} messages)`);
        }
        
      } catch (error) {
        console.error('Error during deletion:', error);
        // If there's an error, we could optionally reload the files to restore the UI state
        // refreshFiles();
      } finally {
        setDeletingFile(null);
      }
    };

    // Start deletions but don't await them
    performDeletions();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const visibleFiles = files.filter(file => !file.name.toLowerCase().endsWith('.json'));
  // const visibleFiles = files

  return (
    <div className="flex main-container">
      {/* Left Side - File List */}
      <div className={`transition-all duration-300 border-r border-border flex flex-col ${
        isFileListCollapsed
          ? 'w-12' 
          : forceShowFileList
            ? 'w-full'
            : isMobile && selectedFile 
              ? 'hidden' 
              : 'w-full lg:w-2/5'
      }`}>
        <Card className="max-h-[95vh] overflow-y-scroll rounded-none border-0 flex flex-col">
          <CardHeader className="border-b flex-shrink-0 p-2">
            <CardTitle className="flex items-center justify-between text-sm">
              {!isFileListCollapsed && !isMobile && "Your Files"}
              {!isFileListCollapsed && forceShowFileList && "Your Files"}
              {isFileListCollapsed && !isMobile && (
                <div className="flex justify-center w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFileListCollapsed(!isFileListCollapsed)}
                    className="h-6 w-6 p-0"
                    title={isFileListCollapsed ? "Expand file list (Ctrl+E)" : "Collapse file list (Ctrl+E)"}
                  >
                    {isFileListCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                  </Button>
                </div>
              )}
              {!isFileListCollapsed && (
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUpload(!showUpload)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Upload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshFiles}
                    disabled={loading}
                    className="h-7 text-xs"
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </Button>
                  {!forceShowFileList && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFileListCollapsed(!isFileListCollapsed)}
                      className="h-6 w-6 p-0 hidden lg:flex"
                      title={isFileListCollapsed ? "Expand file list (Ctrl+E)" : "Collapse file list (Ctrl+E)"}
                    >
                      {isFileListCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          {isFileListCollapsed && (
            <div 
              className="flex-1 flex flex-col items-center justify-start pt-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setIsFileListCollapsed(false)}
              title={`Click to expand file list (${visibleFiles.length} files) - Ctrl+E`}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="relative">
                  <Folder className="h-5 w-5" />
                  {visibleFiles.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {visibleFiles.length > 9 ? '9+' : visibleFiles.length}
                    </span>
                  )}
                </div>
                <div className="collapsed-panel-text">
                  Files
                </div>
              </div>
            </div>
          )}
          {!isFileListCollapsed && (
            <CardContent className="p-0 flex-1 flex flex-col">
              {showUpload && (
                <div className="p-4 border-b bg-muted/30 flex-shrink-0">
                  <FileUpload onUploadSuccess={refreshFiles} />
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {visibleFiles.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground text-center">
                      No files uploaded yet
                    </p>
                  </div>
                ) : (
                  visibleFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`p-4 border-b cursor-pointer transition-colors ${
                        selectedFile?.id === file.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      } ${deletingFile === file.id ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={() => deletingFile !== file.id && selectFile(file)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-1">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm font-medium">
                              {file.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.metadata?.size || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(file);
                            }}
                            title="Download file"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFile(file);
                            }}
                            disabled={deletingFile === file.id}
                            title="Delete file and chat history"
                            className=""
                          >
                            {deletingFile === file.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Right Side - File Display - Hidden when forcing file list or on mobile */}
      <div className={`flex-1 flex flex-col ${
        forceShowFileList
          ? 'hidden'
          : isFileListCollapsed 
            ? '' 
            : isMobile && selectedFile 
              ? 'w-full' 
              : 'hidden lg:flex'
      }`}>
        <Card className="h-full rounded-none border-0 flex flex-col">
          <CardHeader className="border-b flex-shrink-0 p-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{selectedFile ? selectedFile.name : 'Select a file to view'}</span>
              {isMobile && selectedFile && !forceShowFileList && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setFileContent(null);
                    onFileSelect?.(null);
                  }}
                  className="h-6 w-6 p-0 lg:hidden"
                  title="Back to file list"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {selectedFile ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 mobile-pdf-container bg-white lg:h-[90vh] overflow-auto mobile-scroll">
                  {fileContent ? (
                    (selectedFile.metadata?.mimetype || '').startsWith('image/') ? (
                      <div className="p-2">
                        <img
                          src={fileContent}
                          alt={selectedFile.name}
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                    ) : selectedFile.metadata?.mimetype === 'application/pdf' ? (
                      <PdfViewerWithOverlay
                        pdfUrl={fileContent}
                        user={userId ?? ""}
                        fileName={selectedFile.name}
                        onExplain={onExplain}
                      />
                    ) : (selectedFile.metadata?.mimetype || '').startsWith('text/') ||
                       selectedFile.metadata?.mimetype === 'application/json' ? (
                      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-4 rounded overflow-auto min-h-0 mobile-pdf-container lg:h-[90vh] flex-1 m-2 mobile-scroll">
                        {fileContent}
                      </pre>
                    ) : (
                      <div className="flex items-center justify-center flex-1 min-h-0">
                        <p className="text-muted-foreground text-center">
                          {fileContent}
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center flex-1 min-h-0">
                      <p className="text-muted-foreground text-center">
                        Loading file content...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 min-h-0">
                <p className="text-muted-foreground text-center">
                  Click on a file from the list to view its content
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

FileBrowser.displayName = 'FileBrowser';

