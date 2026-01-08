"use client"

import * as React from "react"
import { Plug } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SalesforceIntegration } from "@/components/integrations/salesforce-integration"

interface IntegrationsDialogProps {
  cellId: string
  cellName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IntegrationsDialog({
  cellId,
  cellName,
  open,
  onOpenChange,
}: IntegrationsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrations
          </DialogTitle>
          <DialogDescription>
            Connect and manage integrations for {cellName}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <SalesforceIntegration cellId={cellId} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

