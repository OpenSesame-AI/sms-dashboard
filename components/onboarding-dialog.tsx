"use client"

import * as React from "react"
import { Check, ChevronRight, ChevronLeft, Upload, Trash2, Link as LinkIcon, FileText } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Cell, CellContext } from "@/lib/db/schema"
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants"
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

type OnboardingDialogProps = {
  open: boolean
  onComplete: (cell: Cell) => void
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [currentStep, setCurrentStep] = React.useState(1)
  const [createdCell, setCreatedCell] = React.useState<Cell | null>(null)
  const [newCellName, setNewCellName] = React.useState("")
  const [newCellCountry, setNewCellCountry] = React.useState("US")
  const queryClient = useQueryClient()
  
  // Check if Clerk popovers are open
  const [isClerkPopoverOpen, setIsClerkPopoverOpen] = React.useState(false)
  
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    
    const checkClerkPopovers = () => {
      const clerkPopovers = document.querySelectorAll(
        '[class*="cl-organizationSwitcherPopover"]:not([style*="display: none"]), ' +
        '[class*="cl-userButtonPopover"]:not([style*="display: none"])'
      )
      setIsClerkPopoverOpen(clerkPopovers.length > 0)
    }
    
    checkClerkPopovers()
    const observer = new MutationObserver(checkClerkPopovers)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    })
    
    const interval = setInterval(checkClerkPopovers, 100)
    
    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [open])

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setCurrentStep(1)
      setCreatedCell(null)
      setNewCellName("")
      setNewCellCountry("US")
    }
  }, [open])

  // Create cell mutation
  const createCellMutation = useMutation({
    mutationFn: async (data: { name: string; country: string }) => {
      const response = await fetch('/api/cells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create cell')
      }
      return response.json()
    },
    onSuccess: async (newCell) => {
      await queryClient.invalidateQueries({ queryKey: ['cells'] })
      setCreatedCell(newCell)
      setCurrentStep(2)
      toast.success("Cell created", {
        description: `${newCell.name} has been created with phone number ${newCell.phoneNumber}`,
      })
    },
    onError: (error) => {
      toast.error("Failed to create cell", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleStep1Next = () => {
    if (!newCellName.trim()) {
      toast.error("Missing required fields", {
        description: "Please fill in the cell name",
      })
      return
    }
    createCellMutation.mutate({
      name: newCellName.trim(),
      country: newCellCountry,
    })
  }

  const handleStep2Next = () => {
    if (createdCell) {
      setCurrentStep(3)
    }
  }

  const handleStep2Skip = () => {
    if (createdCell) {
      setCurrentStep(3)
    }
  }

  const handleComplete = () => {
    if (createdCell) {
      onComplete(createdCell)
    }
  }

  const steps = [
    { number: 1, title: "Create Cell", description: "Set up your first AI SMS agent" },
    { number: 2, title: "Add Context", description: "Provide context for your agent (optional)" },
    { number: 3, title: "Share", description: "Get your QR code and shareable link" },
  ]

  return (
    <Dialog open={open} onOpenChange={() => {}} modal={true}>
      {/* Custom DialogContent without blocking overlay - use Portal directly to avoid default overlay */}
      <DialogPrimitive.Portal>
        {/* Custom overlay that excludes header area (header is 64px / 16rem tall) */}
        {/* Overlay should not interfere with Clerk popovers which are rendered at z-10000+ */}
        {open && (
          <div 
            className="fixed top-16 left-0 right-0 bottom-0 z-[49] bg-black/50 pointer-events-none"
            aria-hidden="true"
            style={{ 
              pointerEvents: 'none',
              // Ensure it doesn't block anything above z-50
              isolation: 'isolate'
            }}
          />
        )}
        {/* Prevent default Radix overlay from rendering */}
        <style dangerouslySetInnerHTML={{ __html: `
          [data-radix-dialog-overlay] {
            display: none !important;
          }
        `}} />
        <DialogPrimitive.Content
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[51] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-2xl",
            isClerkPopoverOpen ? "pointer-events-none" : "pointer-events-auto"
          )}
          style={{
            pointerEvents: isClerkPopoverOpen ? 'none' : 'auto'
          }}
          onPointerDownOutside={(e) => {
            // If Clerk popover is open, don't capture any events
            if (isClerkPopoverOpen) {
              e.preventDefault()
              e.stopPropagation()
              return false
            }
            
            // Allow clicks on header to pass through
            const target = e.target as HTMLElement
            if (!target) return
            
            const isInHeader = target.closest('header')
            const isInClerkPopover = target.closest('[class*="cl-organizationSwitcherPopover"], [class*="cl-userButtonPopover"], [class*="cl-popover"], [class*="cl-rootBox"], [class*="cl-modal"]')
            
            if (isInHeader || isInClerkPopover) {
              e.preventDefault()
              e.stopPropagation()
              return false
            }
          }}
          onInteractOutside={(e) => {
            // If Clerk popover is open, don't capture any events
            if (isClerkPopoverOpen) {
              e.preventDefault()
              e.stopPropagation()
              return false
            }
            
            // Allow clicks on header to pass through
            const target = e.target as HTMLElement
            if (!target) return
            
            const isInHeader = target.closest('header')
            const isInClerkPopover = target.closest('[class*="cl-organizationSwitcherPopover"], [class*="cl-userButtonPopover"], [class*="cl-popover"], [class*="cl-rootBox"], [class*="cl-modal"]')
            
            if (isInHeader || isInClerkPopover) {
              e.preventDefault()
              e.stopPropagation()
              return false
            }
          }}
          onEscapeKeyDown={(e) => {
            // Don't close dialog when Esc is pressed if Clerk popover is open
            const clerkPopovers = document.querySelectorAll('[class*="cl-organizationSwitcherPopover"]:not([style*="display: none"]), [class*="cl-userButtonPopover"]:not([style*="display: none"])')
            if (clerkPopovers.length > 0) {
              e.preventDefault()
            }
          }}
        >
        <DialogHeader>
          <DialogTitle>Welcome to SMS Dashboard</DialogTitle>
          <DialogDescription>
            Let's get you started with your first AI SMS agent
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between py-6">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep > step.number
                      ? "bg-primary border-primary text-primary-foreground"
                      : currentStep === step.number
                      ? "border-primary text-primary bg-primary/10"
                      : "border-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.number ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="font-semibold">{step.number}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div
                    className={`text-sm font-medium ${
                      currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 ${
                    currentStep > step.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px] py-4">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="onboarding-cell-name">Cell Name</Label>
                <Input
                  id="onboarding-cell-name"
                  value={newCellName}
                  onChange={(e) => setNewCellName(e.target.value)}
                  placeholder="e.g., Customer Support, Sales Bot"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleStep1Next()
                    }
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="onboarding-cell-country">Country</Label>
                <Select value={newCellCountry} onValueChange={setNewCellCountry}>
                  <SelectTrigger id="onboarding-cell-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="z-[52]">
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="AU">Australia</SelectItem>
                    <SelectItem value="DE">Germany</SelectItem>
                    <SelectItem value="FR">France</SelectItem>
                    <SelectItem value="ES">Spain</SelectItem>
                    <SelectItem value="IT">Italy</SelectItem>
                    <SelectItem value="NL">Netherlands</SelectItem>
                    <SelectItem value="SE">Sweden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
             
            </div>
          )}

          {currentStep === 2 && createdCell && (
            <OnboardingStep2Context cellId={createdCell.id} />
          )}

          {currentStep === 3 && createdCell && (
            <OnboardingStep3Share cell={createdCell} />
          )}
        </div>

        {/* Footer Navigation */}
        <DialogFooter>
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={createCellMutation.isPending}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          {currentStep === 1 && (
            <Button
              onClick={handleStep1Next}
              disabled={!newCellName.trim() || createCellMutation.isPending}
            >
              {createCellMutation.isPending ? "Creating..." : "Create Cell"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {currentStep === 2 && (
            <>
              <Button variant="outline" onClick={handleStep2Skip}>
                Skip
              </Button>
              <Button onClick={handleStep2Next}>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
          {currentStep === 3 && (
            <Button onClick={handleComplete}>
              Done
            </Button>
          )}
        </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  )
}

// Step 2: Context Management Component
function OnboardingStep2Context({ cellId }: { cellId: string }) {
  const [activeTab, setActiveTab] = React.useState<"text" | "files" | "url">("text")
  const [dragActive, setDragActive] = React.useState(false)
  const [editedPrompt, setEditedPrompt] = React.useState("")
  const [urlInput, setUrlInput] = React.useState("")
  const [showSaveConfirm, setShowSaveConfirm] = React.useState(false)
  const [showResetConfirm, setShowResetConfirm] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Fetch context items
  const { data: contextItems = [] } = useQuery<CellContext[]>({
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

  // Fetch system prompt
  const { data: cellData } = useQuery<Cell>({
    queryKey: ["cell", cellId],
    queryFn: async () => {
      const response = await fetch('/api/cells')
      if (!response.ok) throw new Error('Failed to fetch cells')
      const cells = await response.json()
      return cells.find((c: Cell) => c.id === cellId)
    },
    enabled: !!cellId,
  })

  React.useEffect(() => {
    if (cellData?.systemPrompt) {
      setEditedPrompt(cellData.systemPrompt)
    } else {
      setEditedPrompt(DEFAULT_SYSTEM_PROMPT)
    }
  }, [cellData])

  const fileItems = contextItems.filter((item) => item.type === "file")
  const urlItems = contextItems.filter((item) => item.type === "url")

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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
          name: cellData?.name || "",
          systemPrompt: newPrompt,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update system prompt")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cells"] })
      toast.success("System prompt saved")
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
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊"
    return <FileText className="h-4 w-4" />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add context to help your AI agent understand your business better. This is optional and can be done later.
      </p>

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
          Personality
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
      <div className="max-h-[300px] overflow-y-auto">
        {activeTab === "text" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="onboarding-system-prompt">Personality</Label>
              <Textarea
                id="onboarding-system-prompt"
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                placeholder="Enter the system prompt for this cell..."
                rows={8}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                disabled={
                  updateSystemPromptMutation.isPending ||
                  editedPrompt === DEFAULT_SYSTEM_PROMPT
                }
              >
                Reset to Default
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSaveConfirm(true)}
                disabled={
                  updateSystemPromptMutation.isPending ||
                  editedPrompt === (cellData?.systemPrompt || DEFAULT_SYSTEM_PROMPT)
                }
              >
                {updateSystemPromptMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-4 py-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Maximum file size: 5MB
              </p>
              <Button
                variant="outline"
                size="sm"
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

            {fileItems.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Files</Label>
                <div className="space-y-2">
                  {fileItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="text-lg shrink-0">
                          {getFileIcon(item.mimeType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(item.fileSize)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
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
            <div className="space-y-2">
              <Label htmlFor="onboarding-url-input">Add URL</Label>
              <div className="flex gap-2">
                <Input
                  id="onboarding-url-input"
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
                  {addUrlMutation.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a URL to fetch and use as context for this cell.
              </p>
            </div>

            {urlItems.length > 0 && (
              <div className="space-y-2">
                <Label>Added URLs</Label>
                <div className="space-y-2">
                  {urlItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item.name}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
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
                size="sm"
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
                variant="outline"
                size="sm"
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

// Step 3: Share Component
function OnboardingStep3Share({ cell }: { cell: Cell }) {
  const [copied, setCopied] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const phone = cell.phoneNumber
  const smsLink = `sms:${phone}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(smsLink)}`

  const getShareableUrl = () => {
    if (typeof window === "undefined") return ""
    const baseUrl = window.location.origin
    return `${baseUrl}/c/${cell.id}`
  }

  const handleCopyLink = async () => {
    try {
      const url = getShareableUrl()
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Link copied to clipboard")
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy link")
    }
  }

  const handleDownloadQR = async () => {
    if (!imgRef.current) return

    try {
      const response = await fetch(qrCodeUrl)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `qrcode-${new Date().toISOString().split("T")[0]}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      window.URL.revokeObjectURL(blobUrl)
      toast.success("QR code downloaded")
    } catch (err) {
      console.error("Failed to download QR code:", err)
      toast.error("Failed to download QR code")
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Your cell is ready!</h3>
        <p className="text-sm text-muted-foreground">
          Share your QR code or link to start receiving messages
        </p>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-lg border p-4 bg-white">
          <img
            ref={imgRef}
            src={qrCodeUrl}
            alt="QR Code"
            className="w-64 h-64"
          />
        </div>
        <p className="text-sm text-muted-foreground font-mono break-all text-center max-w-md">
          {smsLink}
        </p>
        <Button onClick={handleDownloadQR} variant="outline" size="sm">
          Download QR Code
        </Button>
      </div>

      {/* Shareable Link */}
      <div className="space-y-2">
        <Label>Shareable Link</Label>
        <div className="flex gap-2">
          <Input
            value={getShareableUrl()}
            readOnly
            className="font-mono text-sm"
          />
          <Button onClick={handleCopyLink} variant="outline">
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Share this link to let others send messages to your AI agent
        </p>
      </div>
    </div>
  )
}

