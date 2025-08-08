'use client'

import { FileBrowser } from "@/components/file-browser";
import { Navbar } from "@/components/navbar";
import { RealtimeChat, RealtimeChatRef } from "@/components/realtime-chat";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageCircle, Trash2 } from "lucide-react";
import { useChatHistory } from "@/hooks/use-chat-history";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const chatRef = useRef<RealtimeChatRef>(null);

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
  
  return (
    <main className="h-screen flex flex-col">
      <div className="flex-1 w-full flex flex-col">
        <Navbar />
        <div className="flex-1 w-full min-h-0 flex">
          {/* Main content area - File Browser */}
          <div className={`flex-1 transition-all duration-300 ${isChatCollapsed ? 'w-full' : 'lg:w-3/5'} border-r border-border`}>
            <FileBrowser onFileSelect={setSelectedFileName} />
          </div>
          
          {/* Side panel - Realtime Chat */}
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
              <div className="flex-1 max-h-[89vh]">
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
        </div>
      </div>
    </main>
  );
}
