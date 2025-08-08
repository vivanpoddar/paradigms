import { useState, useCallback } from 'react'

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

  const saveConversation = useCallback(async (query: string, response: string, metadata: Record<string, any> = {}) => {
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

      return await response_data.json()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save conversation'
      setError(errorMessage)
      console.error('Error saving conversation:', err)
      throw err
    }
  }, [userId, selectedFileName])

  const loadConversations = useCallback(async (): Promise<Conversation[]> => {
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
      return data.conversations || []
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
      // Implementation for clearing history would go here
      // You might want to add a DELETE endpoint to the API
      console.log('Clear history not yet implemented')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear history'
      setError(errorMessage)
      console.error('Error clearing history:', err)
    }
  }, [])

  return {
    saveConversation,
    loadConversations,
    clearHistory,
    isLoading,
    error,
  }
}
