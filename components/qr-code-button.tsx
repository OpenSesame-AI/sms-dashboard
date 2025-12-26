"use client"

import * as React from "react"
import { QrCode, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface QrCodeButtonProps {
  phoneNumber?: string
}

export function QrCodeButton({ phoneNumber }: QrCodeButtonProps) {
  const [open, setOpen] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const phone = phoneNumber || "+16726480576"
  const smsLink = `sms:${phone}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(smsLink)}`

  const handleDownload = async () => {
    if (!imgRef.current) return

    try {
      const response = await fetch(qrCodeUrl)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `qrcode-${new Date().toISOString().split("T")[0]}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error("Failed to download QR code:", err)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <QrCode className="h-4 w-4" />
            <span className="sr-only">Show QR code</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Show QR code</p>
        </TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to send an SMS to {phone} on your mobile device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-lg border p-4 bg-white">
              <img
                ref={imgRef}
                src={qrCodeUrl}
                alt="QR Code"
                className="w-full h-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground font-mono break-all text-center">
              {smsLink}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleDownload} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

