"use client"

import * as React from "react"
import { isWebView } from "@/lib/utils"

/**
 * Simple WebView guidance component
 * Shows a non-blocking message suggesting users open in browser for OAuth
 * Email/password authentication works fine in WebViews, so we don't block
 */
export function WebViewWarning() {
  const [showMessage, setShowMessage] = React.useState(false)

  React.useEffect(() => {
    // Only show message if in WebView
    if (isWebView()) {
      setShowMessage(true)
    }
  }, [])

  // Don't render anything if not in WebView
  if (!showMessage) {
    return null
  }

  return (
    <div className="mx-auto max-w-md px-4 py-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-medium">Tip: For OAuth sign-in (Google, etc.), open this page in your browser.</p>
        <p className="mt-1 text-xs opacity-90">
          Email/password works here, or copy the URL and open it in Safari/Chrome for OAuth options.
        </p>
      </div>
    </div>
  )
}
