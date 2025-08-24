'use client'

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { File as FileIcon, FileText, Image, Download, Plus, ChevronLeft, ChevronRight, Folder, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { DualPdfViewer } from "@/components/dual-pdf-viewer";
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
  const [processingBill, setProcessingBill] = useState<string | null>(null);
  const [billSearchQuery, setBillSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CongressBill[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCongress, setSelectedCongress] = useState<string>('119'); // Default to current congress
  const [selectedBillType, setSelectedBillType] = useState<string>('all');
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<string>('30');

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

  // Search bills from the entire congressional database
  const searchCongressBills = async (query: string, congress?: string, billType?: string) => {
    // For bill type filtering, we need a congress selection due to API structure
    if (billType !== 'all' && congress === 'all') {
      setBillsError('Please select a specific Congress session when filtering by bill type');
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (!query.trim() && congress === 'all' && billType === 'all') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setBillsError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (query.trim()) {
        // Check if it's a bill number pattern (e.g., "HR 1234", "S 567")
        const billNumberMatch = query.trim().match(/^(HR|H\.R\.|S|S\.)[\s]*(\d+)$/i);
        if (billNumberMatch) {
          const type = billNumberMatch[1].replace('.', '').toLowerCase();
          const number = billNumberMatch[2];
          params.append('billNumber', number);
          params.append('billType', type);
          // For specific bill lookup, use current congress if not specified
          params.append('congress', (congress && congress !== 'all') ? congress : '119');
        } else {
          params.append('search', query);
        }
      }
      
      if (congress && congress !== 'all') {
        params.append('congress', congress);
      }
      
      if (billType && billType !== 'all') {
        params.append('type', billType);
      }
      
      params.append('limit', '100');
      
      const response = await fetch(`/api/congress-bills?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to search bills: ${response.status} ${response.statusText}`);
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
      
      setSearchResults(formattedBills);
    } catch (error) {
      console.error('Error searching congress bills:', error);
      setBillsError(error instanceof Error ? error.message : 'Failed to search congress bills');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };  // Load congress bills when component mounts
  useEffect(() => {
    fetchCongressBills();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchCongressBills(billSearchQuery, selectedCongress, selectedBillType);
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [billSearchQuery, selectedCongress, selectedBillType]);

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
    
    // Use dual PDF viewer for PDFs
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
        
        // Add to dual PDF viewer
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
    // Use dual PDF viewer for bills
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
        
        // Add to dual PDF viewer
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

  const processBill = async (bill: CongressBill) => {
    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    const billKey = `${bill.type}-${bill.number}-${bill.congress}`;
    
    // Prevent processing if another bill is already being processed
    if (processingBill) {
      console.log('Another bill is already being processed. Please wait...');
      return;
    }

    setProcessingBill(billKey);
    
    try {
      // First, get the bill details to obtain the PDF URL
      const detailsResponse = await fetch(
        `/api/bill-details?congress=${bill.congress}&type=${bill.type}&number=${bill.number}`
      );
      
      if (!detailsResponse.ok) {
        throw new Error(`Failed to fetch bill details: ${detailsResponse.status}`);
      }
      
      const detailsData = await detailsResponse.json();
      
      if (detailsData.error || !detailsData.pdfUrl) {
        throw new Error('No PDF URL available for this bill');
      }

      // Create a form data object to send to the nparse API
      const formData = new FormData();
      
      // We need to fetch the PDF and convert it to a file for the nparse API
      const pdfResponse = await fetch(`/api/bill-pdf?url=${encodeURIComponent(detailsData.pdfUrl)}`);
      
      if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
      }
      
      const pdfBlob = await pdfResponse.blob();
      const billFileName = `${bill.type}_${bill.number}_${bill.congress}.pdf`;
      const pdfFile = new File([pdfBlob], billFileName, { type: 'application/pdf' });
      
      formData.append('file', pdfFile);
      formData.append('fileName', billFileName);

      // Send to nparse API for processing
      const processResponse = await fetch('/api/nparse', {
        method: 'POST',
        body: formData
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || `Processing failed: ${processResponse.status}`);
      }

      const processData = await processResponse.json();
      console.log('✅ Bill processed successfully:', processData);
      
      // Optionally refresh files to show the newly processed bill
      await refreshFiles();
      
    } catch (error) {
      console.error('❌ Error processing bill:', error);
      // You might want to show a toast notification here
    } finally {
      setProcessingBill(null);
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
    return <FileIcon className="h-4 w-4" />;
  };

  const visibleFiles = files.filter(file => !file.name.toLowerCase().endsWith('.json'));
  
  // Determine which bills to display
  const displayedBills = (billSearchQuery.trim() || selectedCongress !== '119' || selectedBillType !== 'all') ? searchResults : congressBills;
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
        <Card className="h-full rounded-none border-0 flex flex-col ">
          <CardHeader className="border-b flex-shrink-0 p-2 bg-[#FF5100] dark:bg-[#702300]">
            <CardTitle className="flex items-center justify-between text-sm">
              {!isFileListCollapsed && !isMobile && (
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveSection('files')}
                      className="h-7 text-xs"
                    >
                      Files ({visibleFiles.length})
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setActiveSection('bills')}
                      className={`text-xs h-7
                      }`}
                    >
                      Bills
                    </Button>
                  </div>
                </div>
              )}
              {!isFileListCollapsed && forceShowFileList && (
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    <Button
                      variant='outline'
                      onClick={() => setActiveSection('files')}
                      className={` transition-colors ${
                        activeSection === 'files'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Your Files ({visibleFiles.length})
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => setActiveSection('bills')}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        activeSection === 'bills'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      Congress Bills ({billSearchQuery.trim() ? `${displayedBills.length} results` : congressBills.length})
                    </Button>
                  </div>
                </div>
              )}
              {isFileListCollapsed && !isMobile && (
                <div className="flex justify-center w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFileListCollapsed(!isFileListCollapsed)}
                    className="h-7 w-7 p-0"
                    title={isFileListCollapsed ? "Expand file list (Ctrl+E)" : "Collapse file list (Ctrl+E)"}
                  >
                    {isFileListCollapsed ? <ChevronRight className="h-10 w-4" /> : <ChevronLeft className="h-10 w-4" />}
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
                      className="h-7 w-7 p-0 hidden lg:flex"
                      title={isFileListCollapsed ? "Expand file list (Ctrl+E)" : "Collapse file list (Ctrl+E)"}
                    >
                      {isFileListCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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
                  File Manager
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
              {activeSection === 'bills' && (
                <div className="p-4 border-b bg-muted/30 flex-shrink-0">
                  <div className="space-y-3">
                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={isSearching ? "Searching..." : "Search bills by title, sponsor, or enter exact bill number (e.g. 'HR 1234')..."}
                        value={billSearchQuery}
                        onChange={(e) => setBillSearchQuery(e.target.value)}
                        disabled={isSearching}
                        className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                      />
                      {isSearching && (
                        <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      )}
                      {billSearchQuery && !isSearching && (
                        <button
                          onClick={() => setBillSearchQuery('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    {/* Filters Row */}
                    <div className="flex gap-3">
                      {/* Congress Session Filter */}
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Congress Session
                        </label>
                        <select
                          value={selectedCongress}
                          onChange={(e) => setSelectedCongress(e.target.value)}
                          disabled={isSearching}
                          className="w-full px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        >
                          <option value="all">All Sessions</option>
                          {Array.from({ length: 119 - 93 + 1 }, (_, i) => {
                            const congressNum = 119 - i;
                            return (
                              <option key={congressNum} value={congressNum}>
                                {congressNum}th
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      
                      {/* Bill Type Filter */}
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Bill Type {selectedBillType !== 'all' && selectedCongress === 'all' && (
                            <span className="text-orange-500">*Requires Congress selection</span>
                          )}
                        </label>
                        <select
                          value={selectedBillType}
                          onChange={(e) => setSelectedBillType(e.target.value)}
                          disabled={isSearching}
                          className="w-full px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        >
                          <option value="all">All Types</option>
                          <option value="hr">House Bills (HR)</option>
                          <option value="s">Senate Bills (S)</option>
                          <option value="hjres">House Joint Resolutions</option>
                          <option value="sjres">Senate Joint Resolutions</option>
                          <option value="hconres">House Concurrent Resolutions</option>
                          <option value="sconres">Senate Concurrent Resolutions</option>
                          <option value="hres">House Simple Resolutions</option>
                          <option value="sres">Senate Simple Resolutions</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex-1 max-h-[90vh] overflow-y-auto">
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
                  ) : displayedBills.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground text-center">
                        {(billSearchQuery.trim() || selectedCongress !== '119' || selectedBillType !== 'all') 
                          ? 'No bills match your search criteria' 
                          : 'No congress bills available'
                        }
                      </p>
                    </div>
                  ) : (
                    displayedBills.map((bill, index) => {
                      const billKey = `${bill.type}-${bill.number}-${bill.congress}`;
                      const isLoading = loadingBillPdf === billKey;
                      const isProcessing = processingBill === billKey;
                      const isAnyProcessing = processingBill !== null;
                      
                      return (
                        <div
                          key={billKey}
                          className={`p-4 border-b transition-colors hover:bg-muted/50 ${(isLoading || isProcessing) ? 'opacity-75' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            {isLoading ? (
                              <div className="h-4 w-4 mt-1 animate-spin rounded-full border-2 border-current border-t-transparent flex-shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 mt-1 flex-shrink-0" />
                            )}
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => !isLoading && !isProcessing && selectBill(bill)}
                            >
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
                          <div className="flex gap-1 ml-auto flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                processBill(bill);
                              }}
                              disabled={isAnyProcessing}
                              title={isAnyProcessing ? "Processing another bill..." : "Process bill with Document AI"}
                              className="h-7 w-7 p-0"
                            >
                              {isProcessing ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                            </Button>
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

      <div className='flex-1 flex flex-col'>
        <DualPdfViewer
          onExplain={onExplain}
          userId={userId ?? ""}
          chatRoomName={userId ? `user-${userId}` : "default-room"}
          chatUsername={userId ?? "user"}
          onFileRefresh={refreshFiles}
          isBillsActive={activeSection === 'bills'}
        />
      </div>
    </div>
  );
});

FileBrowser.displayName = 'FileBrowser';

