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
import { Send, BookOpen, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useImperativeHandle, forwardRef } from 'react'
import { LLAMA_CLOUD_CONFIG } from '@/lib/llama-cloud-config'
import { useChatHistory } from '@/hooks/use-chat-history'
import { createClient } from '@/lib/supabase/client'
import { InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import { MathJaxContext } from 'better-react-mathjax'

export interface RealtimeChatRef {
  clearCurrentMessages: () => void;
  openExplainContext: (problemText: string, solution: string) => void;
}

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
export const RealtimeChat = forwardRef<RealtimeChatRef, RealtimeChatProps>(({
  roomName,
  username,
  onMessage,
  messages: initialMessages = [],
  enableDocumentQuery = false,
  selectedFileName = null,
}, ref) => {
  const { containerRef, scrollToBottom } = useChatScroll()

  const {
    messages: realtimeMessages,
    sendMessage: sendRealtimeMessage,
    isConnected,
  } = useRealtimeChat({
    roomName,
    username,
  })
  const [newMessage, setNewMessage] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [contextData, setContextData] = useState<{ problemText: string; solution: string } | null>(null)

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
  const { saveConversation, loadConversations, clearHistory, isLoading: isLoadingHistory } = useChatHistory({
    userId: userId || '',
    selectedFileName,
  })

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    clearCurrentMessages: () => {
      setMessages([])
      setStreamingMessage(null)
      setContextData(null)
    },
    openExplainContext: (problemText: string, solution: string) => {
      // Set the context data to be displayed above the input
      setContextData({ problemText, solution })
    }
  }), [])

  // Load chat history when component mounts or when file selection changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!userId) return
      
      // Clear existing messages when file changes
      setMessages([])
      
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
          // Add user query
          historyMessages.push({
            id: `${conv.id}-query`,
            content: conv.query,
            user: { name: username },
            createdAt: conv.timestamp,
          })
          // Add assistant response
          historyMessages.push({
            id: `${conv.id}-response`,
            content: conv.response,
            user: { name: 'Document Assistant' },
            createdAt: conv.timestamp,
          })
        })
        setMessages(historyMessages)
        console.log('Chat history loaded successfully, messages count:', historyMessages.length)
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    }

    loadChatHistory()
  }, [userId, loadConversations, selectedFileName, username])

  // Add new messages from realtime chat
  useEffect(() => {
    if (realtimeMessages.length > 0) {
      setMessages(prev => {
        const newMessages = realtimeMessages.filter(
          realtimeMsg => !prev.some(prevMsg => prevMsg.id === realtimeMsg.id)
        )
        return [...prev, ...newMessages]
      })
    }
  }, [realtimeMessages])

  // Merge messages with initial messages and add streaming message if exists
  const allMessages = useMemo(() => {
    let finalMessages = [...initialMessages, ...messages]
    
    // Add streaming message at the end if it exists
    if (streamingMessage) {
      finalMessages.push(streamingMessage)
    }
    
    // Remove duplicates based on message id while preserving order
    const uniqueMessages = finalMessages.filter(
      (message, index, self) => index === self.findIndex((m) => m.id === message.id)
    )

    return uniqueMessages
  }, [initialMessages, messages, streamingMessage])

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
    if (!enableDocumentQuery || !selectedFileName) {
      console.log('Document query disabled or no file selected:', { enableDocumentQuery, selectedFileName })
      return false
    }
    
    // For now, let's query documents for any message (you can add more specific logic later)
    const shouldQuery = message.trim().length > 0
    console.log('Should query documents result:', shouldQuery, 'for message:', message.substring(0, 50))
    return shouldQuery
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
    
    const enhancedQuery = `You are a patient and knowledgeable homework tutor. You have access to two sources of information: 1. Your own general knowledge. 2. Retrieved excerpts from the provided documents (retrieval-augmented generation).
    Your primary role:
    Explain concepts and reasoning so the student can solve the problem themselves, keeping in mind the previous conversation history.
    Use your own knowledge as the main source.
    Use retrieved document excerpts only to clarify terms or provide additional context — never to copy or reproduce a solution directly.
    Rules:
    - Break down explanations step-by-step and clearly define any terms.
    - Provide examples or analogies where possible to aid understanding.
    - Encourage the student to attempt steps themselves after understanding the concept.
    - If you reference a retrieved chunk, explain how it supports the concept instead of quoting large sections verbatim.
    - Keep your responses concise and focused on the student's understanding.
    Goal:
    By the end of your answer, the student should understand the “why” and “how” behind solving the problem, and be able to complete it independently. 

    IMPORTANT: When including mathematical expressions in your responses:
    - Use $expression$ for inline math (e.g., $x^2 + y^2 = z^2$)
    - Use $$expression$$ for block/display math (e.g., $$\\int_0^1 x^2 dx$$)
    - Always wrap mathematical expressions with dollar signs for proper LaTeX rendering
    - Use proper LaTeX syntax (e.g., \\frac{a}{b} for fractions, \\sqrt{x} for square roots, etc.)

    Current user request:
    ${query}

      ${contextData ? `
      --- Context Information ---
      Related Question:
      ${contextData.problemText}

      Related Solution:
      ${contextData.solution}
      --------------------------
      ` : ''}
      `
    try {
      console.log('📤 Sending request to /api/query');
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: enhancedQuery, 
          fileName: selectedFileName,
          messageHistory: allMessages
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
        content: '',
        user: {
          name: 'Document Assistant',
        },
        createdAt: new Date().toISOString(),
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
                  content: fullResponse
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
          content: fullResponse
        } : null)
      }
      
      console.log('Streaming completed, fullResponse length:', fullResponse.length)
      
      // Set isQuerying to false before clearing streaming message to prevent spinner flash
      setIsQuerying(false)
      
      // Once streaming is complete, add the final message to messages and clear streaming state
      const finalBotMessage: ChatMessage = {
        id: botMessageId,
        content: fullResponse,
        user: {
          name: 'Document Assistant',
        },
        createdAt: new Date().toISOString(),
      }
      
      // Add to messages array
      setMessages(prev => [...prev, finalBotMessage])
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
      
      // Create error message
      const errorMessage: ChatMessage = {
        id: streamingMessage?.id || crypto.randomUUID(),
        content: errorResponse,
        user: {
          name: 'Document Assistant',
        },
        createdAt: new Date().toISOString(),
      }
      
      // Add error message to messages array
      setMessages(prev => [...prev, errorMessage])
      setIsQuerying(false)
      setStreamingMessage(null)
      
      // Save the error conversation to database
      console.log('Saving error conversation - userId:', userId, 'query:', query.substring(0, 50), 'errorResponse:', errorResponse)
      await saveConversationToHistory(query, errorResponse, {
        fileName: selectedFileName,
        messageType: 'query-error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      console.log('Query finally block reached')
      // Ensure isQuerying is false (backup in case it wasn't set in try/catch)
      setIsQuerying(false)
    }
  }, [selectedFileName, saveConversationToHistory, allMessages, contextData, userId, streamingMessage])

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim() || !isConnected) return

      const messageContent = newMessage.trim()
      
      // Create user message and add it to messages immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: messageContent,
        user: { name: username },
        createdAt: new Date().toISOString(),
      }
      
      // Add user message to messages array
      setMessages(prev => [...prev, userMessage])
      
      // Clear input
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
        // Use a small delay to ensure user message appears first
        setTimeout(() => {
          queryDocuments(messageContent);
        }, 100);
      } else {
        console.log('⚠️ Not triggering document query');
      }
    },
    [newMessage, isConnected, queryDocuments, shouldQueryDocuments, selectedFileName, enableDocumentQuery, username]
  )

  const mathJaxConfig = {
    loader: { load: ["[tex]/html"] },
    tex: {
      packages: { "[+]": ["html"] },
      inlineMath: [
        ["$", "$"],
        ["\\(", "\\)"]
      ],
      displayMath: [
        ["$$", "$$"],
        ["\\[", "\\]"]
      ],
      processEscapes: true,
      processEnvironments: true
    },
    options: {
      enableMenu: false
    }
  }

  return (
    <MathJaxContext config={mathJaxConfig}>
      <div className="flex flex-col h-full w-full bg-background text-foreground antialiased mobile-chat-container">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4 mobile-chat-messages mobile-scroll">
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
                <div className="mobile-message-bubble">
                  <ChatMessageItem
                    message={message}
                    isOwnMessage={message.user.name === username}
                    showHeader={showHeader}
                  />
                </div>
              </div>
            )
          })}
          
          {/* Loading spinner while LLM is generating response */}
          {isQuerying && !streamingMessage && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mobile-message-bubble">
                <div className="flex items-start gap-3 p-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>I'm searching your document...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Display Area */}
      {contextData && (
        <div className="border-t border-border bg-gray-50 dark:bg-gray-900/20 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="space-y-2">
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Problem</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border">
                    {contextData.problemText.split(/(\$[^$]+\$)/g).map((part, i) =>
                      part.startsWith('$') && part.endsWith('$')
                        ? <InlineMath key={i} math={part.slice(1, -1)} />
                        : <span key={i}>{part}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Solution</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded border max-h-20 overflow-y-auto">
                    {contextData.solution}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setContextData(null)}
              className="ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Clear context"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex w-full border-t gap-2 border-border p-4 mobile-chat-input bg-background">
        <Input
          className={cn(
            'rounded-full bg-background transition-all duration-300 text-base lg:text-sm'
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
        
        {enableDocumentQuery && isConnected && newMessage.trim() && (
          <Button
            className="aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300 flex-shrink-0"
            type="submit"
            disabled={!isConnected || isQuerying}
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
    </MathJaxContext>
  )
})
