"use client"

import * as React from "react"
import Image from "next/image"
import { CheckCircle2, XCircle, RefreshCw, Users } from "lucide-react"
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

interface HubspotIntegrationProps {
  // No props needed - global integration
}

export function HubspotIntegration({}: HubspotIntegrationProps) {
  const queryClient = useQueryClient()

  // Fetch connection status
  const { data: connectionStatus, isLoading } = useQuery<{
    connected: boolean
    connectedAt?: string
    syncedContactsCount?: number
    error?: string
    autoLinked?: boolean
    needsLinking?: boolean
  }>({
    queryKey: ["hubspot-integration"],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/hubspot/status`)
      if (!response.ok) {
        // If endpoint doesn't exist yet, return disconnected status
        if (response.status === 404) {
          return { connected: false }
        }
        throw new Error("Failed to fetch connection status")
      }
      const data = await response.json()
      
      // If auto-linked, show a success message
      if (data.autoLinked) {
        toast.success("HubSpot connection auto-linked successfully")
      }
      
      return data
    },
    retry: false,
  })

  // Consider connected if connected is true, even if there's an error message
  // (error might just indicate it needs linking, but connection is active)
  const isConnected = connectionStatus?.connected === true
  const syncedContactsCount = connectionStatus?.syncedContactsCount ?? 0

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/hubspot/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to connect to HubSpot")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hubspot-integration"] })
      if (data.immediate) {
        // API Key connection - immediate success
        toast.success("Connected to HubSpot")
        // Refresh status to show connected state
        queryClient.invalidateQueries({ queryKey: ["hubspot-integration"] })
      } else if (data.authUrl) {
        // Redirect to OAuth URL if provided
        window.location.href = data.authUrl
      } else {
        toast.success("Connected to HubSpot")
      }
    },
    onError: (error) => {
      toast.error("Failed to connect to HubSpot", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/hubspot/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to disconnect from HubSpot")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hubspot-integration"] })
      toast.success("Disconnected from HubSpot")
    },
    onError: (error) => {
      toast.error("Failed to disconnect from HubSpot", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Sync contacts mutation
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/hubspot/sync-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to sync contacts")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["hubspot-integration"] })
      toast.success(
        data.message || (data.syncedCount
          ? `Synced ${data.syncedCount} contacts from HubSpot to ${data.cellsSynced || 1} cell${(data.cellsSynced || 1) > 1 ? 's' : ''}`
          : "Contacts synced successfully")
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
           
              <Image
                src="/HubSpot_idUw_2QApK_1.svg"
                alt="HubSpot"
                width={20}
                height={20}
                className="h-5 w-5"
              />
        
            <div>
              <CardTitle className="flex items-center gap-2">
                HubSpot
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
                Sync contacts and manage your HubSpot integration
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
              Connect your HubSpot account to sync contacts and enable integration features.
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
            {connectMutation.isPending ? "Connecting..." : "Connect to HubSpot"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
