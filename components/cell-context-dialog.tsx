"use client"

import * as React from "react"
import { FileText, Upload, X, Trash2 } from "lucide-react"
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

type CellContextDialogProps = {
  cellId: string
  cellName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function CellContextDialog({
  cellId,
  cellName,
  open,
  onOpenChange,
}: CellContextDialogProps) {
  const [activeTab, setActiveTab] = React.useState<"text" | "files">("text")
  const [textContent, setTextContent] = React.useState("")
  const [textName, setTextName] = React.useState("")
  const [dragActive, setDragActive] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

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

  const textItems = contextItems.filter((item) => item.type === "text")
  const fileItems = contextItems.filter((item) => item.type === "file")

  // Add text context mutation
  const addTextMutation = useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      const response = await fetch(`/api/cells/${cellId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          name: data.name,
          content: data.content,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add text context")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cell-context", cellId] })
      setTextContent("")
      setTextName("")
      toast.success("Text context added")
    },
    onError: (error) => {
      toast.error("Failed to add text context", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Add file context mutation
  const addFileMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove data URL prefix
          const base64 = result.split(",")[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const response = await fetch(`/api/cells/${cellId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "file",
          name: file.name,
          content: base64,
          mimeType: file.type,
          fileSize: file.size,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload file")
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

  const handleAddText = () => {
    if (!textName.trim()) {
      toast.error("Missing name", {
        description: "Please provide a name for the text context",
      })
      return
    }
    if (!textContent.trim()) {
      toast.error("Missing content", {
        description: "Please provide text content",
      })
      return
    }
    addTextMutation.mutate({
      name: textName.trim(),
      content: textContent.trim(),
    })
  }

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
            Text ({textItems.length})
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "text" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="text-name">Name</Label>
                <Input
                  id="text-name"
                  value={textName}
                  onChange={(e) => setTextName(e.target.value)}
                  placeholder="e.g., Company Info, Instructions"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="text-content">Content</Label>
                <Textarea
                  id="text-content"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter text context..."
                  rows={6}
                />
              </div>
              <Button
                onClick={handleAddText}
                disabled={
                  !textName.trim() ||
                  !textContent.trim() ||
                  addTextMutation.isPending
                }
              >
                {addTextMutation.isPending ? "Adding..." : "Add Text Context"}
              </Button>

              {/* Text items list */}
              {textItems.length > 0 && (
                <div className="space-y-2 mt-6">
                  <Label>Existing Text Context</Label>
                  <div className="space-y-2">
                    {textItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-3 border rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {item.content}
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


