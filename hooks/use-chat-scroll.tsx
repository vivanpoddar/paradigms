import { useCallback, useRef } from 'react'

export function useChatScroll() {
  const containerRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current || isScrollingRef.current) return

    const container = containerRef.current
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    
    // Only scroll if user is near the bottom to avoid interrupting manual scrolling
    if (isNearBottom) {
      isScrollingRef.current = true
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
      
      // Reset scrolling flag after animation
      setTimeout(() => {
        isScrollingRef.current = false
      }, 300)
    }
  }, [])

  return { containerRef, scrollToBottom }
}
