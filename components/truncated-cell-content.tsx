"use client"

import * as React from "react"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface TruncatedCellContentProps {
  children: React.ReactNode
  className?: string
}

export function TruncatedCellContent({
  children,
  className,
}: TruncatedCellContentProps) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [hoverTimeout, setHoverTimeout] = React.useState<NodeJS.Timeout | null>(null)

  // Check if content is truncated
  const checkTruncation = React.useCallback(() => {
    if (contentRef.current) {
      const element = contentRef.current
      // Get text content to check if there's actual text
      const textContent = element.textContent || ''
      const hasText = textContent.trim().length > 0
      
      if (!hasText) {
        setIsTruncated(false)
        return
      }
      
      // Check if the wrapper itself is truncated
      const wrapperTruncated = element.scrollWidth > element.clientWidth || 
                               element.scrollHeight > element.clientHeight
      
      if (wrapperTruncated) {
        setIsTruncated(true)
        return
      }
      
      // Check child elements that might have truncate class or be truncated
      const children = element.querySelectorAll('*')
      
      for (const child of Array.from(children)) {
        const childEl = child as HTMLElement
        const computedStyle = window.getComputedStyle(childEl)
        const hasTruncateClass = childEl.classList.contains('truncate')
        const hasEllipsis = computedStyle.textOverflow === 'ellipsis'
        const isOverflowHidden = computedStyle.overflow === 'hidden' || computedStyle.overflowX === 'hidden'
        const whiteSpace = computedStyle.whiteSpace
        
        // If element has truncate class or ellipsis style, check if it's actually truncated
        if ((hasTruncateClass || hasEllipsis || isOverflowHidden) && childEl.textContent && childEl.textContent.trim().length > 0) {
          // For elements with ellipsis, scrollWidth might equal clientWidth, so we need to measure text
          if (hasEllipsis || hasTruncateClass) {
            // Create a temporary span to measure the actual text width
            const measureEl = document.createElement('span')
            measureEl.style.position = 'absolute'
            measureEl.style.visibility = 'hidden'
            measureEl.style.height = 'auto'
            measureEl.style.width = 'auto'
            measureEl.style.whiteSpace = whiteSpace || 'nowrap'
            measureEl.style.font = computedStyle.font
            measureEl.style.fontSize = computedStyle.fontSize
            measureEl.style.fontWeight = computedStyle.fontWeight
            measureEl.style.fontFamily = computedStyle.fontFamily
            measureEl.style.letterSpacing = computedStyle.letterSpacing
            measureEl.textContent = childEl.textContent
            document.body.appendChild(measureEl)
            const textWidth = measureEl.offsetWidth
            document.body.removeChild(measureEl)
            
            if (textWidth > childEl.clientWidth) {
              setIsTruncated(true)
              return
            }
          } else {
            // For other elements, use scrollWidth comparison
            const isChildTruncated = childEl.scrollWidth > childEl.clientWidth || 
                                    childEl.scrollHeight > childEl.clientHeight
            
            if (isChildTruncated) {
              setIsTruncated(true)
              return
            }
          }
        }
      }
      
      setIsTruncated(false)
    }
  }, [])

  // Check truncation on mount and when content changes
  React.useEffect(() => {
    // Delay to ensure DOM is fully laid out
    const timeoutId = setTimeout(() => {
      checkTruncation()
    }, 0)
    
    // Use ResizeObserver to detect size changes
    const resizeObserver = new ResizeObserver(() => {
      // Small delay to ensure layout is complete
      setTimeout(() => {
        checkTruncation()
      }, 0)
    })
    
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [checkTruncation, children])

  // Handle hover with delay
  const handleMouseEnter = React.useCallback(() => {
    if (isTruncated) {
      const timeout = setTimeout(() => {
        setIsOpen(true)
      }, 500) // 500ms delay for hover
      setHoverTimeout(timeout)
    }
  }, [isTruncated])

  const handleMouseLeave = React.useCallback(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    setIsOpen(false)
  }, [hoverTimeout])

  // Handle click - only if not clicking on interactive elements
  const handleClick = React.useCallback((e: React.MouseEvent) => {
    if (isTruncated) {
      // Check if click is on an interactive element (button, checkbox, link, etc.)
      const target = e.target as HTMLElement
      const isInteractive = target.closest('button, a, input, [role="button"], [role="checkbox"]')
      
      if (!isInteractive) {
        e.stopPropagation()
        setIsOpen(true)
      }
    }
  }, [isTruncated])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
    }
  }, [hoverTimeout])

  // If not truncated, just render children normally
  if (!isTruncated) {
    return (
      <div ref={contentRef} className={cn("min-w-0 overflow-hidden", className)}>
        {children}
      </div>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div
          ref={contentRef}
          className={cn(
            "min-w-0 overflow-hidden",
            className
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          style={{ cursor: isTruncated ? 'pointer' : 'default' }}
        >
          {children}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="max-w-lg max-h-96 overflow-auto p-3 z-[100]"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {contentRef.current?.textContent || 
           (typeof children === 'string' ? children : String(children))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
