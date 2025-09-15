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
import { Send, BookOpen, Loader2, X, Mic, MicOff, FileText, ChevronDown, Calculator, FileIcon, ImagePlus, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useCallback, useEffect, useMemo, useState, useImperativeHandle, forwardRef, useRef, memo } from 'react'
import { LLAMA_CLOUD_CONFIG } from '@/lib/llama-cloud-config'
import { useChatHistory } from '@/hooks/use-chat-history'
import { createClient } from '@/lib/supabase/client'
import { InlineMath, BlockMath } from 'react-katex'
import 'katex/dist/katex.min.css'
import { MathJaxContext } from 'better-react-mathjax'

// Memoized message component to prevent unnecessary re-renders
const MemoizedChatMessage = memo(({ message, isOwnMessage, showHeader }: {
  message: ChatMessage
  isOwnMessage: boolean
  showHeader: boolean
}) => (
  <div className="mobile-message-bubble">
    <ChatMessageItem
      message={message}
      isOwnMessage={isOwnMessage}
      showHeader={showHeader}
    />
  </div>
))

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
  onFileRefresh?: () => Promise<void>
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
  onFileRefresh,
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
  const [allLoadedMessages, setAllLoadedMessages] = useState<ChatMessage[]>([])
  const [displayedMessageCount, setDisplayedMessageCount] = useState(5)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [contextData, setContextData] = useState<{ problemText: string; solution: string } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isPdfMode, setIsPdfMode] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [pdfMathMode, setPdfMathMode] = useState<boolean | 'auto'>('auto')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Create a ref to access queryDocuments without making it a dependency
  const queryDocumentsRef = useRef<((query: string, images?: File[]) => Promise<void>) | null>(null)

  // Microphone hook function
  const handleMicrophoneToggle = useCallback(() => {
    console.log('Microphone button clicked, current recording state:', isRecording)
    
    if (isRecording) {
      // Stop recording
      setIsRecording(false)
      console.log('Stopping voice recording...')
      // TODO: Implement actual voice recording stop logic
    } else {
      // Start recording
      setIsRecording(true)
      console.log('Starting voice recording...')
      // TODO: Implement actual voice recording start logic
    }
  }, [isRecording])

  // PDF worksheet generation function
  const generatePdfWorksheet = useCallback(async (prompt: string) => {
    console.log('Generating PDF worksheet with prompt:', prompt)
    setIsGeneratingPdf(true)
    
    try {
      // Detect if the prompt suggests mathematical content
      let containsMath: boolean;
      if (pdfMathMode === 'auto') {
        const mathKeywords = ['math', 'algebra', 'equation', 'formula', 'calculation', 'solve', 'derivative', 'integral', 'geometry', 'trigonometry', 'calculus', 'statistics', 'probability'];
        containsMath = mathKeywords.some(keyword => 
          prompt.toLowerCase().includes(keyword)
        );
      } else {
        containsMath = pdfMathMode as boolean;
      }
      
      console.log('Math content mode:', pdfMathMode, 'detected/set:', containsMath);
      
      const response = await fetch('/api/pdf-worksheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt, 
          userId,
          containsMath 
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Get the JSON response
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate worksheet')
      }
      
      // Create download link
      const link = document.createElement('a')
      link.href = result.downloadUrl
      link.download = result.fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Add success message to chat with parsing information
      let statusMessage = `✅ PDF worksheet "${result.worksheetData.title}" generated successfully!`;
      
      if (result.parsing.success) {
        statusMessage += ` The worksheet has been processed and indexed using ${result.parsing.endpoint === '/api/mparse' ? 'math-aware parsing' : 'standard parsing'} and is now available for querying.`;
      } else if (result.parsing.error && result.parsing.error.includes('skipped')) {
        statusMessage += ` The worksheet has been uploaded to your files and is ready for use. To make it searchable, please manually parse it using the document upload feature.`;
      } else if (result.parsing.error) {
        statusMessage += ` Note: The worksheet was created but parsing failed (${result.parsing.error}). You can still download and use the PDF manually.`;
      }
      
      const successMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: statusMessage,
        user: { name: 'Document Assistant' },
        createdAt: new Date().toISOString(),
      }
      
      setAllLoadedMessages(prev => {
        const newMessages = [...prev, successMessage]
        // Ensure we can see the new message
        setDisplayedMessageCount(curr => Math.max(curr, newMessages.length))
        return newMessages
      })
      
      // Scroll to bottom to show success message
      setTimeout(() => scrollToBottom(), 100)
      
      // Refresh the file list to show the new worksheet
      if (onFileRefresh) {
        console.log('Refreshing file list after worksheet creation...');
        try {
          await onFileRefresh();
        } catch (refreshError) {
          console.error('Failed to refresh file list:', refreshError);
        }
      }
      
    } catch (error) {
      console.error('Error generating PDF worksheet:', error)
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: `❌ Sorry, I encountered an error while generating the PDF worksheet: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        user: { name: 'Document Assistant' },
        createdAt: new Date().toISOString(),
      }
      
      setAllLoadedMessages(prev => {
        const newMessages = [...prev, errorMessage]
        // Ensure we can see the new message
        setDisplayedMessageCount(curr => Math.max(curr, newMessages.length))
        return newMessages
      })
      
      // Scroll to bottom to show error message  
      setTimeout(() => scrollToBottom(), 100)
    } finally {
      setIsGeneratingPdf(false)
      setIsPdfMode(false) // Reset PDF mode after generation
      setPdfMathMode('auto') // Reset math mode to auto
    }
  }, [userId, pdfMathMode, onFileRefresh])

  // Toggle PDF mode
  const handlePdfModeToggle = useCallback(() => {
    setIsPdfMode(prev => !prev)
  }, [])

  // Handle image selection
  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length > 0) {
      addImages(imageFiles)
    }
    
    // Reset input
    event.target.value = ''
  }, [])

  // Helper function to add images
  const addImages = useCallback((imageFiles: File[]) => {
    setSelectedImages(prev => [...prev, ...imageFiles])
    
    // Create preview URLs
    const newPreviewUrls = imageFiles.map(file => URL.createObjectURL(file))
    setImagePreviewUrls(prev => [...prev, ...newPreviewUrls])
  }, [])

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only hide the overlay if we're leaving the entire chat container
    // Check if the related target is outside the current target
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Check if the dragged items contain files
    if (e.dataTransfer.types.includes('Files')) {
      // Additional check: only show overlay if there are image files
      const items = Array.from(e.dataTransfer.items)
      const hasImageFiles = items.some(item => 
        item.kind === 'file' && item.type.startsWith('image/')
      )
      if (hasImageFiles) {
        setIsDragOver(true)
      }
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length > 0) {
      addImages(imageFiles)
    }
  }, [addImages])

  // Handle paste events
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    
    if (imageItems.length > 0) {
      const imageFiles: File[] = []
      imageItems.forEach(item => {
        const file = item.getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      })
      
      if (imageFiles.length > 0) {
        addImages(imageFiles)
      }
    }
  }, [addImages])

  // Add paste event listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Remove selected image
  const removeImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviewUrls(prev => {
      const newUrls = prev.filter((_, i) => i !== index)
      // Revoke the removed URL to free memory
      if (prev[index]) {
        URL.revokeObjectURL(prev[index])
      }
      return newUrls
    })
  }, [])

  // Clear all images
  const clearImages = useCallback(() => {
    // Revoke all preview URLs to free memory
    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    setSelectedImages([])
    setImagePreviewUrls([])
  }, [imagePreviewUrls])

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
    selectedFileName: selectedFileName || 'global_chat',
  })

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    clearCurrentMessages: () => {
      setAllLoadedMessages([])
      setDisplayedMessageCount(5)
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
      setAllLoadedMessages([])
      setDisplayedMessageCount(5) // Reset to show last 5 messages
      
      // Always load history - either for specific file or global chat
      const fileContext = selectedFileName || 'global_chat'
      
      try {
        console.log('Loading chat history for context:', fileContext)
        const conversations = await loadConversations()
        console.log('Loaded conversations count:', conversations.length)
        
        // Process conversations in batches to avoid blocking UI
        const batchSize = 20  // Reduced batch size for better responsiveness
        const historyMessages: ChatMessage[] = []
        
        for (let i = 0; i < conversations.length; i += batchSize) {
          const batch = conversations.slice(i, i + batchSize)
          
          batch.forEach((conv) => {
            // Add user query
            historyMessages.push({
              id: `${conv.id}-query`,
              content: conv.query,
              user: { name: username },
              createdAt: conv.timestamp,
              images: conv.metadata?.images ? conv.metadata.images.map((img: any) => ({
                url: '', // URL not needed for display since we only show names
                name: img.name,
                size: img.size
              })) : undefined
            })
            // Add assistant response
            historyMessages.push({
              id: `${conv.id}-response`,
              content: conv.response,
              user: { name: 'Document Assistant' },
              createdAt: conv.timestamp,
            })
          })
          
          // Update UI progressively for better UX - but only set final result
          if ((i + batchSize) % 40 === 0 && i + batchSize < conversations.length) {
            await new Promise(resolve => setTimeout(resolve, 0))
          }
        }
        
        // Set all loaded messages at once
        setAllLoadedMessages(historyMessages)
        console.log('Chat history loaded successfully, messages count:', historyMessages.length)
      } catch (error) {
        console.error('Failed to load chat history:', error)
      }
    }

    loadChatHistory()
  }, [userId, loadConversations, selectedFileName, username])

  // Add new messages from realtime chat with throttling
  const addRealtimeMessagesRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (realtimeMessages.length > 0) {
      // Throttle message updates to prevent excessive re-renders
      if (addRealtimeMessagesRef.current) {
        clearTimeout(addRealtimeMessagesRef.current)
      }
      
      addRealtimeMessagesRef.current = setTimeout(() => {
        setAllLoadedMessages(prev => {
          const newMessages = realtimeMessages.filter(
            realtimeMsg => !prev.some(prevMsg => prevMsg.id === realtimeMsg.id)
          )
          if (newMessages.length > 0) {
            // Ensure we show new messages by increasing display count if needed
            const totalMessages = prev.length + newMessages.length
            setDisplayedMessageCount(curr => Math.max(curr, 5)) // Always show at least last 5
            return [...prev, ...newMessages]
          }
          return prev
        })
      }, 50) // Small delay to batch updates
    }
  }, [realtimeMessages])

  // Merge messages with initial messages and add streaming message if exists
  const allMessages = useMemo(() => {
    const baseMessages = [...initialMessages, ...allLoadedMessages]
    
    // Add streaming message at the end if it exists
    if (streamingMessage) {
      baseMessages.push(streamingMessage)
    }
    
    // Remove duplicates based on message id while preserving order
    const seenIds = new Set<string>()
    const uniqueMessages = baseMessages.filter(message => {
      if (seenIds.has(message.id)) {
        return false
      }
      seenIds.add(message.id)
      return true
    })

    // Return only the last displayedMessageCount messages for performance
    return uniqueMessages.slice(-displayedMessageCount)
  }, [initialMessages, allLoadedMessages, streamingMessage, displayedMessageCount])

  // Memoize the message count to avoid recalculating
  const messageCount = useMemo(() => allMessages.length, [allMessages])

  // Debounced scroll to bottom to prevent excessive scrolling
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const debouncedScrollToBottom = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      scrollToBottom()
    }, 100)
  }, [scrollToBottom])

  // Handle scroll to top for loading more messages
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isLoadingMore) return
    
    const container = containerRef.current
    const scrollTop = container.scrollTop
    const totalMessages = [...initialMessages, ...allLoadedMessages].length
    
    // If scrolled to top and there are more messages to load
    if (scrollTop <= 100 && displayedMessageCount < totalMessages) {
      setIsLoadingMore(true)
      
      // Load 5 more messages
      setTimeout(() => {
        setDisplayedMessageCount(prev => Math.min(prev + 5, totalMessages))
        setIsLoadingMore(false)
        
        // Maintain scroll position after adding messages
        setTimeout(() => {
          if (container) {
            container.scrollTop = 200 // Keep user slightly away from top
          }
        }, 50)
      }, 300) // Small delay to show loading state
    }
  }, [containerRef, isLoadingMore, displayedMessageCount, initialMessages, allLoadedMessages])

  // Add scroll listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (onMessage) {
      onMessage(allMessages)
    }
  }, [allMessages, onMessage])

  useEffect(() => {
    // Only scroll when messages change and not during streaming
    if (!streamingMessage && allMessages.length > 0) {
      debouncedScrollToBottom()
    }
  }, [allMessages.length, streamingMessage, debouncedScrollToBottom])

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
    if (!enableDocumentQuery) {
      console.log('Document query disabled')
      return false
    }
    
    // Always allow querying - if no file is selected, use global chat
    const shouldQuery = message.trim().length > 0
    console.log('Should query result:', shouldQuery, 'for message:', message.substring(0, 50))
    console.log('Selected file:', selectedFileName || 'global_chat')
    return shouldQuery
  }, [enableDocumentQuery])

  // Function to query documents using LlamaCloudIndex
  const queryDocuments = useCallback(async (query: string, images: File[] = []): Promise<void> => {
    console.log('=== QUERY DOCUMENTS CALLED ===');
    console.log('Query:', query);
    console.log('Selected file:', selectedFileName || 'global_chat');
    console.log('Images:', images.length);
    console.log('Message history length:', messageCount);
    
    console.log('✅ Starting query with context:', selectedFileName || 'global_chat');
    setIsQuerying(true)
    
    // Convert images to base64
    const imageData: string[] = []
    if (images.length > 0) {
      for (const image of images) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result as string
              // Remove data URL prefix to get just the base64 data
              const base64Data = result.split(',')[1]
              resolve(base64Data)
            }
            reader.onerror = reject
            reader.readAsDataURL(image)
          })
          imageData.push(base64)
        } catch (error) {
          console.error('Error converting image to base64:', error)
        }
      }
    }
    
    // Get current message history at execution time instead of dependency
    const currentMessages = allMessages
    
    const enhancedQuery = selectedFileName ? `You are a patient and knowledgeable homework tutor. You have access to two sources of information: 1. Your own general knowledge. 2. Retrieved excerpts from the provided documents (retrieval-augmented generation).
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

    IMPORTANT: When including mathematical expressions in your responses always use LaTeX syntax.

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
      ` : query
    try {
      const apiEndpoint = selectedFileName ? '/api/query' : '/api/global-chat'
      console.log('📤 Sending request to', apiEndpoint);
      
      const requestBody = selectedFileName 
        ? { 
            query: enhancedQuery, 
            fileName: selectedFileName,
            messageHistory: currentMessages,
            multiModal: images.length > 0,
            images: imageData
          }
        : {
            query: enhancedQuery,
            messageHistory: currentMessages,
            multiModal: images.length > 0,
            images: imageData
          }
      
      console.log('📋 Request body details:');
      console.log('- Query length:', enhancedQuery.length);
      console.log('- Context:', selectedFileName || 'global_chat');
      console.log('- Message history count:', currentMessages.length);
      console.log('- Multi-modal:', images.length > 0);
      console.log('- Images count:', imageData.length);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
          name: selectedFileName ? 'Document Assistant' : 'AI Assistant',
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
          name: selectedFileName ? 'Document Assistant' : 'AI Assistant',
        },
        createdAt: new Date().toISOString(),
      }
      
      // Add to messages array
      setAllLoadedMessages(prev => {
        const newMessages = [...prev, finalBotMessage]
        // Ensure we can see the new message
        setDisplayedMessageCount(curr => Math.max(curr, newMessages.length))
        return newMessages
      })
      setStreamingMessage(null)
      
      // Scroll to bottom after streaming is complete
      setTimeout(() => scrollToBottom(), 100)
      
      // Save the complete conversation to database (query + response)
      console.log('Saving conversation - userId:', userId, 'query:', query.substring(0, 50), 'response:', fullResponse.substring(0, 50))
      await saveConversationToHistory(query, fullResponse, {
        fileName: selectedFileName || 'global_chat',
        messageType: 'query-response',
        images: images.length > 0 ? images.map(image => ({
          name: image.name,
          size: image.size,
          type: image.type
        })) : undefined
      })
      
    } catch (error) {
      console.error('Error querying documents:', error)
      
      const errorResponse = selectedFileName 
        ? 'Sorry, I encountered an error while searching the documents. Please try again.'
        : 'Sorry, I encountered an error while processing your request. Please try again.'
      
      // Create error message
      const errorMessage: ChatMessage = {
        id: streamingMessage?.id || crypto.randomUUID(),
        content: errorResponse,
        user: {
          name: selectedFileName ? 'Document Assistant' : 'AI Assistant',
        },
        createdAt: new Date().toISOString(),
      }
      
      // Add error message to messages array
      setAllLoadedMessages(prev => {
        const newMessages = [...prev, errorMessage]
        // Ensure we can see the new message
        setDisplayedMessageCount(curr => Math.max(curr, newMessages.length))
        return newMessages
      })
      setIsQuerying(false)
      setStreamingMessage(null)
      
      // Scroll to bottom to show error message
      setTimeout(() => scrollToBottom(), 100)
      
      // Save the error conversation to database
      console.log('Saving error conversation - userId:', userId, 'query:', query.substring(0, 50), 'errorResponse:', errorResponse)
      await saveConversationToHistory(query, errorResponse, {
        fileName: selectedFileName || 'global_chat',
        messageType: 'query-error',
        error: error instanceof Error ? error.message : 'Unknown error',
        images: images.length > 0 ? images.map(image => ({
          name: image.name,
          size: image.size,
          type: image.type
        })) : undefined
      })
    } finally {
      console.log('Query finally block reached')
      // Ensure isQuerying is false (backup in case it wasn't set in try/catch)
      setIsQuerying(false)
    }
  }, [selectedFileName, saveConversationToHistory, contextData, userId])

  // Update the ref whenever queryDocuments changes
  useEffect(() => {
    queryDocumentsRef.current = queryDocuments
  }, [queryDocuments])

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if ((!newMessage.trim() && selectedImages.length === 0) || !isConnected) return

      const messageContent = newMessage.trim()
      
      // Clear input immediately for better UX
      setNewMessage('')
      
      // Create user message and add it to messages immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        content: messageContent,
        user: { name: username },
        createdAt: new Date().toISOString(),
        images: selectedImages.length > 0 ? selectedImages.map((file, index) => ({
          url: '', // URL not needed for display since we only show names
          name: file.name,
          size: file.size
        })) : undefined
      }
      
      // Add user message to messages array
      setAllLoadedMessages(prev => {
        const newMessages = [...prev, userMessage]
        // Ensure we can see the new message
        setDisplayedMessageCount(curr => Math.max(curr, newMessages.length))
        return newMessages
      })

      // Check if we're in PDF mode
      if (isPdfMode) {
        console.log('=== PDF WORKSHEET MODE ===');
        console.log('Generating PDF worksheet with prompt:', messageContent);
        await generatePdfWorksheet(messageContent);
        return;
      }

      // Check if we should query documents for this message
      const shouldQuery = shouldQueryDocuments(messageContent) || selectedImages.length > 0;
      console.log('=== MESSAGE SENT ===');
      console.log('Message:', messageContent);
      console.log('Images selected:', selectedImages.length);
      console.log('Should query documents:', shouldQuery);
      console.log('Selected file:', selectedFileName);
      console.log('Enable document query:', enableDocumentQuery);
      
      if (shouldQuery) {
        console.log('🔍 Triggering document query...');
        // Use a small delay to ensure user message appears first and input is responsive
        setTimeout(() => {
          queryDocumentsRef.current?.(messageContent || "What do you see in this image?", selectedImages);
        }, 10); // Minimal delay for better responsiveness
      } else {
        console.log('⚠️ Not triggering document query');
      }

      // Clear images after sending message
      if (selectedImages.length > 0) {
        clearImages();
      }
    },
    [newMessage, isConnected, shouldQueryDocuments, selectedFileName, enableDocumentQuery, username, isPdfMode, generatePdfWorksheet, selectedImages, imagePreviewUrls]
  )

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      if (addRealtimeMessagesRef.current) {
        clearTimeout(addRealtimeMessagesRef.current)
      }
      // Cleanup preview URLs
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [imagePreviewUrls])

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
      <div 
        className="flex flex-col h-full w-full bg-background text-foreground antialiased mobile-chat-container relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 z-50 flex items-center justify-center">
            <div className="text-center">
              <ImagePlus className="w-12 h-12 text-blue-500 mx-auto mb-2" />
              <div className="text-lg font-medium text-blue-700 dark:text-blue-300">
                Drop images here
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Release to upload
              </div>
            </div>
          </div>
        )}

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
                <div>Welcome to AI Assistant!</div>
                <div>Ask me anything - I'm here to help with homework, explanations, and learning!</div>
              </>
            )}
          </div>
        ) : null}
        <div className="space-y-1">
          {/* Show load more indicator at the top */}
          {(() => {
            const totalMessages = [...initialMessages, ...allLoadedMessages].length
            const hasMoreMessages = displayedMessageCount < totalMessages
            
            return hasMoreMessages && (
              <div className="text-center py-2">
                {isLoadingMore ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading more messages...</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Scroll to top to load more messages ({totalMessages - displayedMessageCount} remaining)
                  </div>
                )}
              </div>
            )
          })()}
          
          {allMessages.map((message, index) => {
            const prevMessage = index > 0 ? allMessages[index - 1] : null
            const showHeader = !prevMessage || prevMessage.user.name !== message.user.name

            return (
              <div
                key={message.id}
                className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              >
                <MemoizedChatMessage
                  message={message}
                  isOwnMessage={message.user.name === username}
                  showHeader={showHeader}
                />
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
                      <span>{selectedFileName ? "I'm searching your document..." : "I'm thinking..."}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading spinner while generating PDF worksheet */}
          {isGeneratingPdf && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mobile-message-bubble">
                <div className="flex items-start gap-3 p-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>I'm generating your PDF worksheet...</span>
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
                    {contextData.problemText.split(/(\$[^$]+\$|\\\([^]*?\\\)|\\\[[^]*?\\\])/g).map((part, i) => {
                      if (part.startsWith('$') && part.endsWith('$')) {
                        return <InlineMath key={i} math={part.slice(1, -1)} />
                      } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
                        return <InlineMath key={i} math={part.slice(2, -2)} />
                      } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
                        return <BlockMath key={i} math={part.slice(2, -2)} />
                      } else {
                        return <span key={i}>{part}</span>
                      }
                    })}
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

      {/* PDF Mode Indicator */}
      {isPdfMode && (
        <div className="border-t border-border bg-white dark:bg-black p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-sm font-medium text-blue-700 ">
                  Selected
                </div>
                <div className="text-xs text-blue-600">
                  PDF Generation
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsPdfMode(false)}
              className="p-1 rounded-sm hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
              title="Exit PDF mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Image Preview Section */}
      {selectedImages.length > 0 && (
        <div className="border-t border-border bg-gray-50 dark:bg-gray-900/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Selected Images ({selectedImages.length})
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearImages}
              className="text-red-600 hover:text-red-700 h-6 px-2"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {imagePreviewUrls.map((url, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="w-16 h-16 object-cover rounded border border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex w-full border-t gap-2 border-border p-4 mobile-chat-input bg-background">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Image Upload Button */}
        <Button
          type="button"
          onClick={openFilePicker}
          className="aspect-square rounded-full flex-shrink-0 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          disabled={!isConnected || isQuerying || isGeneratingPdf}
          title="Upload images (or drag & drop, paste)"
        >
          <ImagePlus className="size-4" />
        </Button>
        <Input
          className={cn(
            'rounded-full bg-background transition-all duration-300 text-base lg:text-sm',
            isPdfMode && 'border-blue-500 focus:border-blue-600'
          )}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={
            isPdfMode
              ? "Describe the worksheet you want to create..."
              : enableDocumentQuery 
                ? selectedFileName 
                  ? selectedImages.length > 0
                    ? `Ask about ${selectedFileName} with ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}...`
                    : `Ask about ${selectedFileName}...`
                  : selectedImages.length > 0
                    ? `Ask anything with ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}...`
                    : "Ask me anything..." 
                : selectedImages.length > 0
                  ? `Type a message with ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}...`
                  : "Type a message..."
          }
          disabled={!isConnected || isQuerying || isGeneratingPdf}
          autoComplete="off"
          spellCheck="false"
        />
        
        {/* Main Send/Generate Button */}
        {isConnected && (newMessage.trim() || selectedImages.length > 0) && (
          <Button
            className={cn(
              "aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300 flex-shrink-0",
              isPdfMode && "bg-blue-500 hover:bg-blue-600"
            )}
            type="submit"
            disabled={!isConnected || isQuerying || isGeneratingPdf || (!newMessage.trim() && selectedImages.length === 0)}
            title={isPdfMode ? "Generate PDF worksheet" : "Send message"}
          >
            {isGeneratingPdf ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPdfMode ? (
              <FileText className="size-4" />
            ) : isQuerying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        )}

        {/* Features Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              className={cn(
                "aspect-square rounded-full flex-shrink-0 transition-all duration-300",
                "bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              )}
              disabled={!isConnected || isQuerying || isGeneratingPdf}
              title="More features"
            >
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Options</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={handlePdfModeToggle}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                isPdfMode && "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
              )}
            >
              <FileText className="size-4" />
              <span>
                {isPdfMode ? "Exit PDF Mode" : "Create PDF Worksheet"}
              </span>
              {isPdfMode && <span className="ml-auto text-xs">Active</span>}
            </DropdownMenuItem>
            
            {isPdfMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Parsing Mode</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setPdfMathMode('auto')}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    pdfMathMode === 'auto' && "bg-gray-50 dark:bg-gray-800"
                  )}
                >
                  <FileIcon className="size-4" />
                  <span>Auto-detect Math</span>
                  {pdfMathMode === 'auto' && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setPdfMathMode(true)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    pdfMathMode === true && "bg-gray-50 dark:bg-gray-800"
                  )}
                >
                  <Calculator className="size-4" />
                  <span>Force Math Parsing</span>
                  {pdfMathMode === true && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setPdfMathMode(false)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    pdfMathMode === false && "bg-gray-50 dark:bg-gray-800"
                  )}
                >
                  <FileText className="size-4" />
                  <span>Force Standard Parsing</span>
                  {pdfMathMode === false && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Microphone Button */}
        {/* <Button
          type="button"
          onClick={handleMicrophoneToggle}
          className={cn(
            "aspect-square rounded-full flex-shrink-0 transition-all duration-300",
            isRecording
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
              : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-white text-gray-600 dark:text-gray-400"
          )}
          disabled={!isConnected || isQuerying || isGeneratingPdf}
          title={isRecording ? "Stop recording" : "Start voice recording"}
        >
          {isRecording ? (
            <MicOff className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button> */}
      </form>
    </div>
    </MathJaxContext>
  )
})
