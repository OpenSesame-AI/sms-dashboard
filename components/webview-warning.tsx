"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { isWebView } from "@/lib/utils"
import { ExternalLink, Copy, Check } from "lucide-react"
import { toast } from "sonner"

export function WebViewWarning() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [urlCopied, setUrlCopied] = React.useState(false)
  const [attemptedAutoOpen, setAttemptedAutoOpen] = React.useState(false)

  const tryAndroidIntent = React.useCallback((url: string) => {
    // Strategy 2: Try Android Intent URL
    try {
      const intentUrl = `intent://${url.replace(/https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;end`
      window.location.href = intentUrl
      setTimeout(() => {
        // If still here after 1 second, fallback to modal
        if (isWebView()) {
          setIsOpen(true)
        }
      }, 1000)
    } catch (e) {
      // Fallback to modal
      setIsOpen(true)
    }
  }, [])

  const tryIOSOpen = React.useCallback((url: string) => {
    // Strategy 1: Try creating a temporary anchor and clicking it
    try {
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      // Add iOS-specific attributes
      link.setAttribute('data-external', 'true')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Give it a moment, then check
      setTimeout(() => {
        if (isWebView()) {
          // Still in WebView, try window.location
          try {
            window.location.href = url
            setTimeout(() => {
              if (isWebView()) {
                // Still failed, show modal
                setIsOpen(true)
              }
            }, 1000)
          } catch (e) {
            setIsOpen(true)
          }
        }
      }, 500)
    } catch (e) {
      // Try window.location as fallback
      try {
        window.location.href = url
        setTimeout(() => {
          if (isWebView()) {
            setIsOpen(true)
          }
        }, 1000)
      } catch (e2) {
        setIsOpen(true)
      }
    }
  }, [])

  const attemptAutoOpen = React.useCallback(() => {
    const currentUrl = window.location.href
    const userAgent = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(userAgent)
    const isAndroid = /Android/.test(userAgent)
    
    try {
      if (isAndroid) {
        // Strategy 1: Try window.open with _system (works in some WebViews)
        try {
          window.open(currentUrl, '_system')
          // Give it a moment, then check if we're still in WebView
          setTimeout(() => {
            if (isWebView()) {
              // Still in WebView, try next strategy
              tryAndroidIntent(currentUrl)
            }
          }, 1000)
        } catch (e) {
          tryAndroidIntent(currentUrl)
        }
      } else if (isIOS) {
        // For iOS, try multiple strategies
        tryIOSOpen(currentUrl)
      } else {
        // Generic fallback
        try {
          window.open(currentUrl, '_blank')
        } catch (e) {
          // Fall through to showing modal
        }
      }
    } catch (error) {
      // If all automatic attempts fail, show modal
      console.error("Auto-open failed:", error)
    }
  }, [tryAndroidIntent, tryIOSOpen])

  React.useEffect(() => {
    // Check if we're in a WebView
    if (isWebView() && !attemptedAutoOpen) {
      setAttemptedAutoOpen(true)
      // Attempt automatic opening first
      attemptAutoOpen()
      
      // If still in WebView after 2 seconds, show the modal
      const timeout = setTimeout(() => {
        if (isWebView()) {
          setIsOpen(true)
        }
      }, 2000)
      
      return () => clearTimeout(timeout)
    }
  }, [attemptAutoOpen, attemptedAutoOpen])

  const handleCopyUrl = React.useCallback(async () => {
    try {
      const currentUrl = window.location.href
      await navigator.clipboard.writeText(currentUrl)
      setUrlCopied(true)
      toast.success("URL copied to clipboard!")
      
      // Reset the checkmark after 2 seconds
      setTimeout(() => {
        setUrlCopied(false)
      }, 2000)
    } catch (error) {
      toast.error("Failed to copy URL. Please copy it manually.")
    }
  }, [])

  const handleOpenInBrowser = React.useCallback(() => {
    const currentUrl = window.location.href
    
    // Try to open in system browser
    try {
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      
      if (isAndroid) {
        // Try Android Intent
        tryAndroidIntent(currentUrl)
      } else if (isIOS) {
        // For iOS, try opening strategies first
        tryIOSOpen(currentUrl)
        // Also copy URL as backup
        setTimeout(() => {
          handleCopyUrl()
          toast.info("If the browser didn't open, the URL has been copied to your clipboard")
        }, 500)
      } else {
        // Generic fallback
        window.open(currentUrl, '_blank')
      }
    } catch (error) {
      handleCopyUrl()
      toast.error("Unable to open browser automatically. URL copied to clipboard.")
    }
  }, [tryAndroidIntent, tryIOSOpen, handleCopyUrl])

  // Don't render anything if not in WebView
  if (!isWebView()) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        showCloseButton={false}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Open in Your Browser</DialogTitle>
          <DialogDescription className="text-base">
            You're viewing this page in an in-app browser (like LinkedIn's browser), 
            which doesn't support Google sign-in for security reasons.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            We tried to open this page in your browser automatically, but it didn't work. 
            Please use the button below or copy the URL to open it manually in Safari, Chrome, etc.
          </p>
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleOpenInBrowser}
              className="w-full"
              variant="default"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Browser
            </Button>
            
            <Button
              onClick={handleCopyUrl}
              className="w-full"
              variant="outline"
            >
              {urlCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  URL Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy URL
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            className="w-full sm:w-auto"
          >
            Continue Anyway (May Not Work)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

