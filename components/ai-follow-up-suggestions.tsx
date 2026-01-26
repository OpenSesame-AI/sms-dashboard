"use client"

import * as React from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useCell } from "./cell-context"

interface AiFollowUpSuggestionsProps {
  phoneNumber: string
  onSelect: (suggestion: string) => void
  children: React.ReactNode
}

export function AiFollowUpSuggestions({
  phoneNumber,
  onSelect,
  children,
}: AiFollowUpSuggestionsProps) {
  const { selectedCell } = useCell()
  const [open, setOpen] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchSuggestions = React.useCallback(async () => {
    if (!phoneNumber) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/ai-follow-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          cellId: selectedCell?.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch suggestions")
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (err) {
      console.error("Error fetching AI suggestions:", err)
      setError(err instanceof Error ? err.message : "Failed to load suggestions")
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [phoneNumber, selectedCell?.id])

  // Fetch suggestions when popover opens
  React.useEffect(() => {
    if (open && suggestions.length === 0 && !isLoading && !error) {
      fetchSuggestions()
    }
  }, [open, fetchSuggestions, suggestions.length, isLoading, error])

  const handleSelect = (suggestion: string) => {
    onSelect(suggestion)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">AI Suggestions</h4>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating suggestions...
              </span>
            </div>
          )}

          {error && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSuggestions}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}

          {!isLoading && !error && suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full text-left justify-start h-auto py-2 px-3 whitespace-normal"
                  onClick={() => handleSelect(suggestion)}
                >
                  <span className="text-sm">{suggestion}</span>
                </Button>
              ))}
            </div>
          )}

          {!isLoading && !error && suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No suggestions available
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
