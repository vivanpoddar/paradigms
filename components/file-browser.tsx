'use client'

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File, FileText, Image, Download, Plus, ChevronLeft, ChevronRight, Folder, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { PdfTabViewer } from "@/components/pdf-tab-viewer";
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

interface CongressBill {
  number: string;
  title: string;
  congress: number;
  type: string;
  introducedDate: string;
  url: string;
  policyArea?: string;
  sponsors?: Array<{
    bioguideId: string;
    firstName: string;
    lastName: string;
    party: string;
    state: string;
  }>;
  latestAction?: {
    actionDate: string;
    text: string;
  };
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
  const [selectedBill, setSelectedBill] = useState<CongressBill | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isFileListCollapsed, setIsFileListCollapsed] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState<'files' | 'bills'>('files');
  const [congressBills, setCongressBills] = useState<CongressBill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState<string | null>(null);
  const [loadingBillPdf, setLoadingBillPdf] = useState<string | null>(null);

  // Check if mobile
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Fetch congress bills
  const fetchCongressBills = async () => {
    setBillsLoading(true);
    setBillsError(null);
    
    try {
      // Use the API key from server-side environment
      const response = await fetch('/api/congress-bills?limit=50');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bills: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const formattedBills: CongressBill[] = data.bills?.map((bill: any) => ({
        number: bill.number,
        title: bill.title || 'No title available',
        congress: bill.congress,
        type: bill.type,
        introducedDate: bill.latestAction?.actionDate || bill.updateDate || 'Unknown',
        url: bill.url,
        policyArea: bill.policyArea?.name,
        sponsors: bill.sponsors?.map((sponsor: any) => ({
          bioguideId: sponsor.bioguideId,
          firstName: sponsor.firstName,
          lastName: sponsor.lastName,
          party: sponsor.party,
          state: sponsor.state,
        })) || [],
        latestAction: bill.latestAction
      })) || [];
      
      setCongressBills(formattedBills);
    } catch (error) {
      console.error('Error fetching congress bills:', error);
      setBillsError(error instanceof Error ? error.message : 'Failed to fetch congress bills');
    } finally {
      setBillsLoading(false);
    }
  };

  // Load congress bills when component mounts
  useEffect(() => {
    fetchCongressBills();
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
    
    // Always use tab system for PDFs
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(`${userId}/${file.name}`);

      if (error) {
        console.error('Error downloading file:', error);
        return;
      }

      const mimetype = file.metadata?.mimetype || 'application/octet-stream';
      
      if (mimetype === 'application/pdf') {
        const blob = new Blob([data], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);
        
        // Add to tab system
        if ((window as any).addPdfTab) {
          (window as any).addPdfTab(file.name, pdfUrl, file.name);
        }
        return;
      }
      
      // For non-PDF files, show in a simple viewer or handle differently
      console.log('Non-PDF file selected:', file.name);
      // You could add a simple text/image viewer here if needed
      
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const selectBill = async (bill: CongressBill) => {
    // Always use tab system for bills
    const billKey = `${bill.type}-${bill.number}-${bill.congress}`;
    setLoadingBillPdf(billKey);
    
    try {
      // Fetch bill details to get PDF URL
      const response = await fetch(
        `/api/bill-details?congress=${bill.congress}&type=${bill.type}&number=${bill.number}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bill details: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.pdfUrl) {
        const pdfProxyUrl = `/api/bill-pdf?url=${encodeURIComponent(data.pdfUrl)}`;
        const billTitle = `${bill.type.toUpperCase()} ${bill.number}`;
        const fileName = `${billTitle}.pdf`;
        
        // Add to tab system
        if ((window as any).addPdfTab) {
          (window as any).addPdfTab(billTitle, pdfProxyUrl, fileName);
        }
        
        setLoadingBillPdf(null);
        return;
      } else {
        console.log('No PDF available for this bill');
      }
    } catch (error) {
      console.error('Error fetching bill PDF:', error);
    } finally {
      setLoadingBillPdf(null);
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
      setSelectedBill(null);
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

  const getFileIcon = (mimetype: string) => {
    if (mimetype?.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimetype?.startsWith('text/')) return <FileText className="h-4 w-4" />;
    if (mimetype === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const visibleFiles = files.filter(file => !file.name.toLowerCase().endsWith('.json'));
  // const visibleFiles = files

  return (
    <div className="flex overflow-y-scroll h-full main-container">
      {/* Left Side - File List */}
      <div className={`transition-all duration-300 border-r border-border flex flex-col ${
        isFileListCollapsed
          ? 'w-12' 
          : forceShowFileList
            ? 'w-full'
            : isMobile && selectedFile 
              ? 'hidden' 
              : 'w-full lg:w-1/4'
      }`}>
        <Card className="h-full rounded-none border-0 flex flex-col">
          <CardHeader className="border-b flex-shrink-0 p-2">
            <CardTitle className="flex items-center justify-between text-sm">
              {!isFileListCollapsed && !isMobile && (
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveSection('files')}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        activeSection === 'files'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Your Files ({visibleFiles.length})
                    </button>
                    <button
                      onClick={() => setActiveSection('bills')}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        activeSection === 'bills'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Congress Bills ({congressBills.length})
                    </button>
                  </div>
                </div>
              )}
              {!isFileListCollapsed && forceShowFileList && (
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveSection('files')}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        activeSection === 'files'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Your Files ({visibleFiles.length})
                    </button>
                    <button
                      onClick={() => setActiveSection('bills')}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        activeSection === 'bills'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Congress Bills ({congressBills.length})
                    </button>
                  </div>
                </div>
              )}
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
                  {activeSection === 'files' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUpload(!showUpload)}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Upload
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={activeSection === 'files' ? refreshFiles : fetchCongressBills}
                    disabled={activeSection === 'files' ? loading : billsLoading}
                    className="h-7 text-xs"
                  >
                    {(activeSection === 'files' ? loading : billsLoading) ? 'Loading...' : 'Refresh'}
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
              title={`Click to expand file list (${visibleFiles.length} files, ${congressBills.length} bills) - Ctrl+E`}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="relative">
                  <Folder className="h-5 w-5" />
                  {(visibleFiles.length + congressBills.length) > 0 && (
                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {(visibleFiles.length + congressBills.length) > 9 ? '9+' : (visibleFiles.length + congressBills.length)}
                    </span>
                  )}
                </div>
                <div className="collapsed-panel-text">
                  Files & Bills
                </div>
              </div>
            </div>
          )}
          {!isFileListCollapsed && (
            <CardContent className="p-0 flex-1 flex flex-col">
              {showUpload && activeSection === 'files' && (
                <div className="p-4 border-b bg-muted/30 flex-shrink-0">
                  <FileUpload onUploadSuccess={refreshFiles} />
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {activeSection === 'files' ? (
                  visibleFiles.length === 0 ? (
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
                  )
                ) : (
                  // Congress Bills Section
                  billsLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground text-center">
                        Loading congress bills...
                      </p>
                    </div>
                  ) : billsError ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <p className="text-destructive text-sm mb-2">Error loading bills:</p>
                        <p className="text-muted-foreground text-xs">{billsError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchCongressBills}
                          className="mt-2"
                        >
                          Try Again
                        </Button>
                      </div>
                    </div>
                  ) : congressBills.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground text-center">
                        No congress bills available
                      </p>
                    </div>
                  ) : (
                    congressBills.map((bill, index) => {
                      const billKey = `${bill.type}-${bill.number}-${bill.congress}`;
                      const isLoading = loadingBillPdf === billKey;
                      
                      return (
                        <div
                          key={billKey}
                          className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${isLoading ? 'opacity-75' : ''}`}
                          onClick={() => !isLoading && selectBill(bill)}
                        >
                          <div className="flex items-start gap-3">
                            {isLoading ? (
                              <div className="h-4 w-4 mt-1 animate-spin rounded-full border-2 border-current border-t-transparent flex-shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 mt-1 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {bill.type.toUpperCase()} {bill.number}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {bill.congress}th Congress
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {bill.title}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {bill.latestAction ? 
                                  `Last: ${new Date(bill.latestAction.actionDate).toLocaleDateString()}` :
                                  `Introduced: ${new Date(bill.introducedDate).toLocaleDateString()}`
                                }
                              </span>
                              {bill.policyArea && (
                                <span className="text-xs bg-muted px-2 py-1 rounded">
                                  {bill.policyArea}
                                </span>
                              )}
                            </div>
                            {bill.latestAction && (
                              <p className="text-xs text-muted-foreground mt-1" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {bill.latestAction.text}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Right Side - Content Display */}
      <div className={`flex-1 flex flex-col ${
        forceShowFileList
          ? 'hidden'
          : isFileListCollapsed 
            ? '' 
            : isMobile && selectedFile 
              ? 'w-full' 
              : 'hidden lg:flex'
      }`}>
        {/* Tab View Mode - Always use tab system */}
        <PdfTabViewer
          onExplain={onExplain}
          userId={userId ?? ""}
          chatRoomName={userId ? `user-${userId}` : "default-room"}
          chatUsername={userId ?? "user"}
          selectedFileName={selectedFile?.name || selectedBill?.title || null}
          onFileRefresh={refreshFiles}
        />
      </div>
    </div>
  );
});

FileBrowser.displayName = 'FileBrowser';

