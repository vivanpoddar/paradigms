import { useState, useCallback, useRef } from 'react'

interface Conversation {
  id: string
  userId: string
  fileName: string | null
  query: string
  response: string
  timestamp: string
  metadata: Record<string, any>
}

interface UseChatHistoryProps {
  userId: string
  selectedFileName?: string | null
}

export const useChatHistory = ({ userId, selectedFileName }: UseChatHistoryProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, Conversation[]>>(new Map())
  const lastSaveRef = useRef<number>(0)

  const getCacheKey = (fileName: string | null | undefined) => fileName || 'no-file'

  const saveConversation = useCallback(async (query: string, response: string, metadata: Record<string, any> = {}) => {
    // Throttle save operations to prevent excessive API calls
    const now = Date.now()
    if (now - lastSaveRef.current < 500) {
      return
    }
    lastSaveRef.current = now

    try {
      setError(null)
      console.log('useChatHistory saveConversation called with:', {
        userId,
        query: query.substring(0, 50),
        response: response.substring(0, 50),
        selectedFileName,
        metadata
      })
      
      const response_data = await fetch('/api/chat-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          query,
          response,
          selectedFileName,
          metadata,
        }),
      })

      if (!response_data.ok) {
        const errorData = await response_data.json()
        throw new Error(errorData.error || 'Failed to save conversation')
      }

      // Invalidate cache for this file
      const cacheKey = getCacheKey(selectedFileName)
      cacheRef.current.delete(cacheKey)

      return await response_data.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save conversation'
      setError(errorMessage)
      console.error('Error saving conversation:', err)
      throw err
    }
  }, [userId, selectedFileName])

  const loadConversations = useCallback(async (): Promise<Conversation[]> => {
    const cacheKey = getCacheKey(selectedFileName)
    
    // Return cached data if available
    if (cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey) || []
    }

    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        userId,
      })

      if (selectedFileName) {
        params.append('fileName', selectedFileName)
      }

      const response = await fetch(`/api/chat-history?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load conversations')
      }

      const data = await response.json()
      const conversations = data.conversations || []
      
      // Cache the result
      cacheRef.current.set(cacheKey, conversations)
      
      return conversations
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations'
      setError(errorMessage)
      console.error('Error loading conversations:', err)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [userId, selectedFileName])

  const clearHistory = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)

      const params = new URLSearchParams({
        userId,
      })

      if (selectedFileName) {
        params.append('fileName', selectedFileName)
      }

      const response = await fetch(`/api/chat-history?${params.toString()}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to clear history')
      }

      // Clear cache
      const cacheKey = getCacheKey(selectedFileName)
      cacheRef.current.delete(cacheKey)

      return await response.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear history'
      setError(errorMessage)
      console.error('Error clearing history:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [userId, selectedFileName])

  return {
    saveConversation,
    loadConversations,
    clearHistory,
    isLoading,
    error,
  }
}
