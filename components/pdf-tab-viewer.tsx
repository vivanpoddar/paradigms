'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, SplitSquareHorizontal, Monitor, FileText, MessageCircle } from "lucide-react";
import { PdfViewerWithOverlay } from "@/components/pdf-viewer-with-overlay";
import { RealtimeChat } from "@/components/realtime-chat";

interface PdfTab {
  id: string;
  title: string;
  pdfUrl: string;
  userId: string;
  fileName: string;
  // Extraction-related data
  bucketName?: string;
  uploadPath?: string;
}

interface PdfTabViewerProps {
  onExplain?: (problemText: string, solution: string) => void;
  userId: string;
  chatRoomName?: string;
  chatUsername?: string;
  selectedFileName?: string | null;
  onFileRefresh?: () => Promise<void>;
}

export const PdfTabViewer: React.FC<PdfTabViewerProps> = ({ 
  onExplain, 
  userId, 
  chatRoomName = "default-room",
  chatUsername = "user",
  selectedFileName,
  onFileRefresh
}) => {
  const [tabs, setTabs] = useState<PdfTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [splitScreenMode, setSplitScreenMode] = useState<'single' | 'vertical' | 'chat'>('single');
  const [splitTabIds, setSplitTabIds] = useState<[string, string] | null>(null);
  const [isLargeViewport, setIsLargeViewport] = useState(false);
  const [chatContext, setChatContext] = useState<string | null>(null);

  // Check viewport size
  useEffect(() => {
    const checkViewportSize = () => {
      setIsLargeViewport(window.innerWidth >= 1440 && window.innerHeight >= 800);
    };

    checkViewportSize();
    window.addEventListener('resize', checkViewportSize);
    return () => window.removeEventListener('resize', checkViewportSize);
  }, []);

  // Reset split mode when viewport becomes too small
  useEffect(() => {
    if (!isLargeViewport && splitScreenMode !== 'single') {
      setSplitScreenMode('single');
      setSplitTabIds(null);
    }
  }, [isLargeViewport, splitScreenMode]);

  // Update chat context when active tab changes
  useEffect(() => {
    const activeTab = getActiveTab();
    setChatContext(activeTab ? activeTab.fileName : null);
  }, [activeTabId, tabs]);

  const addTab = (title: string, pdfUrl: string, fileName: string, bucketName?: string, uploadPath?: string) => {
    const newTab: PdfTab = {
      id: Date.now().toString(),
      title,
      pdfUrl,
      userId,
      fileName,
      bucketName,
      uploadPath
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    
    // If this is the second tab and viewport is large, suggest split mode
    if (tabs.length === 1 && isLargeViewport) {
      // Auto-enable split mode with first two tabs
      setSplitScreenMode('vertical');
      setSplitTabIds([tabs[0].id, newTab.id]);
    }
  };

  const closeTab = (tabId: string) => {
    setTabs(prev => {
      const tabToClose = prev.find(tab => tab.id === tabId);
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // Clean up blob URL if it's a local blob
      if (tabToClose && tabToClose.pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(tabToClose.pdfUrl);
      }
      
      // Handle active tab logic
      setActiveTabId(currentActive => {
        if (currentActive === tabId) {
          return newTabs.length > 0 ? newTabs[0].id : null;
        }
        return currentActive;
      });

      // Handle split screen logic
      setSplitTabIds(currentSplit => {
        if (currentSplit && (currentSplit[0] === tabId || currentSplit[1] === tabId)) {
          setSplitScreenMode('single');
          
          // Set active tab to the remaining one in split
          const remainingTabId = currentSplit[0] === tabId ? currentSplit[1] : currentSplit[0];
          if (newTabs.find(tab => tab.id === remainingTabId)) {
            setActiveTabId(remainingTabId);
          }
          return null;
        }
        return currentSplit;
      });

      // Also reset chat mode if needed
      if (splitScreenMode === 'chat') {
        setSplitScreenMode('single');
      }

      return newTabs;
    });
  };

  const enableSplitMode = () => {
    if (!isLargeViewport || tabs.length < 2) return;

    setSplitScreenMode('vertical');
    
    // Use active tab and first available other tab
    const otherTab = tabs.find(tab => tab.id !== activeTabId);
    if (activeTabId && otherTab) {
      setSplitTabIds([activeTabId, otherTab.id]);
    } else if (tabs.length >= 2) {
      setSplitTabIds([tabs[0].id, tabs[1].id]);
      setActiveTabId(tabs[0].id);
    }
  };

  const enableChatMode = () => {
    if (!isLargeViewport || tabs.length < 1) return;
    
    setSplitScreenMode('chat');
    setSplitTabIds(null); // Clear PDF split tabs when in chat mode
  };

  const disableSplitMode = () => {
    setSplitScreenMode('single');
    setSplitTabIds(null);
  };

  const switchSplitTab = (position: 0 | 1, newTabId: string) => {
    if (!splitTabIds) return;
    
    const newSplitTabIds: [string, string] = [...splitTabIds];
    newSplitTabIds[position] = newTabId;
    setSplitTabIds(newSplitTabIds);
  };

  const getActiveTab = () => tabs.find(tab => tab.id === activeTabId);
  const getSplitTabs = () => {
    if (!splitTabIds) return [null, null];
    return [
      tabs.find(tab => tab.id === splitTabIds[0]) || null,
      tabs.find(tab => tab.id === splitTabIds[1]) || null
    ];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all blob URLs when component unmounts
      tabs.forEach(tab => {
        if (tab.pdfUrl.startsWith('blob:')) {
          URL.revokeObjectURL(tab.pdfUrl);
        }
      });
      
      // Clean up global reference
      delete (window as any).addPdfTab;
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + T for new tab (prevent default browser behavior when possible)
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && tabs.length > 0) {
        e.preventDefault();
      }
      
      // Ctrl/Cmd + W to close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w' && activeTabId) {
        e.preventDefault();
        closeTab(activeTabId);
      }
      
      // Ctrl/Cmd + 1-9 to switch tabs
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        const tabIndex = parseInt(e.key) - 1;
        if (tabs[tabIndex]) {
          e.preventDefault();
          setActiveTabId(tabs[tabIndex].id);
        }
      }
      
      // Ctrl/Cmd + Shift + S for split screen toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S' && isLargeViewport && tabs.length >= 2) {
        e.preventDefault();
        if (splitScreenMode === 'single') {
          enableSplitMode();
        } else {
          disableSplitMode();
        }
      }
      
      // Ctrl/Cmd + Shift + C for chat mode toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C' && isLargeViewport && tabs.length >= 1) {
        e.preventDefault();
        if (splitScreenMode === 'chat') {
          disableSplitMode();
        } else {
          enableChatMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [tabs, activeTabId, splitScreenMode, isLargeViewport]);

  // Expose method to add tabs (can be called from parent)
  useEffect(() => {
    // Store reference to addTab in window for external access
    (window as any).addPdfTab = addTab;
    
    return () => {
      delete (window as any).addPdfTab;
    };
  }, [tabs.length, isLargeViewport]);

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No PDFs open</p>
          <p className="text-sm mb-4">Select a PDF from the file browser to open it in a tab</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + W</kbd> Close tab</p>
            <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + 1-9</kbd> Switch tabs</p>
            <p><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl/Cmd + Shift + S</kbd> Toggle split view</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-h-screen overflow-hidden">
      {/* Tab Bar */}
      <Card className="rounded-none border-0 border-b flex-shrink-0">
        <CardHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
              {tabs.map(tab => (
                <Button
                  key={tab.id}
                  variant={
                    splitScreenMode === 'single' 
                      ? (activeTabId === tab.id ? 'default' : 'ghost')
                      : splitScreenMode === 'chat'
                      ? (activeTabId === tab.id ? 'default' : 'ghost')
                      : (splitTabIds?.includes(tab.id) ? 'default' : 'ghost')
                  }
                  size="sm"
                  className="flex items-center gap-2 min-w-0 max-w-48"
                  onClick={() => setActiveTabId(tab.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    // For now, just close the tab on right-click
                    closeTab(tab.id);
                  }}
                  title={`${tab.title} (${tab.fileName}) - Ctrl/Cmd + ${tabs.indexOf(tab) + 1}. Right-click to close.`}
                >
                  <span className="truncate text-xs">{tab.title}</span>
                  <button
                    className="h-4 w-4 ml-1 flex items-center justify-center hover:bg-destructive/20 rounded-sm transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      closeTab(tab.id);
                    }}
                    title="Close tab"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Button>
              ))}
            </div>
            
            {/* Split Screen Controls */}
            {isLargeViewport && tabs.length >= 1 && (
              <div className="flex items-center gap-1 ml-2">
                <div className="text-xs text-muted-foreground mr-2">
                  {tabs.length >= 2 ? 'Split & Chat available' : 'Chat available'}
                </div>
                <Button
                  variant={splitScreenMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={disableSplitMode}
                  title="Single view"
                  className="h-7 w-7 p-0"
                >
                  <Monitor className="h-3 w-3" />
                </Button>
                {tabs.length >= 2 && (
                  <Button
                    variant={splitScreenMode === 'vertical' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => enableSplitMode()}
                    title="Split vertically (Ctrl/Cmd + Shift + S)"
                    className="h-7 w-7 p-0"
                  >
                    <SplitSquareHorizontal className="h-3 w-3 rotate-90" />
                  </Button>
                )}
                <Button
                  variant={splitScreenMode === 'chat' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => enableChatMode()}
                  title="Chat mode (Ctrl/Cmd + Shift + C)"
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
        {splitScreenMode === 'single' ? (
          // Single PDF View
          <Card className="h-full w-full rounded-none border-0 flex flex-col min-h-0">
            <CardContent className="p-0 h-full flex-1 min-h-0">
              {getActiveTab() && (
                <div className="h-full">
                  <PdfViewerWithOverlay
                    key={getActiveTab()!.id} // Unique key for each tab
                    pdfUrl={getActiveTab()!.pdfUrl}
                    user={getActiveTab()!.userId}
                    fileName={getActiveTab()!.fileName}
                    bucketName={getActiveTab()!.bucketName}
                    uploadPath={getActiveTab()!.uploadPath}
                    userId={getActiveTab()!.userId}
                    onExplain={onExplain}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : splitScreenMode === 'chat' ? (
          // PDF + Chat View
          <div className="h-full w-full flex flex-row min-h-0">
            {/* PDF Panel */}
            <Card className="rounded-none border-0 w-2/3 flex flex-col min-h-0 border-r">
              <CardContent className="p-0 h-full flex-1 min-h-0">
                {getActiveTab() && (
                  <div className="h-full">
                    <PdfViewerWithOverlay
                      key={getActiveTab()!.id}
                      pdfUrl={getActiveTab()!.pdfUrl}
                      user={getActiveTab()!.userId}
                      fileName={getActiveTab()!.fileName}
                      bucketName={getActiveTab()!.bucketName}
                      uploadPath={getActiveTab()!.uploadPath}
                      userId={getActiveTab()!.userId}
                      onExplain={onExplain}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Chat Panel */}
            <Card className="rounded-none border-0 w-1/3 flex flex-col min-h-0">
              <CardHeader className="p-2 border-b flex-shrink-0">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Chat</span>
                  <span className="text-xs text-muted-foreground">
                    {chatContext ? `Context: ${chatContext}` : 'No context'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-full flex-1 min-h-0">
                <div className="h-full">
                  <RealtimeChat
                    roomName={chatRoomName}
                    username={chatUsername}
                    enableDocumentQuery={true}
                    selectedFileName={chatContext}
                    onFileRefresh={onFileRefresh}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Split Screen View (Vertical Split)
          <div className="h-full w-full flex flex-row min-h-0">
            {getSplitTabs().map((tab, index) => (
              <Card 
                key={index} 
                className={`rounded-none border-0 w-1/2 flex flex-col min-h-0 ${index === 0 ? 'border-r' : ''}`}
              >
                <CardHeader className="p-2 border-b flex-shrink-0">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <select
                      value={tab?.id || ''}
                      onChange={(e) => switchSplitTab(index as 0 | 1, e.target.value)}
                      className="bg-transparent border-none text-sm font-medium cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                    >
                      {tabs.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-muted-foreground">
                      Panel {index + 1}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 h-full flex-1 min-h-0">
                  {tab && (
                    <div className="h-full">
                      <PdfViewerWithOverlay
                        key={tab.id} // Unique key for each split panel
                        pdfUrl={tab.pdfUrl}
                        user={tab.userId}
                        fileName={tab.fileName}
                        bucketName={tab.bucketName}
                        uploadPath={tab.uploadPath}
                        userId={tab.userId}
                        onExplain={onExplain}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
