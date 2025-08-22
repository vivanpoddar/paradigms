'use client'

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, SplitSquareHorizontal, Monitor, FileText, MessageCircle } from "lucide-react";
import { PdfViewerWithOverlay } from "@/components/pdf-viewer-with-overlay";
import { RealtimeChat } from "@/components/realtime-chat";

interface PdfViewer {
  id: string;
  title: string;
  pdfUrl: string;
  userId: string;
  fileName: string;
}

interface DualPdfViewerProps {
  onExplain?: (problemText: string, solution: string) => void;
  userId: string;
  chatRoomName?: string;
  chatUsername?: string;
  onFileRefresh?: () => Promise<void>;
}

export const DualPdfViewer: React.FC<DualPdfViewerProps> = ({ 
  onExplain, 
  userId, 
  chatRoomName = "default-room",
  chatUsername = "user",
  onFileRefresh
}) => {
  const [primaryViewer, setPrimaryViewer] = useState<PdfViewer | null>(null);
  const [secondaryViewer, setSecondaryViewer] = useState<PdfViewer | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'split' | 'chat'>('single');
  const [isLargeViewport, setIsLargeViewport] = useState(false);
  
  // Track blob URLs for cleanup
  const activeBlobUrls = useRef<Set<string>>(new Set());

  // Check viewport size
  useEffect(() => {
    const checkViewportSize = () => {
      setIsLargeViewport(window.innerWidth >= 1440 && window.innerHeight >= 800);
    };

    checkViewportSize();
    window.addEventListener('resize', checkViewportSize);
    return () => window.removeEventListener('resize', checkViewportSize);
  }, []);

  // Reset view mode when viewport becomes too small
  useEffect(() => {
    if (!isLargeViewport && viewMode !== 'single') {
      setViewMode('single');
    }
  }, [isLargeViewport, viewMode]);

  const addPdf = useCallback((title: string, pdfUrl: string, fileName: string) => {
    const newViewer: PdfViewer = {
      id: Date.now().toString(),
      title,
      pdfUrl,
      userId,
      fileName
    };

    // Track blob URLs for cleanup
    if (pdfUrl.startsWith('blob:')) {
      activeBlobUrls.current.add(pdfUrl);
    }

    if (!primaryViewer) {
      setPrimaryViewer(newViewer);
    } else if (!secondaryViewer) {
      setSecondaryViewer(newViewer);
      // Auto-enable split mode if viewport is large
      if (isLargeViewport) {
        setViewMode('split');
      }
    } else {
      // Replace secondary viewer if both slots are full
      // Clean up the old blob URL if it's a local blob
      if (secondaryViewer.pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(secondaryViewer.pdfUrl);
        activeBlobUrls.current.delete(secondaryViewer.pdfUrl);
      }
      setSecondaryViewer(newViewer);
    }
  }, [primaryViewer, secondaryViewer, userId, isLargeViewport]);

  const closePrimary = useCallback(() => {
    if (primaryViewer?.pdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(primaryViewer.pdfUrl);
      activeBlobUrls.current.delete(primaryViewer.pdfUrl);
    }
    
    // Move secondary to primary if it exists
    if (secondaryViewer) {
      setPrimaryViewer(secondaryViewer);
      setSecondaryViewer(null);
      setViewMode('single');
    } else {
      setPrimaryViewer(null);
      setViewMode('single');
    }
  }, [primaryViewer, secondaryViewer]);

  const closeSecondary = useCallback(() => {
    if (secondaryViewer?.pdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(secondaryViewer.pdfUrl);
      activeBlobUrls.current.delete(secondaryViewer.pdfUrl);
    }
    setSecondaryViewer(null);
    setViewMode('single');
  }, [secondaryViewer]);

  const enableSplitMode = () => {
    if (!isLargeViewport || !primaryViewer || !secondaryViewer) return;
    setViewMode('split');
  };

  const enableChatMode = () => {
    if (!isLargeViewport || !primaryViewer) return;
    setViewMode('chat');
  };

  const disableSplitMode = () => {
    setViewMode('single');
  };

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      // Clean up all active blob URLs on unmount
      activeBlobUrls.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      activeBlobUrls.current.clear();
    };
  }, []); // Only run on mount/unmount

  // Expose method to add PDFs (for external access)
  useEffect(() => {
    (window as unknown as { addPdfTab?: typeof addPdf }).addPdfTab = addPdf;
    
    return () => {
      delete (window as unknown as { addPdfTab?: unknown }).addPdfTab;
    };
  }, [addPdf]);

  if (!primaryViewer) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No PDFs open</p>
          <p className="text-sm mb-4">Select a PDF from the file browser to open it</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Maximum 2 PDF viewers supported</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-h-screen overflow-hidden">
      {/* Control Bar */}
      <Card className="rounded-none border-0 border-b flex-shrink-0">
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {/* Primary PDF Info */}
              <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
                <span className="text-xs font-medium truncate max-w-32">{primaryViewer.title}</span>
                <button
                  className="h-4 w-4 flex items-center justify-center hover:bg-destructive/20 rounded-sm transition-colors"
                  onClick={closePrimary}
                  title="Close PDF"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Secondary PDF Info */}
              {secondaryViewer && (
                <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
                  <span className="text-xs font-medium truncate max-w-32">{secondaryViewer.title}</span>
                  <button
                    className="h-4 w-4 flex items-center justify-center hover:bg-destructive/20 rounded-sm transition-colors"
                    onClick={closeSecondary}
                    title="Close PDF"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                {secondaryViewer ? '2/2 PDFs' : '1/2 PDFs'}
              </div>
            </div>
            
            {/* View Mode Controls */}
            {isLargeViewport && (
              <div className="flex items-center gap-1 ml-2">
                <div className="text-xs text-muted-foreground mr-2">
                  {secondaryViewer ? 'Split & Chat available' : 'Chat available'}
                </div>
                <Button
                  variant={viewMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={disableSplitMode}
                  title="Single view"
                  className="h-7 w-7 p-0"
                >
                  <Monitor className="h-3 w-3" />
                </Button>
                {secondaryViewer && (
                  <Button
                    variant={viewMode === 'split' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={enableSplitMode}
                    title="Split view"
                    className="h-7 w-7 p-0"
                  >
                    <SplitSquareHorizontal className="h-3 w-3 rotate-90" />
                  </Button>
                )}
                <Button
                  variant={viewMode === 'chat' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={enableChatMode}
                  title="Chat mode"
                  className="h-7 w-7 p-0"
                >
                  <MessageCircle className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* PDF Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {viewMode === 'single' ? (
          // Single PDF View
          <Card className="h-full w-full rounded-none border-0 flex flex-col min-h-0">
            <CardContent className="p-0 h-full flex-1 min-h-0">
              <div className="h-full">
                <PdfViewerWithOverlay
                  key={primaryViewer.id}
                  pdfUrl={primaryViewer.pdfUrl}
                  user={primaryViewer.userId}
                  fileName={primaryViewer.fileName}
                  onExplain={onExplain}
                />
              </div>
            </CardContent>
          </Card>
        ) : viewMode === 'chat' ? (
          // PDF + Chat View
          <div className="h-full w-full flex flex-row min-h-0">
            {/* PDF Panel */}
            <Card className="rounded-none border-0 w-2/3 flex flex-col min-h-0 border-r">
              <CardContent className="p-0 h-full flex-1 min-h-0">
                <div className="h-full">
                  <PdfViewerWithOverlay
                    key={primaryViewer.id}
                    pdfUrl={primaryViewer.pdfUrl}
                    user={primaryViewer.userId}
                    fileName={primaryViewer.fileName}
                    onExplain={onExplain}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Chat Panel */}
            <Card className="rounded-none border-0 w-1/3 flex flex-col min-h-0">
              <CardHeader className="p-2 border-b flex-shrink-0">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Chat</span>
                  <span className="text-xs text-muted-foreground">
                    {primaryViewer.fileName ? `Context: ${primaryViewer.fileName}` : 'No context'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-full flex-1 min-h-0">
                <div className="h-full">
                  <RealtimeChat
                    roomName={chatRoomName}
                    username={chatUsername}
                    enableDocumentQuery={true}
                    selectedFileName={primaryViewer.fileName}
                    onFileRefresh={onFileRefresh}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Split Screen View (Vertical Split)
          <div className="h-full w-full flex flex-row min-h-0">
            {/* Primary PDF */}
            <Card className="rounded-none border-0 w-1/2 flex flex-col min-h-0 border-r">
              <CardHeader className="p-2 border-b flex-shrink-0">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="truncate">{primaryViewer.title}</span>
                  <span className="text-xs text-muted-foreground">PDF 1</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-full flex-1 min-h-0">
                <div className="h-full">
                  <PdfViewerWithOverlay
                    key={primaryViewer.id}
                    pdfUrl={primaryViewer.pdfUrl}
                    user={primaryViewer.userId}
                    fileName={primaryViewer.fileName}
                    onExplain={onExplain}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Secondary PDF */}
            {secondaryViewer && (
              <Card className="rounded-none border-0 w-1/2 flex flex-col min-h-0">
                <CardHeader className="p-2 border-b flex-shrink-0">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="truncate">{secondaryViewer.title}</span>
                    <span className="text-xs text-muted-foreground">PDF 2</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-full flex-1 min-h-0">
                  <div className="h-full">
                    <PdfViewerWithOverlay
                      key={secondaryViewer.id}
                      pdfUrl={secondaryViewer.pdfUrl}
                      user={secondaryViewer.userId}
                      fileName={secondaryViewer.fileName}
                      onExplain={onExplain}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
