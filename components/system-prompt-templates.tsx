"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SYSTEM_PROMPT_TEMPLATES } from "@/lib/constants"

type TemplatesModeProps = {
  onSelectTemplate: (templateId: string) => void
}

export function TemplatesMode({ onSelectTemplate }: TemplatesModeProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Choose a template to get started, then customize it in Advanced mode.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SYSTEM_PROMPT_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelectTemplate(template.id)}
          >
            <CardHeader>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <CardDescription className="text-sm">
                {template.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}




