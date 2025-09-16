import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-realtime-chat'
import { MathJax } from 'better-react-mathjax'
import { ReactElement, Fragment, createElement, memo, useMemo } from 'react'
import { ImageIcon } from 'lucide-react'

interface ChatMessageItemProps {
  message: ChatMessage
  isOwnMessage: boolean
  showHeader: boolean
}

const renderFormattedContent = (content: string): ReactElement[] => {
  let processedContent = content
  const elements: ReactElement[] = []
  let keyCounter = 0

  // First, handle display math blocks that may span multiple lines
  const displayMathBlocks: ReactElement[] = []
  
  // Handle LaTeX display math \[...\]
  processedContent = processedContent.replace(/\\\[([^]*?)\\\]/g, (match, math) => {
    const placeholder = `__BLOCK_LATEX_DISPLAY_MATH_${displayMathBlocks.length}__`
    displayMathBlocks.push(
      <div key={`block-latex-display-math-${keyCounter++}`} className="my-2 first:mt-0 last:mb-0">
        <MathJax dynamic>{`\\[${math}\\]`}</MathJax>
      </div>
    )
    return placeholder
  })

  // Handle $$ display math
  processedContent = processedContent.replace(/\$\$([^]*?)\$\$/g, (match, math) => {
    const placeholder = `__BLOCK_DISPLAY_MATH_${displayMathBlocks.length}__`
    displayMathBlocks.push(
      <div key={`block-display-math-${keyCounter++}`} className="my-2 first:mt-0 last:mb-0">
        <MathJax dynamic>{`$$${math}$$`}</MathJax>
      </div>
    )
    return placeholder
  })

  const lines = processedContent.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Handle display math placeholders as separate blocks
    if (line.match(/^__BLOCK_(LATEX_)?DISPLAY_MATH_\d+__$/)) {
      const blockIndex = parseInt(line.match(/\d+/)?.[0] || '0')
      if (displayMathBlocks[blockIndex]) {
        elements.push(displayMathBlocks[blockIndex])
      }
      continue
    }
    
    // Handle code blocks
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++ // Move to next line
      
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      
      elements.push(
        <div key={`code-block-${keyCounter++}`} className="my-1 first:mt-0 last:mb-0">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
            {language && (
              <div className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {language}
              </div>
            )}
            <pre className="p-2 text-sm overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {codeLines.join('\n')}
              </code>
            </pre>
          </div>
        </div>
      )
      continue
    }

    // Handle headers
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1
      const text = line.replace(/^#+\s*/, '')
      const headerLevel = Math.min(level, 6)
      
      elements.push(
        createElement(
          `h${headerLevel}`,
          {
            key: `header-${keyCounter++}`,
            className: cn(
              "font-semibold my-1 first:mt-0 last:mb-0",
              level === 1 && "text-xl",
              level === 2 && "text-lg",
              level === 3 && "text-base",
              level >= 4 && "text-sm"
            )
          },
          renderInlineContent(text)
        )
      )
      continue
    }

    // Handle unordered lists
    if (line.match(/^\s*[-*+]\s/)) {
      const listItems: string[] = [line]
      
      // Collect consecutive list items
      while (i + 1 < lines.length && lines[i + 1].match(/^\s*[-*+]\s/)) {
        i++
        listItems.push(lines[i])
      }
      
      elements.push(
        <ul key={`ul-${keyCounter++}`} className="list-disc list-inside my-1 first:mt-0 last:mb-0 space-y-0.5">
          {listItems.map((item, idx) => (
            <li key={`li-${keyCounter++}`} className="text-sm">
              {renderInlineContent(item.replace(/^\s*[-*+]\s/, ''))}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Handle ordered lists
    if (line.match(/^\s*\d+\.\s/)) {
      const listItems: string[] = [line]
      
      // Collect consecutive list items
      while (i + 1 < lines.length && lines[i + 1].match(/^\s*\d+\.\s/)) {
        i++
        listItems.push(lines[i])
      }
      
      elements.push(
        <ol key={`ol-${keyCounter++}`} className="list-decimal list-inside my-1 first:mt-0 last:mb-0 space-y-0.5">
          {listItems.map((item, idx) => (
            <li key={`li-${keyCounter++}`} className="text-sm">
              {renderInlineContent(item.replace(/^\s*\d+\.\s/, ''))}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Handle empty lines as spacing
    if (line.trim() === '') {
      if (elements.length > 0) {
        elements.push(<div key={`space-${keyCounter++}`} className="h-1" />)
      }
      continue
    }

    // Handle regular paragraphs
    elements.push(
      <p key={`para-${keyCounter++}`} className="my-0.5 first:mt-0 last:mb-0">
        {renderInlineContent(line)}
      </p>
    )
  }

  return elements.length > 0 ? elements : [<span key="empty">{content}</span>]
}

const renderInlineContent = (text: string): ReactElement[] => {
  const parts: ReactElement[] = []
  let remaining = text
  let keyCounter = 0

  // Handle inline math \(...\) first to protect it
  const latexInlineMathRegex = /\\\(([^]*?)\\\)/g
  remaining = remaining.replace(latexInlineMathRegex, (match, math) => {
    const placeholder = `__LATEX_INLINE_MATH_${keyCounter}__`
    parts.push(
      <MathJax key={`latex-inline-math-${keyCounter++}`} inline dynamic>
        {`\\(${math}\\)`}
      </MathJax>
    )
    return placeholder
  })

  // Handle inline math ($...$)
  const inlineMathRegex = /\$([^$]+)\$/g
  remaining = remaining.replace(inlineMathRegex, (match, math) => {
    const placeholder = `__INLINE_MATH_${keyCounter}__`
    parts.push(
      <MathJax key={`inline-math-${keyCounter++}`} inline dynamic>
        {`$${math}$`}
      </MathJax>
    )
    return placeholder
  })

  // Handle inline code
  const inlineCodeRegex = /`([^`]+)`/g
  remaining = remaining.replace(inlineCodeRegex, (match, code) => {
    const placeholder = `__INLINE_CODE_${keyCounter}__`
    parts.push(
      <code key={`inline-code-${keyCounter++}`} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">
        {code}
      </code>
    )
    return placeholder
  })

  // Handle bold text - with improved nested content handling
  const boldRegex = /\*\*([^*]+)\*\*/g
  remaining = remaining.replace(boldRegex, (match, text) => {
    const placeholder = `__BOLD_${keyCounter}__`
    
    // Split the bold content and process each part
    const segments = text.split(/(__[A-Z_]+_\d+__)/g)
    const boldChildren: (string | ReactElement)[] = []
    
    segments.forEach((segment: string, index: number) => {
      if (segment.startsWith('__') && segment.endsWith('__')) {
        // Find the corresponding part
        const partIndex = parts.findIndex((part, idx) => 
          (part.key as string)?.includes(segment.match(/_(\d+)__$/)?.[1] || ''))
        if (partIndex >= 0) {
          boldChildren.push(parts[partIndex])
        }
      } else if (segment) {
        boldChildren.push(segment)
      }
    })
    
    parts.push(
      <strong key={`bold-${keyCounter++}`} className="font-semibold">
        {boldChildren.map((child, idx) => 
          typeof child === 'string' ? 
            <span key={`bold-text-${idx}`}>{child}</span> : 
            child
        )}
      </strong>
    )
    return placeholder
  })

  // Handle italic text
  const italicRegex = /\*([^*]+)\*/g
  remaining = remaining.replace(italicRegex, (match, text) => {
    const placeholder = `__ITALIC_${keyCounter}__`
    
    // Split the italic content and process each part
    const segments = text.split(/(__[A-Z_]+_\d+__)/g)
    const italicChildren: (string | ReactElement)[] = []
    
    segments.forEach((segment: string, index: number) => {
      if (segment.startsWith('__') && segment.endsWith('__')) {
        // Find the corresponding part
        const partIndex = parts.findIndex((part, idx) => 
          (part.key as string)?.includes(segment.match(/_(\d+)__$/)?.[1] || ''))
        if (partIndex >= 0) {
          italicChildren.push(parts[partIndex])
        }
      } else if (segment) {
        italicChildren.push(segment)
      }
    })
    
    parts.push(
      <em key={`italic-${keyCounter++}`} className="italic">
        {italicChildren.map((child, idx) => 
          typeof child === 'string' ? 
            <span key={`italic-text-${idx}`}>{child}</span> : 
            child
        )}
      </em>
    )
    return placeholder
  })

  // Handle links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  remaining = remaining.replace(linkRegex, (match, text, url) => {
    const placeholder = `__LINK_${keyCounter}__`
    
    // Split the link text and process each part
    const segments = text.split(/(__[A-Z_]+_\d+__)/g)
    const linkChildren: (string | ReactElement)[] = []
    
    segments.forEach((segment: string, index: number) => {
      if (segment.startsWith('__') && segment.endsWith('__')) {
        // Find the corresponding part
        const partIndex = parts.findIndex((part, idx) => 
          (part.key as string)?.includes(segment.match(/_(\d+)__$/)?.[1] || ''))
        if (partIndex >= 0) {
          linkChildren.push(parts[partIndex])
        }
      } else if (segment) {
        linkChildren.push(segment)
      }
    })
    
    parts.push(
      <a key={`link-${keyCounter++}`} href={url} target="_blank" rel="noopener noreferrer" 
         className="text-blue-500 hover:text-blue-700 underline">
        {linkChildren.map((child, idx) => 
          typeof child === 'string' ? 
            <span key={`link-text-${idx}`}>{child}</span> : 
            child
        )}
      </a>
    )
    return placeholder
  })

  // Final reconstruction
  const segments = remaining.split(/(__[A-Z_]+_\d+__)/g)
  const result: ReactElement[] = []

  segments.forEach((segment, index) => {
    if (segment.startsWith('__') && segment.endsWith('__')) {
      // Find the corresponding part
      const partIndex = parts.findIndex((part, idx) => 
        (part.key as string)?.includes(segment.match(/_(\d+)__$/)?.[1] || ''))
      if (partIndex >= 0) {
        result.push(parts[partIndex])
      }
    } else if (segment) {
      result.push(<span key={`text-${index}`}>{segment}</span>)
    }
  })

  return result.length > 0 ? result : [<span key="text">{text}</span>]
}

export const ChatMessageItem = memo(({ message, isOwnMessage, showHeader }: ChatMessageItemProps) => {
  // Memoize the formatted content to avoid re-rendering heavy content
  const formattedContent = useMemo(
    () => renderFormattedContent(message.content),
    [message.content]
  )

  // Memoize the timestamp to avoid recalculating
  const timestamp = useMemo(
    () => new Date(message.createdAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    [message.createdAt]
  )

  return (
    <div className={`flex mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={cn('max-w-[75%] overflow-x-scroll w-fit flex flex-col gap-0.5', {
          'items-end': isOwnMessage,
        })}
      >
        {showHeader && (
          <div
            className={cn('flex items-center gap-2 text-xs px-3', {
              'justify-end flex-row-reverse': isOwnMessage,
            })}
          >
            <span className={'font-medium'}>{message.user.name}</span>
            <span className="text-foreground/50 text-xs">
              {timestamp}
            </span>
          </div>
        )}
        <div
          className={cn(
            'py-2 px-3 rounded-xl text-sm w-fit leading-relaxed',
            isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
          )}
        >
          {/* Display image names if present */}
          {message.images && message.images.length > 0 && (
            <div className="mb-2 space-y-1">
              {message.images.map((image, index) => (
                <div key={index} className={cn(
                  "flex items-center gap-2 p-2 rounded-md border",
                  isOwnMessage 
                    ? "bg-primary/10 border-primary-foreground/20" 
                    : "bg-muted/50 border-border"
                )}>
                  <ImageIcon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-sm" title={image.name}>
                      {image.name}
                    </div>
                    <div className={cn(
                      "text-xs",
                      isOwnMessage ? "text-primary-foreground/70" : "text-foreground/70"
                    )}>
                      {(image.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {message.content ? formattedContent : (
              message.images && message.images.length > 0 ? (
                <span className={cn(
                  "italic text-sm",
                  isOwnMessage ? "text-primary-foreground/70" : "text-foreground/70"
                )}>
                  Shared {message.images.length} image{message.images.length > 1 ? 's' : ''}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
