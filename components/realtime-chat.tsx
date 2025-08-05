'use client'

import { cn } from '@/lib/utils'
import { ChatMessageItem } from '@/components/chat-message'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import {
  type ChatMessage,
  useRealtimeChat,
} from '@/hooks/use-realtime-chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, BookOpen, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LLAMA_CLOUD_CONFIG } from '@/lib/llama-cloud-config'

interface RealtimeChatProps {
  roomName: string
  username: string
  onMessage?: (messages: ChatMessage[]) => void
  messages?: ChatMessage[]
  enableDocumentQuery?: boolean
  selectedFileName?: string | null
}

/**
 * Realtime chat component
 * @param roomName - The name of the room to join. Each room is a unique chat.
 * @param username - The username of the user
 * @param onMessage - The callback function to handle the messages. Useful if you want to store the messages in a database.
 * @param messages - The messages to display in the chat. Useful if you want to display messages from a database.
 * @param enableDocumentQuery - Whether to enable document querying using LlamaCloudIndex
 * @param selectedFileName - The name of the currently selected file to query against
 * @returns The chat component
 */
export const RealtimeChat = ({
  roomName,
  username,
  onMessage,
  messages: initialMessages = [],
  enableDocumentQuery = false,
  selectedFileName = null,
}: RealtimeChatProps) => {
  const { containerRef, scrollToBottom } = useChatScroll()

  const {
    messages: realtimeMessages,
    sendMessage,
    isConnected,
  } = useRealtimeChat({
    roomName,
    username,
  })
  const [newMessage, setNewMessage] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)

  // Merge realtime messages with initial messages
  const allMessages = useMemo(() => {
    const mergedMessages = [...initialMessages, ...realtimeMessages]
    // Remove duplicates based on message id
    const uniqueMessages = mergedMessages.filter(
      (message, index, self) => index === self.findIndex((m) => m.id === message.id)
    )
    // Sort by creation date
    const sortedMessages = uniqueMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    return sortedMessages
  }, [initialMessages, realtimeMessages])

  useEffect(() => {
    if (onMessage) {
      onMessage(allMessages)
    }
  }, [allMessages, onMessage])

  useEffect(() => {
    // Scroll to bottom whenever messages change
    scrollToBottom()
  }, [allMessages, scrollToBottom])

  // Function to detect if a message should trigger document query
  const shouldQueryDocuments = useCallback((message: string): boolean => {
    if (!enableDocumentQuery || !selectedFileName) return false
    
    const lowerMessage = message.toLowerCase()
    return LLAMA_CLOUD_CONFIG.queryTriggers.some(trigger => lowerMessage.includes(trigger))
  }, [enableDocumentQuery, selectedFileName])

  // Function to query documents using LlamaCloudIndex
  const queryDocuments = useCallback(async (query: string): Promise<void> => {
    console.log('=== QUERY DOCUMENTS CALLED ===');
    console.log('Query:', query);
    console.log('Selected file:', selectedFileName);
    
    if (!selectedFileName) {
      console.log('❌ No file selected for querying')
      return
    }
    
    console.log('✅ Starting query with file:', selectedFileName);
    setIsQuerying(true)
    try {
      console.log('📤 Sending request to /api/query');
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, fileName: selectedFileName }),
      })

      console.log('📥 Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Send the AI response as a message from a bot user
      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: `🤖 **Document Assistant**: ${data.response}`,
        user: {
          name: 'Document Assistant',
        },
        createdAt: new Date().toISOString(),
      }

      // Add bot message to local state (this will be broadcast to other users)
      sendMessage(botMessage.content)
      
    } catch (error) {
      console.error('Error querying documents:', error)
      
      // Send error message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: `🤖 **Document Assistant**: Sorry, I encountered an error while searching the documents. Please try again.`,
        user: {
          name: 'Document Assistant',
        },
        createdAt: new Date().toISOString(),
      }
      
      sendMessage(errorMessage.content)
    } finally {
      setIsQuerying(false)
    }
  }, [sendMessage, selectedFileName])

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim() || !isConnected) return

      const messageContent = newMessage.trim()
      
      // Send the user message first
      sendMessage(messageContent)
      setNewMessage('')

      // Check if we should query documents for this message
      const shouldQuery = shouldQueryDocuments(messageContent);
      console.log('=== MESSAGE SENT ===');
      console.log('Message:', messageContent);
      console.log('Should query documents:', shouldQuery);
      console.log('Selected file:', selectedFileName);
      console.log('Enable document query:', enableDocumentQuery);
      
      if (shouldQuery) {
        console.log('🔍 Triggering document query...');
        await queryDocuments(messageContent);
      } else {
        console.log('⚠️ Not triggering document query');
      }
    },
    [newMessage, isConnected, sendMessage, queryDocuments, shouldQueryDocuments]
  )

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground antialiased">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        ) : null}
        <div className="space-y-1">
          {allMessages.map((message, index) => {
            const prevMessage = index > 0 ? allMessages[index - 1] : null
            const showHeader = !prevMessage || prevMessage.user.name !== message.user.name

            return (
              <div
                key={message.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              >
                <ChatMessageItem
                  message={message}
                  isOwnMessage={message.user.name === username}
                  showHeader={showHeader}
                />
              </div>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="flex w-full gap-2 border-t border-border p-4">
        <Input
          className={cn(
            'rounded-full bg-background text-sm transition-all duration-300',
            isConnected && newMessage.trim() ? 'w-[calc(100%-80px)]' : 'w-full'
          )}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={
            enableDocumentQuery 
              ? selectedFileName 
                ? `Ask about ${selectedFileName}...` 
                : "Select a file to query documents..." 
              : "Type a message..."
          }
          disabled={!isConnected || isQuerying}
        />
        
        {/* Document query button */}
        {enableDocumentQuery && isConnected && newMessage.trim() && (
          <Button
            type="button"
            variant="outline"
            className="aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300"
            onClick={() => queryDocuments(newMessage.trim())}
            disabled={!isConnected || isQuerying}
            title="Query documents"
          >
            {isQuerying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BookOpen className="size-4" />
            )}
          </Button>
        )}
        
        {/* Send button */}
        {isConnected && newMessage.trim() && (
          <Button
            className="aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300"
            type="submit"
            disabled={!isConnected || isQuerying}
          >
            <Send className="size-4" />
          </Button>
        )}
      </form>
    </div>
  )
}
