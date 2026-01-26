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

interface ZohoIntegrationProps {
  // No props needed - global integration
}

export function ZohoIntegration({}: ZohoIntegrationProps) {
  const queryClient = useQueryClient()

  // Fetch connection status
  const { data: connectionStatus, isLoading } = useQuery<{
    connected: boolean
    connectedAt?: string
    syncedContactsCount?: number
  }>({
    queryKey: ["zoho-integration"],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/zoho/status`)
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
      const response = await fetch(`/api/integrations/zoho/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to connect to Zoho")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["zoho-integration"] })
      if (data.authUrl) {
        // Redirect to OAuth URL if provided
        window.location.href = data.authUrl
      } else {
        toast.success("Connected to Zoho")
      }
    },
    onError: (error) => {
      toast.error("Failed to connect to Zoho", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/zoho/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to disconnect from Zoho")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zoho-integration"] })
      toast.success("Disconnected from Zoho")
    },
    onError: (error) => {
      toast.error("Failed to disconnect from Zoho", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Sync contacts mutation
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/zoho/sync-contacts`, {
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
      queryClient.invalidateQueries({ queryKey: ["zoho-integration"] })
      toast.success(
        data.message || (data.syncedCount
          ? `Synced ${data.syncedCount} contacts from Zoho to ${data.cellsSynced || 1} cell${(data.cellsSynced || 1) > 1 ? 's' : ''}`
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
              src="/zoho.png"
              alt="Zoho"
              width={46}
              height={20}
              className="h-5 w-auto object-contain"
            />
            <div>
              <CardTitle className="flex items-center gap-2">
                Zoho CRM
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
                Sync contacts and manage your Zoho CRM integration
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
              Connect your Zoho CRM account to sync contacts and enable integration features.
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
            {connectMutation.isPending ? "Connecting..." : "Connect to Zoho CRM"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
