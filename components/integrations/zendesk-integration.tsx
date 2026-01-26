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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface ZendeskIntegrationProps {
  // No props needed - global integration
}

export function ZendeskIntegration({}: ZendeskIntegrationProps) {
  const queryClient = useQueryClient()
  const [showSubdomainDialog, setShowSubdomainDialog] = React.useState(false)
  const [subdomain, setSubdomain] = React.useState("")

  // Fetch connection status
  const { data: connectionStatus, isLoading } = useQuery<{
    connected: boolean
    connectedAt?: string
    syncedContactsCount?: number
  }>({
    queryKey: ["zendesk-integration"],
    queryFn: async () => {
      const response = await fetch(`/api/integrations/zendesk/status`)
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
    mutationFn: async (subdomainValue: string) => {
      const response = await fetch(`/api/integrations/zendesk/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: subdomainValue }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to connect to Zendesk")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-integration"] })
      setShowSubdomainDialog(false)
      setSubdomain("")
      if (data.authUrl) {
        // Redirect to OAuth URL if provided
        window.location.href = data.authUrl
      } else {
        toast.success("Connected to Zendesk")
      }
    },
    onError: (error) => {
      toast.error("Failed to connect to Zendesk", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/zendesk/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to disconnect from Zendesk")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zendesk-integration"] })
      toast.success("Disconnected from Zendesk")
    },
    onError: (error) => {
      toast.error("Failed to disconnect from Zendesk", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Sync contacts mutation
  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/integrations/zendesk/sync-contacts`, {
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
      queryClient.invalidateQueries({ queryKey: ["zendesk-integration"] })
      toast.success(
        data.message || (data.syncedCount
          ? `Synced ${data.syncedCount} contacts from Zendesk to ${data.cellsSynced || 1} cell${(data.cellsSynced || 1) > 1 ? 's' : ''}`
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
    setShowSubdomainDialog(true)
  }

  const handleSubdomainSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subdomain.trim()) {
      toast.error("Please enter your Zendesk subdomain")
      return
    }
    connectMutation.mutate(subdomain.trim())
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/zendesk.png"
                alt="Zendesk"
                width={100}
                height={20}
                className="h-5 w-auto object-contain"
              />
              <div>
                <CardTitle className="flex items-center gap-2">
                  Zendesk
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
                  Sync users and manage your Zendesk integration
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
                Connect your Zendesk account to sync users and enable integration features.
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
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="w-full gap-2"
            >
              {connectMutation.isPending ? "Connecting..." : "Connect to Zendesk"}
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={showSubdomainDialog} onOpenChange={setShowSubdomainDialog}>
        <DialogContent>
          <form onSubmit={handleSubdomainSubmit}>
            <DialogHeader>
              <DialogTitle>Connect to Zendesk</DialogTitle>
              <DialogDescription>
                Enter your Zendesk subdomain to connect. You can find this in your Zendesk URL.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subdomain">Zendesk Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="subdomain"
                    placeholder="your-company"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">.zendesk.com</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  For example, if your Zendesk URL is <strong>acme.zendesk.com</strong>, enter <strong>acme</strong>.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSubdomainDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={connectMutation.isPending}>
                {connectMutation.isPending ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
