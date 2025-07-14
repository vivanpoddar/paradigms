'use client'

import { FileBrowser } from "@/components/file-browser";
import { Navbar } from "@/components/navbar";
import { RealtimeChat } from "@/components/realtime-chat";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);
  
  return (
    <main className="h-screen flex flex-col">
      <div className="flex-1 w-full flex flex-col">
        <Navbar />
        <div className="flex-1 w-full min-h-0 flex">
          {/* Main content area - File Browser */}
          <div className={`flex-1 transition-all duration-300 ${isChatCollapsed ? 'w-full' : 'lg:w-3/5'} border-r border-border`}>
            <FileBrowser />
          </div>
          
          {/* Side panel - Realtime Chat */}
          <div className={`transition-all duration-300 flex flex-col ${isChatCollapsed ? 'w-12' : 'w-full lg:w-2/5'}`}>
            <div className="border-b border-border p-3 bg-muted/30 flex items-center justify-between">
              {!isChatCollapsed && (
                <div>
                  <h2 className="text-sm font-semibold">Team Chat</h2>
                  <p className="text-xs text-muted-foreground">Collaborate on files</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                {!isChatCollapsed && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-muted-foreground">Online</span>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                  className="h-6 w-6 p-0"
                >
                  {isChatCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {!isChatCollapsed && (
              <div className="flex-1 min-h-0">
                <RealtimeChat 
                  roomName="general-chat" 
                  username={user?.email?.split('@')[0] || 'anonymous'}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
