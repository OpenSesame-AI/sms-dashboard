"use client"

import * as React from "react"
import { BarChart3 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AnalyticsDialogContent } from "@/components/analytics-dialog-content"
import type {
  AnalyticsSummary,
  MessagesOverTime,
  MessagesByDirection,
  StatusBreakdown,
  TopActiveContact,
  NewContactsOverTime,
  HourlyDistribution,
} from '@/lib/db/queries'

interface AnalyticsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AnalyticsDialog({ open, onOpenChange }: AnalyticsDialogProps) {
  const [data, setData] = React.useState<{
    summary: AnalyticsSummary
    messagesOverTime: MessagesOverTime[]
    messagesByDirection: MessagesByDirection[]
    statusBreakdown: StatusBreakdown[]
    topContacts: TopActiveContact[]
    newContactsOverTime: NewContactsOverTime[]
    hourlyDistribution: HourlyDistribution[]
  } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setLoading(true)
      setError(null)
      fetch('/api/analytics')
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch analytics')
          }
          return res.json()
        })
        .then((data) => {
          setData(data)
          setLoading(false)
        })
        .catch((err) => {
          console.error('Error fetching analytics:', err)
          setError(err.message || 'Failed to load analytics')
          setLoading(false)
        })
    } else {
      // Reset data when dialog closes to ensure fresh data on next open
      setData(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics
          </DialogTitle>
          <DialogDescription>
            View insights and metrics for your SMS dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading analytics...</p>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-12">
              <p className="text-destructive">{error}</p>
            </div>
          )}
          {data && !loading && !error && (
            <AnalyticsDialogContent data={data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

