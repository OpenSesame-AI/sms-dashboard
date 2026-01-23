"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Cloud, Lightbulb } from "lucide-react"

export default function ToolsPage() {
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

  const [suggestionInput, setSuggestionInput] = React.useState("")

  const handleSuggestionSubmit = () => {
    if (suggestionInput.trim()) {
      toast.success("Suggestion submitted", {
        description: "Thank you for your suggestion! We'll consider adding this integration.",
      })
      setSuggestionInput("")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tools</h1>
        <p className="text-muted-foreground">
          Access helpful tools and utilities for your SMS dashboard.
        </p>
      </div>
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
              return (
                <Card
                  key={integration.id}
                  className={`transition-all ${
                    integration.available
                      ? "hover:border-primary/50 hover:shadow-sm"
                      : "opacity-60 cursor-not-allowed"
                  }`}
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
                              <Badge variant="outline" className="gap-1 text-xs">
                                Available
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1 text-xs">
                            {integration.description}
                          </CardDescription>
                        </div>
                      </div>
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
    </div>
  )
}
