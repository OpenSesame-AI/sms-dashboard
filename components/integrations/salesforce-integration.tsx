"use client"

import * as React from "react"
import { Cloud, CheckCircle2, XCircle, RefreshCw, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface SalesforceIntegrationProps {
  cellId: string
}

export function SalesforceIntegration({ cellId }: SalesforceIntegrationProps) {
  const queryClient = useQueryClient()

  // Fetch connection status
  const { data: connectionStatus, isLoading } = useQuery<{
    connected: boolean
    connectedAt?: string
    syncedContactsCount?: number
  }>({
    queryKey: ["salesforce-integration", cellId],
    queryFn: async () => {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/integrations/salesforce/status?cellId=${cellId}`)
      if (!response.ok) {
        // If endpoint doesn't exist yet, return disconnected status
        if (response.status === 404) {
          return { connected: false }
        }
        throw new Error("Failed to fetch connection status")
      }
      return response.json()
    },
    retry: false,
  })

  const isConnected = connectionStatus?.connected ?? false
  const syncedContactsCount = connectionStatus?.syncedContactsCount ?? 0

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/integrations/salesforce/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellId }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to connect to Salesforce")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["salesforce-integration", cellId] })
      if (data.authUrl) {
        // Redirect to OAuth URL if provided
        window.location.href = data.authUrl
      } else {
        toast.success("Connected to Salesforce")
      }
    },
    onError: (error) => {
      toast.error("Failed to connect to Salesforce", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/integrations/salesforce/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellId }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to disconnect from Salesforce")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesforce-integration", cellId] })
      toast.success("Disconnected from Salesforce")
    },
    onError: (error) => {
      toast.error("Failed to disconnect from Salesforce", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Sync contacts mutation
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      // TODO: Replace with actual API endpoint
      const response = await fetch(`/api/integrations/salesforce/sync-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellId }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to sync contacts")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["salesforce-integration", cellId] })
      toast.success(
        data.syncedCount
          ? `Synced ${data.syncedCount} contacts from Salesforce`
          : "Contacts synced successfully"
      )
    },
    onError: (error) => {
      toast.error("Failed to sync contacts", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Salesforce
                {isConnected ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Sync contacts and manage your Salesforce integration
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-sm text-muted-foreground">Loading connection status...</p>
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Synced Contacts</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {syncedContactsCount > 0 ? `${syncedContactsCount} contacts` : "No contacts synced"}
              </span>
            </div>
            {connectionStatus?.connectedAt && (
              <p className="text-xs text-muted-foreground">
                Connected on {new Date(connectionStatus.connectedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Connect your Salesforce account to sync contacts and enable integration features.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              onClick={() => syncContactsMutation.mutate()}
              disabled={syncContactsMutation.isPending}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncContactsMutation.isPending ? "animate-spin" : ""}`}
              />
              Sync Contacts
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </>
        ) : (
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="w-full gap-2"
          >
            {connectMutation.isPending ? "Connecting..." : "Connect to Salesforce"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

