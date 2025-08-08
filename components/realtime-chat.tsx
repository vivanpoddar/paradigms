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
import { useChatHistory } from '@/hooks/use-chat-history'
import { createClient } from '@/lib/supabase/client'

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
  const [userId, setUserId] = useState<string | null>(null)
  const [loadedHistoryMessages, setLoadedHistoryMessages] = useState<ChatMessage[]>([])

  // Get user ID from Supabase
  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUser()
  }, [])

  // Initialize chat history hook
  const { saveConversation, loadConversations, isLoading: isLoadingHistory } = useChatHistory({
    userId: userId || '',
    selectedFileName,
  })

  // Load chat history when component mounts or when file selection changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!userId) return
      
      // Clear existing history when file changes
      setLoadedHistoryMessages([])
      
      // Only load history if a file is selected
      if (!selectedFileName) {
        console.log('No file selected, chat history cleared')
        return
      }
      
      try {
        console.log('Loading chat history for file:', selectedFileName)
        const conversations = await loadConversations()
        console.log('Loaded conversations count:', conversations.length)
        
        // Convert conversations to chat messages format
        const historyMessages: ChatMessage[] = []
        conversations.forEach((conv) => {
          // Add user query message
          historyMessages.push({
            id: `${conv.id}-query`,
            content: conv.query,
            user: { name: username },
            createdAt: conv.timestamp,
          })
          // Add bot response message
          historyMessages.push({
            id: `${conv.id}-response`,
            content: `🤖 **Document Assistant**: ${conv.response}`,
            user: { name: 'Document Assistant' },
            createdAt: new Date(new Date(conv.timestamp).getTime() + 1000).toISOString(), // Add 1 second to ensure proper ordering
          })
        })
        setLoadedHistoryMessages(historyMessages)
        console.log('Chat history loaded successfully, messages count:', historyMessages.length)
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    }

    loadChatHistory()
  }, [userId, loadConversations, selectedFileName, username])

  // Merge realtime messages with initial messages and loaded history
  const allMessages = useMemo(() => {
    const mergedMessages = [...initialMessages, ...loadedHistoryMessages, ...realtimeMessages]
    // Remove duplicates based on message id
    const uniqueMessages = mergedMessages.filter(
      (message, index, self) => index === self.findIndex((m) => m.id === message.id)
    )
    // Sort by creation date
    const sortedMessages = uniqueMessages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    return sortedMessages
  }, [initialMessages, realtimeMessages, loadedHistoryMessages])

  useEffect(() => {
    if (onMessage) {
      onMessage(allMessages)
    }
  }, [allMessages, onMessage])

  useEffect(() => {
    // Scroll to bottom whenever messages change
    scrollToBottom()
  }, [allMessages, scrollToBottom])

  // Save new conversations to database (query + response pairs)
  const saveConversationToHistory = useCallback(async (query: string, response: string, metadata: Record<string, any> = {}) => {
    if (!userId) return
    
    try {
      await saveConversation(query, response, metadata)
    } catch (error) {
      console.error('Failed to save conversation to history:', error)
    }
  }, [userId, saveConversation])

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
    console.log('Message history length:', allMessages.length);
    
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
        body: JSON.stringify({ 
          query, 
          fileName: selectedFileName,
          messageHistory: allMessages // Include message history for context
        }),
      })

      console.log('📥 Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const responseText = data.response
      
      // Send the AI response as a message from a bot user
      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: `🤖 **Document Assistant**: ${responseText}`,
        user: {
          name: 'Document Assistant',
        },
        createdAt: new Date().toISOString(),
      }

      // Add bot message to local state (this will be broadcast to other users)
      sendMessage(botMessage.content)
      
      // Save the complete conversation to database (query + response)
      await saveConversationToHistory(query, responseText, {
        fileName: selectedFileName,
        messageType: 'query-response'
      })
      
    } catch (error) {
      console.error('Error querying documents:', error)
      
      const errorResponse = 'Sorry, I encountered an error while searching the documents. Please try again.'
      
      // Send error message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: `🤖 **Document Assistant**: ${errorResponse}`,
        user: {
          name: 'Document Assistant',
        },
        createdAt: new Date().toISOString(),
      }
      
      sendMessage(errorMessage.content)
      
      // Save the error conversation to database
      await saveConversationToHistory(query, errorResponse, {
        fileName: selectedFileName,
        messageType: 'query-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsQuerying(false)
    }
  }, [sendMessage, selectedFileName, saveConversationToHistory, allMessages])

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim() || !isConnected) return

      const messageContent = newMessage.trim()
      
      // Send the user message
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
        // The conversation will be saved in queryDocuments function
        await queryDocuments(messageContent);
      } else {
        console.log('⚠️ Not triggering document query');
        // For non-query messages, we could optionally save them separately
        // or handle them differently based on your requirements
      }
    },
    [newMessage, isConnected, sendMessage, queryDocuments, shouldQueryDocuments]
  )

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground antialiased">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="text-center text-sm text-muted-foreground">
            <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
            Loading chat history...
          </div>
        ) : allMessages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground space-y-2">
            {selectedFileName ? (
              <>
                <div>No previous conversations for <span className="font-medium">{selectedFileName}</span></div>
                <div>Start by asking a question about this document!</div>
              </>
            ) : (
              <>
                <div>Select a document to view its chat history</div>
                <div>and start asking questions about it!</div>
              </>
            )}
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

      <form onSubmit={handleSendMessage} className="flex w-full border-t gap-2 border-border p-4">
        <Input
          className={cn(
            'rounded-full bg-background text-sm transition-all duration-300'
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
        
        {enableDocumentQuery && isConnected && newMessage.trim() && isConnected && newMessage.trim() && (
          <Button
            className="aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300"
            type="submit"
            disabled={!isConnected || isQuerying}
            onClick={() => queryDocuments(newMessage.trim())}
            title="Query documents"
          >
            {isQuerying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        )}
      </form>
    </div>
  )
}
