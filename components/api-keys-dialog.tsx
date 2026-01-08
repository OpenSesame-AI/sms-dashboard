"use client"

import * as React from "react"
import { Key } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiKeysManagement } from "@/components/api-keys/api-keys-management"

interface ApiKeysDialogProps {
  cellId: string
  cellName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeysDialog({
  cellId,
  cellName,
  open,
  onOpenChange,
}: ApiKeysDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[calc(100%-2rem)] sm:!max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </DialogTitle>
          <DialogDescription>
            Manage API keys for programmatic access to {cellName}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ApiKeysManagement cellId={cellId} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

