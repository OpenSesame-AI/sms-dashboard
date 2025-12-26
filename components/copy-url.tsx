"use client"

import * as React from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CopyUrlProps {
  phoneNumber?: string
}

export function CopyUrl({ phoneNumber }: CopyUrlProps) {
  const [copied, setCopied] = React.useState(false)
  const displayPhoneNumber = phoneNumber || "+16726480576"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayPhoneNumber)
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
                <Copy className="h-4 w-4" />
                <span className="text-xs font-mono max-w-[200px] truncate">{displayPhoneNumber}</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to copy phone number</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

