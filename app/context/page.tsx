"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload, Trash2, RotateCcw, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CellContext } from "@/lib/db/schema"
import { DEFAULT_SYSTEM_PROMPT, SYSTEM_PROMPT_TEMPLATES } from "@/lib/constants"
import { TemplatesMode } from "@/components/system-prompt-templates"
import { GuidedMode } from "@/components/system-prompt-guided"
import { AdvancedMode } from "@/components/system-prompt-advanced"
import { useCell } from "@/components/cell-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function ContextPage() {
  const router = useRouter()
  const { selectedCell, setSelectedCell } = useCell()
  const [activeTab, setActiveTab] = React.useState<"text" | "files" | "url">("text")
  const [promptMode, setPromptMode] = React.useState<"templates" | "guided" | "advanced">("advanced")
  const [dragActive, setDragActive] = React.useState(false)
  const [editedPrompt, setEditedPrompt] = React.useState("")
  const [urlInput, setUrlInput] = React.useState("")
  const [showSaveConfirm, setShowSaveConfirm] = React.useState(false)
  const [showResetConfirm, setShowResetConfirm] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Redirect if no cell is selected
  React.useEffect(() => {
    if (!selectedCell) {
      router.push("/table")
    }
  }, [selectedCell, router])

  // Sync editedPrompt when systemPrompt changes
  React.useEffect(() => {
    if (selectedCell) {
      setEditedPrompt(selectedCell.systemPrompt || "")
      setPromptMode("advanced")
    }
  }, [selectedCell])

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = SYSTEM_PROMPT_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      setEditedPrompt(template.prompt)
      setPromptMode("advanced")
      toast.success(`Template "${template.name}" applied`)
    }
  }

  if (!selectedCell) {
    return null
  }

  const cellId = selectedCell.id
  const cellName = selectedCell.name
  const systemPrompt = selectedCell.systemPrompt

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
    enabled: !!cellId,
  })

  const fileItems = contextItems.filter((item) => item.type === "file")
  const urlItems = contextItems.filter((item) => item.type === "url")

  // Add file context mutation
  const addFileMutation = useMutation({
    mutationFn: async (file: File) => {
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
      setSelectedCell({
        ...selectedCell,
        systemPrompt: data.systemPrompt,
      })
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
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold">Manage Context: {cellName}</h1>
        <p className="text-muted-foreground mt-2">
          Add text context or upload files to provide context for this cell.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("text")}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "text"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          System Prompt
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "files"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Files ({fileItems.length})
        </button>
        <button
          onClick={() => setActiveTab("url")}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "url"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          URLs ({urlItems.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === "text" && (
          <div className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setPromptMode("templates")}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  promptMode === "templates"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => setPromptMode("guided")}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  promptMode === "guided"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Guided
              </button>
              <button
                onClick={() => setPromptMode("advanced")}
                className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  promptMode === "advanced"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Advanced
              </button>
            </div>

            {/* Mode Content */}
            <div className="min-h-[400px]">
              {promptMode === "templates" && (
                <TemplatesMode onSelectTemplate={handleTemplateSelect} />
              )}
              {promptMode === "guided" && (
                <GuidedMode value={editedPrompt} onChange={setEditedPrompt} />
              )}
              {promptMode === "advanced" && (
                <AdvancedMode value={editedPrompt} onChange={setEditedPrompt} />
              )}
            </div>

            {/* Action Buttons */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={
                    updateSystemPromptMutation.isPending ||
                    editedPrompt === DEFAULT_SYSTEM_PROMPT
                  }
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
                <Button
                  onClick={() => setShowSaveConfirm(true)}
                  disabled={
                    updateSystemPromptMutation.isPending ||
                    editedPrompt === (systemPrompt || "")
                  }
                  className="ml-auto"
                >
                  {updateSystemPromptMutation.isPending ? "Saving..." : "Save System Prompt"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-4">
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
          <div className="space-y-4">
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && urlInput.trim()) {
                        addUrlMutation.mutate(urlInput.trim())
                      }
                    }}
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
                          <LinkIcon className="h-4 w-4 text-muted-foreground" />
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

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Save System Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the system prompt will impact all existing conversations. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={() => {
                  updateSystemPromptMutation.mutate(editedPrompt)
                  setShowSaveConfirm(false)
                }}
                disabled={updateSystemPromptMutation.isPending}
              >
                {updateSystemPromptMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Reset to Default</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the system prompt will impact all existing conversations. Are you sure you want to reset to the default prompt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={() => {
                  setEditedPrompt(DEFAULT_SYSTEM_PROMPT)
                  setShowResetConfirm(false)
                }}
              >
                Reset to Default
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
