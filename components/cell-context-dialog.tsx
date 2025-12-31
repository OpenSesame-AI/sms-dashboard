"use client"

import * as React from "react"
import { FileText, Upload, Trash2, RotateCcw, Link } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CellContext } from "@/lib/db/schema"
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants"

type CellContextDialogProps = {
  cellId: string
  cellName: string
  systemPrompt: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSystemPromptSaved?: (newPrompt: string) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function CellContextDialog({
  cellId,
  cellName,
  systemPrompt,
  open,
  onOpenChange,
  onSystemPromptSaved,
}: CellContextDialogProps) {
  const [activeTab, setActiveTab] = React.useState<"text" | "files" | "url">("text")
  const [dragActive, setDragActive] = React.useState(false)
  const [editedPrompt, setEditedPrompt] = React.useState(systemPrompt || "")
  const [urlInput, setUrlInput] = React.useState("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Sync editedPrompt when systemPrompt changes or dialog opens
  React.useEffect(() => {
    if (open) {
      setEditedPrompt(systemPrompt || "")
    }
  }, [open, systemPrompt])

  // Fetch context items
  const { data: contextItems = [], isLoading } = useQuery<CellContext[]>({
    queryKey: ["cell-context", cellId],
    queryFn: async () => {
      const response = await fetch(`/api/cells/${cellId}/context`)
      if (!response.ok) {
        throw new Error("Failed to fetch context")
      }
      return response.json()
    },
    enabled: open && !!cellId,
  })

  const fileItems = contextItems.filter((item) => item.type === "file")
  const urlItems = contextItems.filter((item) => item.type === "url")

  // Add file context mutation
  const addFileMutation = useMutation({
    mutationFn: async (file: File) => {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(
        `https://web-production-15949.up.railway.app/api/v1/cells/${cellId}/context`,
        {
          method: "POST",
          body: formData,
        }
      )
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to upload file")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cell-context", cellId] })
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      toast.success("File uploaded")
    },
    onError: (error) => {
      toast.error("Failed to upload file", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Update system prompt mutation
  const updateSystemPromptMutation = useMutation({
    mutationFn: async (newPrompt: string) => {
      const response = await fetch(`/api/cells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cellId,
          name: cellName,
          systemPrompt: newPrompt,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update system prompt")
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success("System prompt saved")
      onSystemPromptSaved?.(data.systemPrompt)
    },
    onError: (error) => {
      toast.error("Failed to save system prompt", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Delete context mutation
  const deleteMutation = useMutation({
    mutationFn: async (contextId: string) => {
      const response = await fetch(
        `/api/cells/${cellId}/context?contextId=${encodeURIComponent(contextId)}`,
        {
          method: "DELETE",
        }
      )
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete context")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cell-context", cellId] })
      toast.success("Context deleted")
    },
    onError: (error) => {
      toast.error("Failed to delete context", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Add URL context mutation
  const addUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch(
        `https://web-production-15949.up.railway.app/api/v1/cells/${cellId}/context/url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }
      )
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || "Failed to add URL")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cell-context", cellId] })
      setUrlInput("")
      toast.success("URL added successfully")
    },
    onError: (error) => {
      toast.error("Failed to add URL", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large", {
          description: `${file.name} exceeds 5MB limit`,
        })
        return
      }
      addFileMutation.mutate(file)
    })
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileText className="h-4 w-4" />
    if (mimeType.startsWith("image/")) return "🖼️"
    if (mimeType.includes("pdf")) return "📄"
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝"
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
      return "📊"
    return <FileText className="h-4 w-4" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Context: {cellName}</DialogTitle>
          <DialogDescription>
            Add text context or upload files to provide context for this cell.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("text")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "text"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            System Prompt
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "files"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Files ({fileItems.length})
          </button>
          <button
            onClick={() => setActiveTab("url")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "url"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            URLs ({urlItems.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "text" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  placeholder="Enter the system prompt for this cell..."
                  rows={12}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditedPrompt(DEFAULT_SYSTEM_PROMPT)}
                  disabled={
                    updateSystemPromptMutation.isPending ||
                    editedPrompt === DEFAULT_SYSTEM_PROMPT
                  }
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
                <Button
                  onClick={() => updateSystemPromptMutation.mutate(editedPrompt)}
                  disabled={
                    updateSystemPromptMutation.isPending ||
                    editedPrompt === (systemPrompt || "")
                  }
                >
                  {updateSystemPromptMutation.isPending ? "Saving..." : "Save System Prompt"}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-4 py-4">
              {/* File upload area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }`}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to select
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Maximum file size: 5MB
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={addFileMutation.isPending}
                >
                  Select Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </div>

              {/* File items list */}
              {fileItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Files</Label>
                  <div className="space-y-2">
                    {fileItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="text-xl shrink-0">
                            {getFileIcon(item.mimeType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.mimeType} • {formatFileSize(item.fileSize)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-2 shrink-0"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "url" && (
            <div className="space-y-4 py-4">
              {/* URL input area */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url-input">Add URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="url-input"
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/page"
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (urlInput.trim()) {
                          addUrlMutation.mutate(urlInput.trim())
                        }
                      }}
                      disabled={addUrlMutation.isPending || !urlInput.trim()}
                    >
                      {addUrlMutation.isPending ? "Adding..." : "Add URL"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter a URL to fetch and use as context for this cell.
                  </p>
                </div>
              </div>

              {/* URL items list */}
              {urlItems.length > 0 && (
                <div className="space-y-2">
                  <Label>Added URLs</Label>
                  <div className="space-y-2">
                    {urlItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="shrink-0">
                            <Link className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.content?.substring(0, 100)}...
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-2 shrink-0"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


