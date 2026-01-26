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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface Dynamics365IntegrationProps {
  // No props needed - global integration
}

export function Dynamics365Integration({}: Dynamics365IntegrationProps) {
  const queryClient = useQueryClient()
  const [organizationName, setOrganizationName] = React.useState("")
  const [showOrgInput, setShowOrgInput] = React.useState(false)

  // Fetch connection status
  const { data: connectionStatus, isLoading } = useQuery<{
    connected: boolean
    connectedAt?: string
    syncedContactsCount?: number
    error?: string
    autoLinked?: boolean
  }>({
    queryKey: ["dynamics365-integration"],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/dynamics365/status`)
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
        toast.success("Dynamics365 connection auto-linked successfully")
      }
      
      return data
    },
    retry: false,
  })

  const isConnected = connectionStatus?.connected === true
  const syncedContactsCount = connectionStatus?.syncedContactsCount ?? 0

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (orgName: string) => {
      const response = await fetch(`/api/integrations/dynamics365/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: orgName }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.details || error.message || "Failed to connect to Dynamics365")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dynamics365-integration"] })
      setShowOrgInput(false)
      setOrganizationName("")
      if (data.authUrl) {
        // Redirect to OAuth URL
        window.location.href = data.authUrl
      } else {
        toast.success("Connected to Dynamics365")
      }
    },
    onError: (error) => {
      toast.error("Failed to connect to Dynamics365", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/dynamics365/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to disconnect from Dynamics365")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamics365-integration"] })
      toast.success("Disconnected from Dynamics365")
    },
    onError: (error) => {
      toast.error("Failed to disconnect from Dynamics365", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Sync contacts mutation
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/dynamics365/sync-contacts`, {
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
      queryClient.invalidateQueries({ queryKey: ["dynamics365-integration"] })
      toast.success(
        data.message || (data.syncedCount
          ? `Synced ${data.syncedCount} contacts from Dynamics365 to ${data.cellsSynced || 1} cell${(data.cellsSynced || 1) > 1 ? 's' : ''}`
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
    if (!showOrgInput) {
      setShowOrgInput(true)
      return
    }
    
    if (!organizationName.trim()) {
      toast.error("Please enter your organization name")
      return
    }
    
    connectMutation.mutate(organizationName.trim())
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/dynamics365.png"
              alt="Dynamics 365"
              width={20}
              height={20}
              className="h-5 w-5"
            />
            <div>
              <CardTitle className="flex items-center gap-2">
                Dynamics 365
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
                Sync leads and manage your Dynamics 365 integration
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
        ) : showOrgInput ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="e.g., myorg (from myorg.crm.dynamics.com)"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConnect()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter your Dynamics 365 organization name. This is the subdomain in your Dynamics 365 URL (e.g., if your URL is <strong>myorg</strong>.crm.dynamics.com, enter <strong>myorg</strong>).
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Connect your Dynamics 365 account to sync leads and enable integration features.
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
        ) : showOrgInput ? (
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowOrgInput(false)
                setOrganizationName("")
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connectMutation.isPending || !organizationName.trim()}
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
            {connectMutation.isPending ? "Connecting..." : "Connect to Dynamics 365"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
