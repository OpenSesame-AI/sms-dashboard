"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@clerk/nextjs"
import { useCell } from "@/components/cell-context"
import { Cell, CellContext } from "@/lib/db/schema"
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants"
import { CheckCircle2, XCircle, Cloud, Upload, Trash2, Link as LinkIcon, FileText, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react"

const STEPS = [
  { number: 1, title: "Select Input Integrations", description: "Choose which tools your agent will have access to" },
  { number: 2, title: "Add Context", description: "Provide context for your agent (optional)" },
  { number: 3, title: "Select Communication Platform", description: "Choose how your agent communicates" },
]

const PROGRESS_STEPS = STEPS // Progress indicator only shows first 3 steps

export default function CreatePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const { setSelectedCell } = useCell()
  
  const [currentStep, setCurrentStep] = React.useState(1)
  const [newCellName, setNewCellName] = React.useState("")
  const [newCellCountry, setNewCellCountry] = React.useState("US")
  const [selectedIntegrations, setSelectedIntegrations] = React.useState<string[]>([])
  const [systemPrompt, setSystemPrompt] = React.useState(DEFAULT_SYSTEM_PROMPT)
  const [contextFiles, setContextFiles] = React.useState<File[]>([])
  const [contextUrls, setContextUrls] = React.useState<string[]>([])

  // Create cell mutation - called at the end of step 3
  const createCellMutation = useMutation({
    mutationFn: async (data: { 
      name: string
      country: string
      systemPrompt?: string
      contextFiles: File[]
      contextUrls: string[]
      selectedIntegrations: string[]
    }) => {
      // Step 1: Create the cell
      const cellResponse = await fetch('/api/cells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          country: data.country,
        }),
      })
      if (!cellResponse.ok) {
        const error = await cellResponse.json()
        throw new Error(error.error || 'Failed to create cell')
      }
      const newCell = await cellResponse.json()

      // Step 2: Update system prompt if different from default
      if (data.systemPrompt && data.systemPrompt !== DEFAULT_SYSTEM_PROMPT) {
        await fetch('/api/cells', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newCell.id,
            name: newCell.name,
            systemPrompt: data.systemPrompt,
          }),
        })
      }

      // Step 3: Add context files
      for (const file of data.contextFiles) {
        const formData = new FormData()
        formData.append("file", file)
        await fetch(
          `https://web-production-15949.up.railway.app/api/v1/cells/${newCell.id}/context`,
          {
            method: "POST",
            body: formData,
          }
        )
      }

      // Step 4: Add context URLs
      for (const url of data.contextUrls) {
        await fetch(
          `https://web-production-15949.up.railway.app/api/v1/cells/${newCell.id}/context/url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          }
        )
      }

      // Step 5: Connect integrations (for future integrations)
      // Note: Currently all integrations are "Coming Soon", so no connections are made
      // When integrations become available, connection logic will be added here

      return newCell
    },
    onSuccess: async (newCell) => {
      await queryClient.invalidateQueries({ queryKey: ['cells'] })
      setSelectedCell(newCell)
      toast.success("Cell created", {
        description: `${newCell.name} has been created with phone number ${newCell.phoneNumber}`,
      })
      router.push("/table")
    },
    onError: (error) => {
      toast.error("Failed to create cell", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleStep1Next = () => {
    setCurrentStep(2)
  }

  const handleStep2Next = () => {
    setCurrentStep(3)
  }

  const handleStep2Skip = () => {
    setCurrentStep(3)
  }

  const handleStep3Next = () => {
    setCurrentStep(4)
  }

  const handleComplete = () => {
    if (!newCellName.trim()) {
      toast.error("Missing required fields", {
        description: "Please fill in the cell name",
      })
      return
    }
    if (!newCellCountry) {
      toast.error("Missing required fields", {
        description: "Please select a country",
      })
      return
    }
    createCellMutation.mutate({
      name: newCellName.trim(),
      country: newCellCountry,
      systemPrompt,
      contextFiles,
      contextUrls,
      selectedIntegrations,
    })
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      router.back()
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Create New Cell</h1>
          <p className="text-muted-foreground mt-2">
            Set up your AI agent in 3 simple steps
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-8">
          {PROGRESS_STEPS.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep >= step.number
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-muted-foreground"
                  }`}
                >
                  {currentStep > step.number ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <span className="font-semibold">{step.number}</span>
                  )}
                </div>
                <div className="hidden sm:block">
                  <div className="font-medium">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
              {index < PROGRESS_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors ${
                    currentStep > step.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <Card className="border-0 shadow-none">
          <CardContent>
            {currentStep === 1 && (
              <Step1Integrations
                selectedIntegrations={selectedIntegrations}
                setSelectedIntegrations={setSelectedIntegrations}
              />
            )}
            {currentStep === 2 && (
              <Step2Context
                systemPrompt={systemPrompt}
                setSystemPrompt={setSystemPrompt}
                contextFiles={contextFiles}
                setContextFiles={setContextFiles}
                contextUrls={contextUrls}
                setContextUrls={setContextUrls}
                onNext={handleStep2Next}
                onSkip={handleStep2Skip}
              />
            )}
            {currentStep === 3 && (
              <Step3CommunicationPlatform 
                onNext={handleStep3Next}
              />
            )}
            {currentStep === 4 && (
              <Step4CreateCell
                cellName={newCellName}
                setCellName={setNewCellName}
                cellCountry={newCellCountry}
                setCellCountry={setNewCellCountry}
                onComplete={handleComplete}
                isCreating={createCellMutation.isPending}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {currentStep === 1 && (
              <Button onClick={handleStep1Next}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {currentStep === 2 && (
              <Button onClick={handleStep2Next}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {currentStep === 3 && (
              <Button onClick={handleStep3Next}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {currentStep === 4 && (
              <Button 
                onClick={handleComplete}
                disabled={createCellMutation.isPending || !newCellName.trim()}
              >
                {createCellMutation.isPending ? "Creating..." : "Create Cell"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 1: Select Integrations
function Step1Integrations({
  selectedIntegrations,
  setSelectedIntegrations,
}: {
  selectedIntegrations: string[]
  setSelectedIntegrations: (integrations: string[]) => void
}) {

  // Available integrations with examples
  const availableIntegrations = [
    { 
      id: "applied-epic", 
      name: "Applied Epic", 
      available: false, 
      description: "Insurance agency management system integration",
      example: "Access policy information, claims data, and client records",
      iconColor: "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
    },
    { 
      id: "guidewire", 
      name: "Guidewire", 
      available: false, 
      description: "Property and casualty insurance platform",
      example: "Retrieve policy details, claims information, and customer data",
      iconColor: "bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
    }
  ]

  const handleIntegrationToggle = (integrationId: string) => {
    const integration = availableIntegrations.find((i) => i.id === integrationId)
    if (!integration?.available) return

    if (selectedIntegrations.includes(integrationId)) {
      setSelectedIntegrations(selectedIntegrations.filter((id) => id !== integrationId))
    } else {
      setSelectedIntegrations([...selectedIntegrations, integrationId])
    }
  }

  const [suggestionInput, setSuggestionInput] = React.useState("")

  const handleSuggestionSubmit = () => {
    if (suggestionInput.trim()) {
      // Here you could send the suggestion to an API or just show a toast
      toast.success("Suggestion submitted", {
        description: "Thank you for your suggestion! We'll consider adding this integration.",
      })
      setSuggestionInput("")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4">
          <Label className="text-base font-semibold mb-2 block">Select Input Integrations</Label>
          <p className="text-sm text-muted-foreground">
            Choose which tools your agent will have access to. You can select multiple integrations.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {availableIntegrations.map((integration) => {
            const isSelected = selectedIntegrations.includes(integration.id)

            return (
              <Card
                key={integration.id}
                className={`transition-all cursor-pointer ${
                  integration.available
                    ? isSelected
                      ? "border-primary bg-primary/5 shadow-md border-2"
                      : "hover:border-primary/50 hover:shadow-sm"
                    : "opacity-60 cursor-not-allowed"
                }`}
                onClick={() => integration.available && handleIntegrationToggle(integration.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {integration.id === "applied-epic" ? (
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border">
                          <img 
                            src="/applied-epic.png" 
                            alt={integration.name}
                            className="h-5 w-5 object-contain"
                          />
                        </div>
                      ) : integration.id === "guidewire" ? (
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border">
                          <img 
                            src="/guidewire.png" 
                            alt={integration.name}
                            className="h-5 w-5 object-contain"
                          />
                        </div>
                      ) : integration.id === "duck-creek" ? (
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border">
                          <img 
                            src="/duck-creek.png" 
                            alt={integration.name}
                            className="h-5 w-5 object-contain"
                          />
                        </div>
                      ) : (
                        <div className={`p-2 rounded-lg ${integration.iconColor}`}>
                          <Cloud className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {integration.name}
                          {integration.available ? (
                            isSelected ? (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                Selected
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-xs">
                                Available
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {integration.description}
                        </CardDescription>
                      </div>
                    </div>
                    {integration.available && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleIntegrationToggle(integration.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Example:</span> {integration.example}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Integration Suggestions Card */}
          <Card className="transition-all border-dashed">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  
                    <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      Suggest Integration
                      <Badge variant="outline" className="text-xs">New</Badge>
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Have an integration in mind? Let us know!
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="space-y-2">
                <Input
                  placeholder="e.g., Salesforce, HubSpot, Custom API..."
                  value={suggestionInput}
                  onChange={(e) => setSuggestionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && suggestionInput.trim()) {
                      handleSuggestionSubmit()
                    }
                  }}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSuggestionSubmit}
                  disabled={!suggestionInput.trim()}
                  className="w-full"
                >
                  Submit Suggestion
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Step 2: Add Context
function Step2Context({
  systemPrompt,
  setSystemPrompt,
  contextFiles,
  setContextFiles,
  contextUrls,
  setContextUrls,
  onNext,
  onSkip,
}: {
  systemPrompt: string
  setSystemPrompt: (prompt: string) => void
  contextFiles: File[]
  setContextFiles: (files: File[]) => void
  contextUrls: string[]
  setContextUrls: (urls: string[]) => void
  onNext: () => void
  onSkip: () => void
}) {
  const [activeTab, setActiveTab] = React.useState<"text" | "files" | "url">("text")
  const [dragActive, setDragActive] = React.useState(false)
  const [urlInput, setUrlInput] = React.useState("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const validFiles: File[] = []
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large", {
          description: `${file.name} exceeds 5MB limit`,
        })
        return
      }
      validFiles.push(file)
    })
    
    if (validFiles.length > 0) {
      setContextFiles([...contextFiles, ...validFiles])
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      toast.success(`${validFiles.length} file(s) added`)
    }
  }

  const handleRemoveFile = (index: number) => {
    setContextFiles(contextFiles.filter((_, i) => i !== index))
    toast.success("File removed")
  }

  const handleAddUrl = () => {
    if (urlInput.trim() && !contextUrls.includes(urlInput.trim())) {
      setContextUrls([...contextUrls, urlInput.trim()])
      setUrlInput("")
      toast.success("URL added")
    }
  }

  const handleRemoveUrl = (index: number) => {
    setContextUrls(contextUrls.filter((_, i) => i !== index))
    toast.success("URL removed")
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

  const getFileIcon = (file: File) => {
    const mimeType = file.type
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
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "text"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Personality
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "files"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Files ({contextFiles.length})
        </button>
        <button
          onClick={() => setActiveTab("url")}
          className={`px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "url"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          URLs ({contextUrls.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === "text" && (
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter the system prompt for this cell..."
              rows={12}
              className="resize-none max-h-[350px] overflow-y-auto"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
              disabled={systemPrompt === DEFAULT_SYSTEM_PROMPT}
            >
              Reset to Default
            </Button>
          </div>
        </div>
      )}
      {activeTab !== "text" && (
        <div className="max-h-[400px] overflow-y-auto">

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

            {contextFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files</Label>
                <div className="space-y-2">
                  {contextFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="text-lg shrink-0">
                          {getFileIcon(file)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {file.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveFile(index)}
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
                    if (e.key === "Enter" && urlInput.trim() && !contextUrls.includes(urlInput.trim())) {
                      handleAddUrl()
                    }
                  }}
                />
                <Button
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim() || contextUrls.includes(urlInput.trim())}
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a URL to fetch and use as context for this cell.
              </p>
            </div>

            {contextUrls.length > 0 && (
              <div className="space-y-2">
                <Label>Added URLs</Label>
                <div className="space-y-2">
                  {contextUrls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {url}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemoveUrl(index)}
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
      )}
    </div>
  )
}

// Step 3: Communication Platform Selection
function Step3CommunicationPlatform({ 
  onNext
}: { 
  onNext: () => void
}) {
  const [platformSuggestion, setPlatformSuggestion] = React.useState("")

  const platforms = [
    { id: "sms", name: "SMS", available: true, description: "Text messaging via phone numbers" },
    { id: "rcs", name: "RCS", available: false, description: "Rich Communication Services - Coming soon" }
  ]

  const handlePlatformSuggestionSubmit = () => {
    if (platformSuggestion.trim()) {
      toast.success("Suggestion submitted", {
        description: "Thank you for your suggestion! We'll consider adding this communication platform.",
      })
      setPlatformSuggestion("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((platform) => (
          <Card
            key={platform.id}
            className={`${
              platform.available
                ? platform.id === "sms"
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
                : "opacity-50"
            }`}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 flex-1">
                {platform.id === "gmail" ? (
                  <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border">
                    <img 
                      src="/gmail.png" 
                      alt={platform.name}
                      className="h-5 w-5 object-contain"
                    />
                  </div>
                ) : platform.id === "outlook" ? (
                  <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border">
                    <img 
                      src="/outlook.jpeg" 
                      alt={platform.name}
                      className="h-5 w-5 object-contain"
                    />
                  </div>
                ) : platform.id === "slack" ? (
                  <div className="p-2 rounded-lg bg-white dark:bg-gray-800 border">
                    <img 
                      src="/slack.jpeg" 
                      alt={platform.name}
                      className="h-5 w-5 object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{platform.name}</span>
                    {platform.available ? (
                      platform.id === "sms" ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : null
                    ) : (
                      <Badge variant="outline">Coming Soon</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{platform.description}</p>
                </div>
              </div>
              {platform.id === "sms" && (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              )}
            </CardContent>
          </Card>
        ))}

        {/* Communication Platform Suggestions Card */}
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                  <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    Suggest Platform
                    <Badge variant="outline" className="text-xs">New</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    Have a communication platform in mind? Let us know!
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-2">
              <Input
                placeholder="e.g., WhatsApp, Telegram, Teams..."
                value={platformSuggestion}
                onChange={(e) => setPlatformSuggestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && platformSuggestion.trim()) {
                    handlePlatformSuggestionSubmit()
                  }
                }}
                className="text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handlePlatformSuggestionSubmit}
                disabled={!platformSuggestion.trim()}
                className="w-full"
              >
                Submit Suggestion
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Step 4: Create Cell
function Step4CreateCell({
  cellName,
  setCellName,
  cellCountry,
  setCellCountry,
  onComplete,
  isCreating
}: {
  cellName: string
  setCellName: (name: string) => void
  cellCountry: string
  setCellCountry: (country: string) => void
  onComplete: () => void
  isCreating: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="new-cell-name">Cell Name</Label>
          <Input
            id="new-cell-name"
            value={cellName}
            onChange={(e) => setCellName(e.target.value)}
            placeholder="e.g., Contacts, Messages, Conversations"
            autoFocus
            disabled={isCreating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cellName.trim() && !isCreating) {
                onComplete()
              }
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-cell-country">Country</Label>
          <Select value={cellCountry} onValueChange={setCellCountry} disabled={isCreating}>
            <SelectTrigger id="new-cell-country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
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
      
    </div>
  )
}
