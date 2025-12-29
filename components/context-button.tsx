"use client"

import * as React from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CellContextDialog } from "@/components/cell-context-dialog"
import { useCell } from "./cell-context"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"

export function ContextButton() {
  const [open, setOpen] = React.useState(false)
  const { selectedCell } = useCell()

  // Fetch context count for selected cell
  const { data: contextItems = [] } = useQuery({
    queryKey: ["cell-context", selectedCell?.id],
    queryFn: async () => {
      if (!selectedCell?.id) return []
      const response = await fetch(`/api/cells/${selectedCell.id}/context`)
      if (!response.ok) {
        throw new Error("Failed to fetch context")
      }
      return response.json()
    },
    enabled: !!selectedCell?.id,
  })

  const contextCount = contextItems.length

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
        <FileText className="h-4 w-4" />
        <span className="text-xs">Context</span>
        {contextCount > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
            {contextCount}
          </Badge>
        )}
      </Button>
      <CellContextDialog
        cellId={selectedCell.id}
        cellName={selectedCell.name}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}


