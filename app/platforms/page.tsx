"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle2, Lightbulb, MessagesSquare } from "lucide-react"

export default function PlatformsPage() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platforms</h1>
        <p className="text-muted-foreground">
          Manage communication platforms and channels for your SMS dashboard.
        </p>
      </div>
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
                      <MessagesSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
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
    </div>
  )
}
