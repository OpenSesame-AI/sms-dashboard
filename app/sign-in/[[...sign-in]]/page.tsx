"use client"

import { SignIn } from "@clerk/nextjs"
import { WebViewWarning } from "@/components/webview-warning"
import { isWebView } from "@/lib/utils"

export default function SignInPage() {
  const isInWebView = typeof window !== 'undefined' && isWebView()

  return (
    <div 
      className="flex min-h-screen flex-col items-center justify-center fixed inset-0" 
      style={{ 
        backgroundImage: "url('/image.png')", 
        backgroundSize: 'cover', 
        backgroundPosition: 'center', 
        backgroundRepeat: 'no-repeat',
        zIndex: 0
      }}
    >
      <WebViewWarning />
      <div className="w-full max-w-md relative z-10">
        <SignIn 
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
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
