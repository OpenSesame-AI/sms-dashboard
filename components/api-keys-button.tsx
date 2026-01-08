"use client"

import * as React from "react"
import { Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApiKeysDialog } from "@/components/api-keys-dialog"
import { useCell } from "./cell-context"

export function ApiKeysButton() {
  const [open, setOpen] = React.useState(false)
  const { selectedCell } = useCell()

  if (!selectedCell) {
    return null
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 text-muted-foreground hover:text-foreground"
      >
        <Key className="h-4 w-4" />
        <span className="text-xs">API Keys</span>
      </Button>
      <ApiKeysDialog
        cellId={selectedCell.id}
        cellName={selectedCell.name}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

