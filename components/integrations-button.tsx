"use client"

import * as React from "react"
import { Plug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IntegrationsDialog } from "@/components/integrations-dialog"
import { useCell } from "./cell-context"

export function IntegrationsButton() {
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
        <Plug className="h-4 w-4" />
        <span className="text-xs">Integrations</span>
      </Button>
      <IntegrationsDialog
        cellId={selectedCell.id}
        cellName={selectedCell.name}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

