"use client"

import * as React from "react"
import { Copy, MessageSquare, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cell } from "@/lib/db/schema"

interface CellLandingPageProps {
  cell: Cell
}

export function CellLandingPage({ cell }: CellLandingPageProps) {
  const [copied, setCopied] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const smsLink = `sms:${cell.phoneNumber}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(smsLink)}`

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(cell.phoneNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleOpenSMS = () => {
    window.location.href = smsLink
  }

  const handleDownloadQR = async () => {
    if (!imgRef.current) return

    try {
      const response = await fetch(qrCodeUrl)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `qrcode-${cell.name}-${new Date().toISOString().split("T")[0]}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error("Failed to download QR code:", err)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-white p-8 shadow-lg dark:bg-zinc-900 dark:border-zinc-800">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {cell.name}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Send a message to start a conversation
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* QR Code */}
          <div className="rounded-lg border p-4 bg-white">
            <img
              ref={imgRef}
              src={qrCodeUrl}
              alt="QR Code"
              className="w-64 h-64"
            />
          </div>

          {/* Phone Number */}
          <div className="w-full space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-center">
              Phone Number
            </p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-lg font-mono text-black dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded">
                {cell.phoneNumber}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyPhone}
                className="h-10 w-10"
              >
                {copied ? (
                  <Copy className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={handleOpenSMS}
              className="w-full"
              size="lg"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Open SMS
            </Button>
            <Button
              onClick={handleDownloadQR}
              variant="outline"
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download QR Code
            </Button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-500 text-center">
            Scan the QR code with your phone camera to start messaging
          </p>
        </div>
      </div>
    </div>
  )
}


