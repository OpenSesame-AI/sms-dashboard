"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { substituteTemplateVariables } from "@/lib/utils"
import type { Contact } from "@/lib/data"

interface MessageTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cellId?: string | null // Kept for backward compatibility but not used
  editingTemplate?: any | null
}

// Sample contact for preview
const sampleContact: Contact = {
  id: "sample",
  phoneNumber: "+1234567890",
  userId: "sample",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  accountName: "Acme Corp",
  companyName: "Acme Corporation",
  lastMessage: null,
  status: null,
  numberOfMessages: 0,
  started: null,
  lastActivity: null,
  lastMessageDirection: null,
  lastSeenActivity: null,
}

export function MessageTemplateDialog({
  open,
  onOpenChange,
  cellId,
  editingTemplate,
}: MessageTemplateDialogProps) {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [templateName, setTemplateName] = React.useState("")
  const [templateContent, setTemplateContent] = React.useState("")
  const [previewContent, setPreviewContent] = React.useState("")

  // Initialize form when editingTemplate prop changes
  React.useEffect(() => {
    if (editingTemplate && open) {
      setIsEditing(true)
      setIsCreating(false)
      setEditingId(editingTemplate.id)
      setTemplateName(editingTemplate.name)
      setTemplateContent(editingTemplate.content)
    } else if (open && !editingTemplate) {
      setIsCreating(true)
      setIsEditing(false)
      setEditingId(null)
      setTemplateName("")
      setTemplateContent("")
    }
  }, [editingTemplate, open])

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
    enabled: open,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      const response = await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          content: data.content,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create template")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-templates"] })
      toast.success("Template created successfully")
      setIsCreating(false)
      setTemplateName("")
      setTemplateContent("")
      setPreviewContent("")
    },
    onError: (error: Error) => {
      toast.error("Failed to create template", {
        description: error.message,
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; content: string }) => {
      const response = await fetch(`/api/message-templates/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          content: data.content,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update template")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-templates"] })
      toast.success("Template updated successfully")
      setIsEditing(false)
      setEditingId(null)
      setTemplateName("")
      setTemplateContent("")
      setPreviewContent("")
    },
    onError: (error: Error) => {
      toast.error("Failed to update template", {
        description: error.message,
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/message-templates/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete template")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-templates"] })
      toast.success("Template deleted successfully")
    },
    onError: (error: Error) => {
      toast.error("Failed to delete template", {
        description: error.message,
      })
    },
  })

  // Update preview when content changes
  React.useEffect(() => {
    if (templateContent) {
      const preview = substituteTemplateVariables(templateContent, sampleContact)
      setPreviewContent(preview)
    } else {
      setPreviewContent("")
    }
  }, [templateContent])

  const handleStartCreate = () => {
    setIsCreating(true)
    setIsEditing(false)
    setEditingId(null)
    setTemplateName("")
    setTemplateContent("")
  }

  const handleStartEdit = (template: any) => {
    setIsEditing(true)
    setIsCreating(false)
    setEditingId(template.id)
    setTemplateName(template.name)
    setTemplateContent(template.content)
  }

  const handleCancel = () => {
    setIsCreating(false)
    setIsEditing(false)
    setEditingId(null)
    setTemplateName("")
    setTemplateContent("")
    setPreviewContent("")
  }

  const handleSave = () => {
    if (!templateName.trim() || !templateContent.trim()) {
      toast.error("Please fill in all fields")
      return
    }

    if (isEditing && editingId) {
      updateMutation.mutate({
        id: editingId,
        name: templateName.trim(),
        content: templateContent.trim(),
      })
    } else {
      createMutation.mutate({
        name: templateName.trim(),
        content: templateContent.trim(),
      })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate(id)
    }
  }

  const availableVariables = [
    "{firstName}",
    "{lastName}",
    "{fullName}",
    "{email}",
    "{phoneNumber}",
    "{accountName}",
    "{companyName}",
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Templates</DialogTitle>
          <DialogDescription>
            Create and manage message templates with variable substitution.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Available Variables */}
          <div className="border rounded-lg p-4">
            <Label className="text-sm font-semibold mb-2">Available Variables</Label>
            <div className="flex flex-wrap gap-2">
              {availableVariables.map((variable) => (
                <code
                  key={variable}
                  className="px-2 py-1 bg-muted rounded text-xs cursor-pointer hover:bg-muted/80"
                  onClick={() => {
                    setTemplateContent((prev) => prev + variable)
                  }}
                >
                  {variable}
                </code>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Click a variable to insert it into your template
            </p>
          </div>

          {/* Template List or Form */}
          {!isCreating && !isEditing ? (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold">Templates</h3>
                <Button onClick={handleStartCreate} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No templates yet. Create your first template to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template: any) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 flex justify-between items-start"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{template.name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.content}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Welcome Message"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="template-content">Template Content</Label>
                  <Textarea
                    id="template-content"
                    placeholder="Hello {firstName}, welcome to {companyName}!"
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    rows={6}
                  />
                </div>
                {previewContent && (
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview (with sample data)
                    </Label>
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <p className="text-sm whitespace-pre-wrap">{previewContent}</p>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    !templateName.trim() ||
                    !templateContent.trim() ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {isEditing ? "Update" : "Create"} Template
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
