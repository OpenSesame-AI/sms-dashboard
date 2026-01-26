"use client"

import * as React from "react"
import { FileText, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCell } from "./cell-context"
import { useQuery } from "@tanstack/react-query"
import { substituteTemplateVariables } from "@/lib/utils"
import type { Contact } from "@/lib/data"
import { MessageTemplateDialog } from "./message-template-dialog"

interface MessageTemplateSelectorProps {
  contact?: Contact | null
  onTemplateSelect?: (substitutedContent: string) => void
  className?: string
}

export function MessageTemplateSelector({
  contact,
  onTemplateSelect,
  className,
}: MessageTemplateSelectorProps) {
  const { selectedCell } = useCell()
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("")
  const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false)

  // Fetch templates (only global templates)
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const response = await fetch("/api/message-templates")
      if (!response.ok) {
        throw new Error("Failed to fetch templates")
      }
      return response.json()
    },
    enabled: true,
  })

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find((t: any) => t.id === templateId)
    if (template && onTemplateSelect) {
      const substituted = substituteTemplateVariables(template.content, contact || null)
      onTemplateSelect(substituted)
    }
  }

  if (templates.length === 0 && !isLoading) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsManageDialogOpen(true)}
          className={className}
        >
          <FileText className="h-4 w-4 mr-2" />
          Create Template
        </Button>
        <MessageTemplateDialog
          open={isManageDialogOpen}
          onOpenChange={setIsManageDialogOpen}
        />
      </>
    )
  }

  return (
    <>
      <div className={`flex flex-col gap-2 ${className || ""}`}>
        <Select
          value={selectedTemplateId}
          onValueChange={handleTemplateChange}
        >
          <SelectTrigger className="w-full min-w-[180px]">
            <SelectValue placeholder="Select template..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template: any) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsManageDialogOpen(true)}
          className="w-full"
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage
        </Button>
      </div>
      <MessageTemplateDialog
        open={isManageDialogOpen}
        onOpenChange={setIsManageDialogOpen}
      />
    </>
  )
}
