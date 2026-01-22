"use client"

import { SignUp } from "@clerk/nextjs"
import { WebViewWarning } from "@/components/webview-warning"
import { isWebView } from "@/lib/utils"

export default function SignUpPage() {
  const isInWebView = typeof window !== 'undefined' && isWebView()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <WebViewWarning />
      <div className="w-full max-w-md">
        <SignUp 
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              // In WebView, de-prioritize OAuth buttons (they won't work anyway)
              // Email/password will be shown first by Clerk if enabled
              ...(isInWebView && {
                socialButtonsBlockButton: "opacity-50",
              }),
            },
          }}
        />
      </div>
    </div>
  )
}
