"use client"

import * as React from "react"
import { Key, Plus, Trash2, Copy, Check, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

interface ApiKey {
  id: string
  name: string | null
  lastUsedAt: Date | null
  createdAt: Date
  createdBy: string
}

interface ApiKeysManagementProps {
  cellId: string
}

export function ApiKeysManagement({ cellId }: ApiKeysManagementProps) {
  const queryClient = useQueryClient()
  const [showNewKeyDialog, setShowNewKeyDialog] = React.useState(false)
  const [newKeyName, setNewKeyName] = React.useState("")
  const [newKeyValue, setNewKeyValue] = React.useState<string | null>(null)
  const [keyToDelete, setKeyToDelete] = React.useState<string | null>(null)
  const [copiedKeyId, setCopiedKeyId] = React.useState<string | null>(null)
  const [lastCreatedKey, setLastCreatedKey] = React.useState<string | null>(null)

  // Fetch API keys
  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["api-keys", cellId],
    queryFn: async () => {
      const response = await fetch(`/api/api-keys?cellId=${cellId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch API keys")
      }
      const data = await response.json()
      // Convert date strings to Date objects
      return data.map((key: any) => ({
        ...key,
        createdAt: new Date(key.createdAt),
        lastUsedAt: key.lastUsedAt ? new Date(key.lastUsedAt) : null,
      }))
    },
  })

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: async (name: string | null) => {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellId, name }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to create API key")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", cellId] })
      setNewKeyValue(data.key)
      setLastCreatedKey(data.key)
      setShowNewKeyDialog(false)
      setNewKeyName("")
      toast.success("API key created successfully")
    },
    onError: (error) => {
      toast.error("Failed to create API key", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to delete API key")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", cellId] })
      setKeyToDelete(null)
      toast.success("API key deleted successfully")
    },
    onError: (error) => {
      toast.error("Failed to delete API key", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleCreateKey = () => {
    createKeyMutation.mutate(newKeyName.trim() || null)
  }

  const handleCopyKey = async (key: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedKeyId(keyId)
      toast.success("API key copied to clipboard")
      setTimeout(() => setCopiedKeyId(null), 2000)
    } catch (err) {
      toast.error("Failed to copy API key")
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* New Key Dialog */}
      <Dialog open={showNewKeyDialog && !newKeyValue} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access. You can optionally give it a name to help identify it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name (optional)</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production API Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateKey()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewKeyDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={createKeyMutation.isPending}
            >
              {createKeyMutation.isPending ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Key Value Dialog */}
      <Dialog open={!!newKeyValue} onOpenChange={(open) => !open && setNewKeyValue(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Your API key has been created. Make sure to copy it now - you won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newKeyValue || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => newKeyValue && handleCopyKey(newKeyValue, "new")}
                >
                  {copiedKeyId === "new" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> This is the only time you'll be able to see this API key. Make sure to copy and store it securely.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyValue(null)}>
              I've Copied the Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!keyToDelete} onOpenChange={(open) => !open && setKeyToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone. Any applications using this key will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKeyToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => keyToDelete && deleteKeyMutation.mutate(keyToDelete)}
              disabled={deleteKeyMutation.isPending}
            >
              {deleteKeyMutation.isPending ? "Deleting..." : "Delete Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage API keys for programmatic access to your cell
          </p>
        </div>
        <Button
          onClick={() => setShowNewKeyDialog(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Key
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: API Keys List */}
        <div className="space-y-3">
          {isLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-sm text-muted-foreground">Loading API keys...</p>
              </CardContent>
            </Card>
          ) : !apiKeys || apiKeys.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center space-y-2">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No API keys yet. Create one to get started.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            apiKeys.map((key) => (
              <Card key={key.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {key.name || "Unnamed Key"}
                      </CardTitle>
                      <CardDescription className="mt-1 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <Calendar className="h-3 w-3" />
                          <span>Created {formatDate(key.createdAt)}</span>
                        </div>
                        {key.lastUsedAt && (
                          <div className="flex items-center gap-2 text-xs">
                            <span>Last used {formatDate(key.lastUsedAt)}</span>
                          </div>
                        )}
                        {!key.lastUsedAt && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            Never used
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setKeyToDelete(key.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Right Column: Usage Instructions */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to Use API Keys</CardTitle>
              <CardDescription>
                Use your API key to authenticate requests to the API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Using the Authorization header:</p>
                <code className="block p-3 bg-muted rounded-md text-xs font-mono">
                  Authorization: Bearer {lastCreatedKey || "sk_live_..."}
                </code>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Or using the X-API-Key header:</p>
                <code className="block p-3 bg-muted rounded-md text-xs font-mono">
                  X-API-Key: {lastCreatedKey || "sk_live_..."}
                </code>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Example request:</p>
                <div className="relative">
                  <code className="block p-3 pr-10 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap">
{`curl -X POST https://sms-dashboard-rust.vercel.app/api/v1/conversations/start \\
  -H "Authorization: Bearer ${lastCreatedKey || "sk_live_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+1234567890", "message": "Hello"}'`}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => {
                      const exampleRequest = `curl -X POST https://sms-dashboard-rust.vercel.app/api/v1/conversations/start \\
  -H "Authorization: Bearer ${lastCreatedKey || "sk_live_..."}" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+1234567890", "message": "Hello"}'`
                      navigator.clipboard.writeText(exampleRequest).then(() => {
                        toast.success("Example request copied to clipboard")
                      }).catch(() => {
                        toast.error("Failed to copy example request")
                      })
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

