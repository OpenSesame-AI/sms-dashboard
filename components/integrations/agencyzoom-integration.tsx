"use client"

import * as React from "react"
import Image from "next/image"
import { CheckCircle2, XCircle, RefreshCw, Users, Key } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface AgencyzoomIntegrationProps {
  // No props needed - global integration
}

export function AgencyzoomIntegration({}: AgencyzoomIntegrationProps) {
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = React.useState("")
  const [showApiKeyInput, setShowApiKeyInput] = React.useState(false)

  // Fetch connection status
  const { data: connectionStatus, isLoading } = useQuery<{
    connected: boolean
    connectedAt?: string
    syncedContactsCount?: number
    error?: string
  }>({
    queryKey: ["agencyzoom-integration"],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/agencyzoom/status`)
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

  const isConnected = connectionStatus?.connected === true
  const syncedContactsCount = connectionStatus?.syncedContactsCount ?? 0

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await fetch(`/api/integrations/agencyzoom/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.details || error.message || "Failed to connect to AgencyZoom")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agencyzoom-integration"] })
      setShowApiKeyInput(false)
      setApiKey("")
      if (data.immediate) {
        toast.success("Connected to AgencyZoom")
      } else if (data.authUrl) {
        // Redirect to OAuth URL if needed
        window.location.href = data.authUrl
      } else {
        toast.success("Connected to AgencyZoom")
      }
    },
    onError: (error) => {
      toast.error("Failed to connect to AgencyZoom", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/agencyzoom/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to disconnect from AgencyZoom")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencyzoom-integration"] })
      toast.success("Disconnected from AgencyZoom")
    },
    onError: (error) => {
      toast.error("Failed to disconnect from AgencyZoom", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Sync contacts mutation
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/agencyzoom/sync-contacts`, {
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
      queryClient.invalidateQueries({ queryKey: ["agencyzoom-integration"] })
      toast.success(
        data.message || (data.syncedCount
          ? `Synced ${data.syncedCount} contacts from AgencyZoom to ${data.cellsSynced || 1} cell${(data.cellsSynced || 1) > 1 ? 's' : ''}`
          : "Contacts synced successfully")
      )
    },
    onError: (error) => {
      toast.error("Failed to sync contacts", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleConnect = () => {
    if (!showApiKeyInput) {
      setShowApiKeyInput(true)
      return
    }
    
    if (!apiKey.trim()) {
      toast.error("Please enter your API key")
      return
    }
    
    connectMutation.mutate(apiKey.trim())
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/agencyzoom.png"
              alt="AgencyZoom"
              width={100}
              height={20}
              className="h-5 w-auto object-contain"
            />
            <div>
              <CardTitle className="flex items-center gap-2">
                AgencyZoom
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
                Sync customers and leads from AgencyZoom
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
        ) : showApiKeyInput ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="api-key" className="flex items-center gap-2">
                <Key className="h-3 w-3" />
                API Key
              </Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your AgencyZoom API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConnect()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter your AgencyZoom API key. You can find this in your AgencyZoom account settings under API Access.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Connect your AgencyZoom account to sync customers and leads from your insurance agency.
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
        ) : showApiKeyInput ? (
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowApiKeyInput(false)
                setApiKey("")
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connectMutation.isPending || !apiKey.trim()}
              className="flex-1"
            >
              {connectMutation.isPending ? "Connecting..." : "Connect"}
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={connectMutation.isPending}
            className="w-full gap-2"
          >
            {connectMutation.isPending ? "Connecting..." : "Connect to AgencyZoom"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
