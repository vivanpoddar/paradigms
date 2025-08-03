import { RealtimeChat } from "@/components/realtime-chat";

interface DocumentChatProps {
  username: string;
}

/**
 * Example component showing how to use RealtimeChat with document querying enabled
 */
export const DocumentChat = ({ username }: DocumentChatProps) => {
  return (
    <div className="h-full w-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">AI Assistant with Document Access</h2>
        <p className="text-sm text-muted-foreground">
          Ask questions, request analysis, or get help with tasks. The AI will search through your documents 
          and provide actionable responses. Try asking "Analyze...", "Create a plan for...", "Help me with...", 
          "What steps should I take to...", etc.
        </p>
      </div>
      <div className="flex-1 h-[calc(100%-120px)]">
        <RealtimeChat
          roomName="document-chat"
          username={username}
          enableDocumentQuery={true}
        />
      </div>
    </div>
  );
};
