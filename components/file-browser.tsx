'use client'

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File, FileText, Image, Download, Plus, ChevronLeft, ChevronRight, Folder } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { PdfViewerWithOverlay } from "@/components/pdf-viewer-with-overlay";

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
}

export function FileBrowser({ onFileSelect }: FileBrowserProps = {}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isFileListCollapsed, setIsFileListCollapsed] = useState(false);

  // Get current user and load files
  useEffect(() => {
    const loadUserFiles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await loadFiles(user.id);
      }
    };
    loadUserFiles();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          setIsFileListCollapsed(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadFiles = async (userUuid: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .list(userUuid, {
          limit: 100,
          offset: 0,
        });

      if (error) {
        console.error('Error loading files:', error);
      } else {
        setFiles(data || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype?.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimetype?.startsWith('text/')) return <FileText className="h-4 w-4" />;
    if (mimetype === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="flex h-full">
      {/* Left Side - File List */}
      <div className={`transition-all duration-300 border-r border-border flex flex-col ${isFileListCollapsed ? 'w-12' : 'w-2/5'}`}>
        <Card className="h-full rounded-none border-0 flex flex-col">
          <CardHeader className="border-b flex-shrink-0 p-2">
            <CardTitle className="flex items-center justify-between text-sm">
              {!isFileListCollapsed && "Your Files"}
              {isFileListCollapsed && (
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
                    onClick={() => userId && loadFiles(userId)}
                    disabled={loading}
                    className="h-7 text-xs"
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </Button>
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
            </CardTitle>
          </CardHeader>
          {isFileListCollapsed && (
            <div 
              className="flex-1 flex flex-col items-center justify-start pt-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setIsFileListCollapsed(false)}
              title={`Click to expand file list (${files.length} files) - Ctrl+E`}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="relative">
                  <Folder className="h-5 w-5" />
                  {files.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {files.length > 9 ? '9+' : files.length}
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
                  <FileUpload />
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {files.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground text-center">
                      No files uploaded yet
                    </p>
                  </div>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className={`p-4 border-b cursor-pointer transition-colors ${
                        selectedFile?.id === file.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => selectFile(file)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getFileIcon(file.metadata?.mimetype || '')}
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-sm font-medium">
                              {file.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.metadata?.size || 0)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(file);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Right Side - File Display */}
      <div className="flex-1 flex flex-col">
        <Card className="h-full rounded-none border-0 flex flex-col">
          <CardHeader className="border-b flex-shrink-0 p-2">
            <CardTitle className="text-sm">
              {selectedFile ? selectedFile.name : 'Select a file to view'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {selectedFile ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 h-[90vh] overflow-auto">
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
                      />
                    ) : (selectedFile.metadata?.mimetype || '').startsWith('text/') ||
                       selectedFile.metadata?.mimetype === 'application/json' ? (
                      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-4 rounded overflow-auto min-h-0 h-[90vh] flex-1 m-2">
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
}

