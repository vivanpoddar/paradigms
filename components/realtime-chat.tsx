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
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [completedStreamMessages, setCompletedStreamMessages] = useState<ChatMessage[]>([])

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
      
      // Clear existing history and completed stream messages when file changes
      setLoadedHistoryMessages([])
      setCompletedStreamMessages([])
      
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
        conversations.forEach((conv, index) => {
          const baseTime = new Date(conv.timestamp).getTime()
          historyMessages.push({
            id: `${conv.id}-query`,
            content: conv.query,
            user: { name: username },
            createdAt: conv.timestamp,
          })
          historyMessages.push({
            id: `${conv.id}-response`,
            content: `${conv.response}`,
            user: { name: 'Document Assistant' },
            createdAt: new Date(baseTime + 500).toISOString(), // Add 500ms to ensure proper ordering within conversation
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
    const mergedMessages = [...initialMessages, ...loadedHistoryMessages, ...realtimeMessages, ...completedStreamMessages]
    
    // Add streaming message if it exists
    if (streamingMessage) {
      mergedMessages.push(streamingMessage)
    }
    
    // Remove duplicates based on message id
    const uniqueMessages = mergedMessages.filter(
      (message, index, self) => index === self.findIndex((m) => m.id === message.id)
    )
    
    // Sort by creation date with enhanced logic for proper conversation flow
    const sortedMessages = uniqueMessages.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      
      // If timestamps are very close (within 2 seconds), ensure query comes before response
      if (Math.abs(timeA - timeB) < 2000) {
        // Check if one is a query and one is a response from the same conversation
        const aIsQuery = a.user.name === username
        const bIsQuery = b.user.name === username
        const aIsResponse = a.user.name === 'Document Assistant'
        const bIsResponse = b.user.name === 'Document Assistant'
        
        // If one is query and one is response, query should come first
        if (aIsQuery && bIsResponse) return -1
        if (bIsQuery && aIsResponse) return 1
      }
      
      return timeA - timeB
    })

    return sortedMessages
  }, [initialMessages, realtimeMessages, loadedHistoryMessages, streamingMessage, completedStreamMessages])

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
    if (!userId) {
      console.error('Cannot save conversation: userId is not available')
      return
    }
    
    if (!query || !response) {
      console.error('Cannot save conversation: query or response is empty', { query: !!query, response: !!response })
      return
    }
    
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
  const queryDocuments = useCallback(async (query: string, queryTimestamp?: string): Promise<void> => {
    console.log('=== QUERY DOCUMENTS CALLED ===');
    console.log('Query:', query);
    console.log('Selected file:', selectedFileName);
    console.log('Message history length:', allMessages.length);
    
    if (!selectedFileName) {
      console.log('❌ No file selected for querying')
      return
    }
    
    // Calculate response timestamp early so it's available throughout the function
    const responseTimestamp = queryTimestamp 
      ? new Date(new Date(queryTimestamp).getTime() + 500).toISOString() // 500ms after query
      : new Date().toISOString() // Fallback to current time
    
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

      // Create a temporary message to stream content into
      const botMessageId = crypto.randomUUID()
      
      const initialBotMessage: ChatMessage = {
        id: botMessageId,
        content: '🤖 **Document Assistant**: ',
        user: {
          name: 'Document Assistant',
        },
        createdAt: responseTimestamp,
      }

      // Set the streaming message in local state
      setStreamingMessage(initialBotMessage)
      
      let fullResponse = ''
      
      // Handle streaming response
      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line)
              
              if (data.error) {
                throw new Error(data.error)
              }
              
              if (data.content) {
                fullResponse += data.content
                // Update the streaming message with accumulated content
                setStreamingMessage(prev => prev ? {
                  ...prev,
                  content: `🤖 **Document Assistant**: ${fullResponse}`
                } : null)
              }
              
              if (data.done) {
                console.log('Streaming completed, breaking loop')
                break
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError)
            }
          }
          
          // Check if we received a done signal to break the outer loop
          if (lines.some(line => {
            try {
              const data = JSON.parse(line)
              return data.done
            } catch {
              return false
            }
          })) {
            console.log('Breaking outer streaming loop')
            break
          }
        }
        
        console.log('Streaming reader finished')
      } else {
        // Fallback for non-streaming response
        const data = await response.json()
        fullResponse = data.response
        setStreamingMessage(prev => prev ? {
          ...prev,
          content: `🤖 **Document Assistant**: ${fullResponse}`
        } : null)
      }
      
      console.log('Streaming completed, fullResponse length:', fullResponse.length)
      
      // Once streaming is complete, add the final message to completed messages and clear streaming state
      const finalBotMessage: ChatMessage = {
        id: botMessageId,
        content: `🤖 **Document Assistant**: ${fullResponse}`,
        user: {
          name: 'Document Assistant',
        },
        createdAt: responseTimestamp, // Use the same timestamp as the initial streaming message
      }
      
      // Add to completed stream messages (local state only, not broadcast)
      setCompletedStreamMessages(prev => [...prev, finalBotMessage])
      setStreamingMessage(null)
      
      // Save the complete conversation to database (query + response)
      console.log('Saving conversation - userId:', userId, 'query:', query.substring(0, 50), 'response:', fullResponse.substring(0, 50))
      await saveConversationToHistory(query, fullResponse, {
        fileName: selectedFileName,
        messageType: 'query-response'
      })
      
    } catch (error) {
      console.error('Error querying documents:', error)
      
      const errorResponse = 'Sorry, I encountered an error while searching the documents. Please try again.'
      
      // Update streaming message with error or send new error message
      if (streamingMessage) {
        const errorBotMessage: ChatMessage = {
          id: streamingMessage.id,
          content: `🤖 **Document Assistant**: ${errorResponse}`,
          user: {
            name: 'Document Assistant',
          },
          createdAt: streamingMessage.createdAt,
        }
        
        // Add to completed stream messages and clear streaming state
        setCompletedStreamMessages(prev => [...prev, errorBotMessage])
        setStreamingMessage(null)
      } else {
        // Send error message as a new completed message
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          content: `🤖 **Document Assistant**: ${errorResponse}`,
          user: {
            name: 'Document Assistant',
          },
          createdAt: responseTimestamp, // Use the calculated response timestamp
        }
        
        setCompletedStreamMessages(prev => [...prev, errorMessage])
      }
      
      // Save the error conversation to database
      console.log('Saving error conversation - userId:', userId, 'query:', query.substring(0, 50), 'errorResponse:', errorResponse)
      await saveConversationToHistory(query, errorResponse, {
        fileName: selectedFileName,
        messageType: 'query-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      console.log('Query finally block reached, setting isQuerying to false')
      setIsQuerying(false)
      setStreamingMessage(null) // Clear streaming message on completion
    }
  }, [sendMessage, selectedFileName, saveConversationToHistory, allMessages])

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim() || !isConnected) return

      const messageContent = newMessage.trim()
      const queryTimestamp = new Date().toISOString() // Capture the timestamp when query is sent
      
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
        // Pass the query timestamp to ensure proper ordering
        await queryDocuments(messageContent, queryTimestamp);
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
            onClick={() => queryDocuments(newMessage.trim(), new Date().toISOString())}
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
