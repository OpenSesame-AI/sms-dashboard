"use client"

import * as React from "react"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnalyticsDialog } from "@/components/analytics-dialog"

export function AnalyticsButton() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 text-muted-foreground hover:text-foreground"
      >
        <BarChart3 className="h-4 w-4" />
        <span className="text-xs">Analytics</span>
      </Button>
      <AnalyticsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}




