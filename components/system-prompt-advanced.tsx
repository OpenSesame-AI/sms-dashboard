"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

type AdvancedModeProps = {
  value: string
  onChange: (value: string) => void
}

const RECOMMENDED_MAX_CHARS = 4000

export function AdvancedMode({ value, onChange }: AdvancedModeProps) {
  const [isGenerateExpanded, setIsGenerateExpanded] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  
  const charCount = value.length
  const variablePattern = /\{[\w_]+\}/g
  const variables = value.match(variablePattern) || []
  const uniqueVariables = Array.from(new Set(variables))

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast.error("Please enter a description")
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate prompt")
      }

      const data = await response.json()
      onChange(data.prompt)
      toast.success("Prompt generated successfully")
      setIsGenerateExpanded(false)
      setDescription("")
    } catch (error) {
      toast.error("Failed to generate prompt", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4 py-4">
      {/* Generate with AI Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          onClick={() => setIsGenerateExpanded(!isGenerateExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Generate with AI</span>
          </div>
          {isGenerateExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {isGenerateExpanded && (
          <>
            <Separator />
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ai-description">Describe your assistant</Label>
                <Input
                  id="ai-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='e.g., "an agent to find a restaurant to go to in Montreal"'
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isGenerating) {
                      e.preventDefault()
                      handleGenerate()
                    }
                  }}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  Describe what you want your SMS assistant to do, and we'll generate a complete system prompt for you.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !description.trim()}
                className="w-full"
              >
                {isGenerating ? "Generating..." : "Generate Prompt"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* System Prompt Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="system-prompt-advanced">System Prompt</Label>
          <div className="text-xs text-muted-foreground">
            {charCount.toLocaleString()} / {RECOMMENDED_MAX_CHARS.toLocaleString()} characters
            {charCount > RECOMMENDED_MAX_CHARS && (
              <span className="text-destructive ml-1">(over limit)</span>
            )}
          </div>
        </div>
        <Textarea
          id="system-prompt-advanced"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter the system prompt for this cell..."
          rows={16}
          className="font-mono text-sm"
        />
        {uniqueVariables.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium">Detected variables:</div>
            <div className="flex flex-wrap gap-2">
              {uniqueVariables.map((variable, index) => (
                <code
                  key={index}
                  className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-mono"
                >
                  {variable}
                </code>
              ))}
            </div>
            <div className="mt-2">
              Variables like <code className="px-1 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">{`{domain_knowledge}`}</code> will be replaced with your uploaded context.
            </div>
          </div>
        )}
        {uniqueVariables.length === 0 && (
          <div className="text-xs text-muted-foreground">
            Tip: Use variables like <code className="px-1 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">{`{domain_knowledge}`}</code> to inject context from uploaded files.
          </div>
        )}
      </div>
    </div>
  )
}

