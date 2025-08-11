'use client'

import { FileBrowser } from "@/components/file-browser";
import { Navbar } from "@/components/navbar";
import { RealtimeChat, RealtimeChatRef } from "@/components/realtime-chat";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageCircle, Trash2, Menu, X, FileText } from "lucide-react";
import { useChatHistory } from "@/hooks/use-chat-history";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const chatRef = useRef<RealtimeChatRef>(null);
  
  // Mobile state management
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileFileBrowser, setShowMobileFileBrowser] = useState(false);

  // Initialize chat history hook
  const { clearHistory, isLoading: isClearingHistory } = useChatHistory({
    userId: user?.id || '',
    selectedFileName,
  });

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Check if mobile and handle resize
  useEffect(() => {
    const checkIsMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      
      // Reset mobile panels when switching to desktop
      if (!mobile) {
        setShowMobileFileBrowser(false);
      }
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          setIsChatCollapsed(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClearHistory = async () => {
    if (!user?.id) return;
    
    try {
      await clearHistory();
      // Clear current chat contents immediately
      chatRef.current?.clearCurrentMessages();
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  const handleExplain = (problemText: string, solution: string) => {
    // Expand chat if it's collapsed
    if (isChatCollapsed) {
      setIsChatCollapsed(false);
    }
    
    // On mobile, chat is already visible by default
    // Just close file browser if it's open
    if (isMobile && showMobileFileBrowser) {
      setShowMobileFileBrowser(false);
    }
    
    // Open the explanation context in chat
    chatRef.current?.openExplainContext(problemText, solution);
  };

  const handleMobileFileBrowserToggle = () => {
    setShowMobileFileBrowser(!showMobileFileBrowser);
  };
  
  return (
    <main className="h-screen max-h-[100vh] overflow-hidden flex flex-col main-container mobile-viewport-fix">
      <div className="flex-1 w-full flex flex-col">
        <Navbar />
        
        {/* Mobile Navigation Buttons */}
        {isMobile && (
          <div className="flex justify-between items-center p-2 bg-muted/30 border-b lg:hidden flex-shrink-0">
            <Button
              variant={showMobileFileBrowser ? "default" : "ghost"}
              size="sm"
              onClick={handleMobileFileBrowserToggle}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Files
            </Button>
            
            <div className="text-xs text-center flex-1 px-4">
              {selectedFileName ? (
                <span className="font-medium truncate block">{selectedFileName}</span>
              ) : (
                <span className="text-muted-foreground">Select a document</span>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              disabled={isClearingHistory}
              className="flex items-center gap-2"
              title="Clear chat history"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="flex-1 w-full min-h-0 flex relative">
          {/* Mobile File Browser Overlay */}
          {isMobile && showMobileFileBrowser && (
            <div className="absolute inset-0 z-20 bg-background mobile-overlay mobile-viewport-fix">
              <div className="h-full flex flex-col mobile-panel mobile-viewport-fix">
                <div className="flex items-center justify-between p-2 border-b bg-muted/30 flex-shrink-0">
                  <h2 className="text-sm font-semibold">File Browser</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMobileFileBrowser(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 mobile-scroll">
                  <FileBrowser 
                    forceShowFileList={true}
                    onFileSelect={(fileName) => {
                      setSelectedFileName(fileName);
                      setShowMobileFileBrowser(false); // Close after selection
                    }} 
                    onExplain={handleExplain} 
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Mobile: Show Chat by Default */}
          {isMobile ? (
            <div className="w-full flex flex-col flex-1 min-h-0 mobile-viewport-fix">
              <div className="flex-1 max-h-[100vh] overflow-y-hidden min-h-0 mobile-chat-container overflow-hidden">
                <RealtimeChat 
                  ref={chatRef}
                  roomName="general-chat" 
                  username={user?.email?.split('@')[0] || 'anonymous'}
                  enableDocumentQuery={true}
                  selectedFileName={selectedFileName}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Layout - Main content area - File Browser */}
              <div className={`flex-1 transition-all duration-300 ${isChatCollapsed ? 'w-full' : 'lg:w-3/5'} border-r border-border`}>
                <FileBrowser onFileSelect={setSelectedFileName} onExplain={handleExplain} />
              </div>
              
              {/* Desktop Layout - Side panel - Realtime Chat */}
              <div className={`transition-all duration-300 flex flex-col ${isChatCollapsed ? 'w-12' : 'w-full lg:w-2/5'}`}>
                <div className={`border-b border-border p-2 bg-muted/30 flex items-center ${isChatCollapsed ? 'justify-center' : 'justify-between'}`}>
                  {!isChatCollapsed && (
                    <div>
                      <h2 className="text-xs font-semibold">AI Assistant</h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedFileName ? (
                          <>Chat with <span className="font-medium">{selectedFileName}</span></>
                        ) : (
                          'Select a document to start chatting'
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {!isChatCollapsed && selectedFileName && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearHistory}
                        disabled={isClearingHistory}
                        className="h-5 w-5 p-0"
                        title="Clear chat history"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                      className="h-5 w-5 p-0"
                      title={isChatCollapsed ? "Expand chat (Ctrl+B)" : "Collapse chat (Ctrl+B)"}
                    >
                      {isChatCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                {isChatCollapsed && (
                  <div 
                    className="flex-1 flex flex-col items-center justify-start pt-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setIsChatCollapsed(false)}
                    title="Click to expand chat (Ctrl+B)"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <MessageCircle className="h-5 w-5" />
                      <div className="collapsed-panel-text">
                        Chat
                      </div>
                    </div>
                  </div>
                )}
                {!isChatCollapsed && (
                  <div className="flex-1 max-h-[89vh] overflow-y-scroll">
                    <RealtimeChat
                      ref={chatRef}
                      roomName="general-chat" 
                      username={user?.email?.split('@')[0] || 'anonymous'}
                      enableDocumentQuery={true}
                      selectedFileName={selectedFileName}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
