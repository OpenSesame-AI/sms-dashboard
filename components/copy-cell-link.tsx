"use client"

import * as React from "react"
import { Copy, Check, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CopyCellLinkProps {
  cellId: string
}

export function CopyCellLink({ cellId }: CopyCellLinkProps) {
  const [copied, setCopied] = React.useState(false)

  const getShareableUrl = () => {
    if (typeof window === "undefined") return ""
    const baseUrl = window.location.origin
    return `${baseUrl}/c/${cellId}`
  }

  const handleCopy = async () => {
    try {
      const url = getShareableUrl()
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span className="text-xs">Copied!</span>
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4" />
                <span className="text-xs">Copy Link</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy shareable link for this cell</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}


