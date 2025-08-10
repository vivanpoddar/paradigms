import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-realtime-chat'
import { MathJax } from 'better-react-mathjax'
import { ReactElement, Fragment, createElement } from 'react'

interface ChatMessageItemProps {
  message: ChatMessage
  isOwnMessage: boolean
  showHeader: boolean
}

const renderFormattedContent = (content: string): ReactElement[] => {
  const lines = content.split('\n')
  const elements: ReactElement[] = []
  let keyCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
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
        <div key={`code-block-${keyCounter++}`} className="my-3 first:mt-0 last:mb-0">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
            {language && (
              <div className="px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {language}
              </div>
            )}
            <pre className="p-3 text-sm overflow-x-auto">
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
              "font-semibold my-2 first:mt-0 last:mb-0",
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
        <ul key={`ul-${keyCounter++}`} className="list-disc list-inside my-2 first:mt-0 last:mb-0 space-y-1">
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
        <ol key={`ol-${keyCounter++}`} className="list-decimal list-inside my-2 first:mt-0 last:mb-0 space-y-1">
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
        elements.push(<div key={`space-${keyCounter++}`} className="h-2" />)
      }
      continue
    }

    // Handle regular paragraphs
    elements.push(
      <p key={`para-${keyCounter++}`} className="my-1 first:mt-0 last:mb-0">
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

  // Handle display math ($$...$$)
  const displayMathRegex = /\$\$([^$]+)\$\$/g
  remaining = remaining.replace(displayMathRegex, (match, math) => {
    const placeholder = `__DISPLAY_MATH_${keyCounter}__`
    parts.push(
      <div key={`display-math-${keyCounter++}`} className="my-2 first:mt-0 last:mb-0">
        <MathJax dynamic>{`$$${math}$$`}</MathJax>
      </div>
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

  // Handle bold text
  const boldRegex = /\*\*([^*]+)\*\*/g
  remaining = remaining.replace(boldRegex, (match, text) => {
    const placeholder = `__BOLD_${keyCounter}__`
    parts.push(
      <strong key={`bold-${keyCounter++}`} className="font-semibold">
        {text}
      </strong>
    )
    return placeholder
  })

  // Handle italic text
  const italicRegex = /\*([^*]+)\*/g
  remaining = remaining.replace(italicRegex, (match, text) => {
    const placeholder = `__ITALIC_${keyCounter}__`
    parts.push(
      <em key={`italic-${keyCounter++}`} className="italic">
        {text}
      </em>
    )
    return placeholder
  })

  // Handle links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  remaining = remaining.replace(linkRegex, (match, text, url) => {
    const placeholder = `__LINK_${keyCounter}__`
    parts.push(
      <a key={`link-${keyCounter++}`} href={url} target="_blank" rel="noopener noreferrer" 
         className="text-blue-500 hover:text-blue-700 underline">
        {text}
      </a>
    )
    return placeholder
  })

  // Split by placeholders and reconstruct
  const segments = remaining.split(/(__[A-Z_]+_\d+__)/g)
  const result: ReactElement[] = []
  let partIndex = 0

  segments.forEach((segment, index) => {
    if (segment.startsWith('__') && segment.endsWith('__')) {
      // Find the corresponding part
      if (partIndex < parts.length) {
        result.push(parts[partIndex])
        partIndex++
      }
    } else if (segment) {
      result.push(<span key={`text-${index}`}>{segment}</span>)
    }
  })

  return result.length > 0 ? result : [<span key="text">{text}</span>]
}

export const ChatMessageItem = ({ message, isOwnMessage, showHeader }: ChatMessageItemProps) => {
  return (
    <div className={`flex mt-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={cn('max-w-[75%] w-fit flex flex-col gap-1', {
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
              {new Date(message.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={cn(
            'py-3 px-4 rounded-xl text-sm w-fit leading-relaxed',
            isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
          )}
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {renderFormattedContent(message.content)}
          </div>
        </div>
      </div>
    </div>
  )
}
