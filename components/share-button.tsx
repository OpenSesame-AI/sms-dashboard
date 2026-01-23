"use client"

import * as React from "react"
import { Share2, Link as LinkIcon, Phone, QrCode, Check, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface ShareButtonProps {
  cellId: string
  phoneNumber?: string
}

export function ShareButton({ cellId, phoneNumber }: ShareButtonProps) {
  const [qrCodeOpen, setQrCodeOpen] = React.useState(false)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const [copiedPhone, setCopiedPhone] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)
  
  const displayPhoneNumber = phoneNumber || "+16726480576"
  const smsLink = `sms:${displayPhoneNumber}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(smsLink)}`

  const getShareableUrl = () => {
    if (typeof window === "undefined") return ""
    const baseUrl = window.location.origin
    return `${baseUrl}/c/${cellId}`
  }

  const handleCopyLink = async () => {
    try {
      const url = getShareableUrl()
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      toast.success("Cell link copied to clipboard")
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy link")
    }
  }

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(displayPhoneNumber)
      setCopiedPhone(true)
      toast.success("Phone number copied to clipboard")
      setTimeout(() => setCopiedPhone(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy phone number")
    }
  }

  const handleShowQrCode = () => {
    setQrCodeOpen(true)
  }

  const handleDownloadQrCode = async () => {
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
      toast.success("QR code downloaded")
    } catch (err) {
      console.error("Failed to download QR code:", err)
      toast.error("Failed to download QR code")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleCopyLink}>
            {copiedLink ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4" />
                <span>Copy Cell Link</span>
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyPhone}>
            {copiedPhone ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" />
                <span>Copy Phone Number</span>
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShowQrCode}>
            <QrCode className="h-4 w-4" />
            <span>Show QR Code</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to send an SMS to {displayPhoneNumber} on your mobile device.
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
            <Button onClick={handleDownloadQrCode} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download QR Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
