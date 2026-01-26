"use client"

import * as React from "react"
import { MessageTemplateDialog } from "@/components/message-template-dialog"
import { Button } from "@/components/ui/button"
import { MessageSquare, Plus, Pencil, Trash2 } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export default function TemplatesPage() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<any>(null)
  const queryClient = useQueryClient()

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

  const handleCreate = () => {
    setEditingTemplate(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (template: any) => {
    setEditingTemplate(template)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate(id)
    }
  }

  // Templates are now global, so we don't need to check for selectedCell

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage global message templates with variable substitution
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Templates List */}
      <div className="border rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first template to get started with personalized messages.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {templates.map((template: any) => (
              <div
                key={template.id}
                className="p-6 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {template.content}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Created {new Date(template.createdAt).toLocaleDateString()}
                      {template.updatedAt !== template.createdAt && (
                        <span> • Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Variables */}
      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Available Variables</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use these variables in your templates to personalize messages:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: "{firstName}", desc: "Contact's first name" },
            { name: "{lastName}", desc: "Contact's last name" },
            { name: "{fullName}", desc: "Full name (first + last)" },
            { name: "{email}", desc: "Contact's email address" },
            { name: "{phoneNumber}", desc: "Contact's phone number" },
            { name: "{accountName}", desc: "Salesforce account name" },
            { name: "{companyName}", desc: "HubSpot company name" },
          ].map((variable) => (
            <div
              key={variable.name}
              className="border rounded-lg p-3 bg-muted/50"
            >
              <code className="text-sm font-mono font-semibold">{variable.name}</code>
              <p className="text-xs text-muted-foreground mt-1">{variable.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <MessageTemplateDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingTemplate(null)
          }
        }}
        editingTemplate={editingTemplate}
      />
    </div>
  )
}
