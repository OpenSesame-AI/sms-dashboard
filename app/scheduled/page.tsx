"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock, Calendar, Pencil, Trash2, Loader2, Send, AlertCircle, CheckCircle, XCircle, Plus, Search, X, Users } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useCell } from "@/components/cell-context"
import { Checkbox } from "@/components/ui/checkbox"

type Contact = {
  id: string
  phoneNumber: string
  firstName?: string
  lastName?: string
  email?: string
}

type ScheduledMessage = {
  id: string
  cellId: string
  message: string
  recipients: string[]
  scheduledFor: string
  status: string
  createdBy: string
  createdAt: string
  sentAt: string | null
  error: string | null
  cellName?: string
  cellPhoneNumber?: string
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  sent: { label: "Sent", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: AlertCircle },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
}

export default function ScheduledPage() {
  const { selectedCell } = useCell()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingMessage, setEditingMessage] = React.useState<ScheduledMessage | null>(null)
  const [editForm, setEditForm] = React.useState({
    message: "",
    scheduledDate: "",
    scheduledTime: "",
  })
  
  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({
    message: "",
    scheduledDate: "",
    scheduledTime: "",
  })
  const [selectedRecipients, setSelectedRecipients] = React.useState<string[]>([])
  const [contactSearch, setContactSearch] = React.useState("")
  const [manualPhoneNumber, setManualPhoneNumber] = React.useState("")

  // Fetch contacts for the selected cell
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["contacts", selectedCell?.id],
    queryFn: async () => {
      if (!selectedCell?.id) return []
      const response = await fetch(`/api/contacts?cellId=${selectedCell.id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch contacts")
      }
      return response.json()
    },
    enabled: !!selectedCell?.id && createDialogOpen,
  })

  // Filter contacts based on search
  const filteredContacts = React.useMemo(() => {
    if (!contactSearch.trim()) return contacts
    const search = contactSearch.toLowerCase()
    return contacts.filter(contact => 
      contact.phoneNumber.toLowerCase().includes(search) ||
      contact.firstName?.toLowerCase().includes(search) ||
      contact.lastName?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search)
    )
  }, [contacts, contactSearch])

  // Fetch scheduled messages
  const { data: scheduledMessages = [], isLoading, error } = useQuery({
    queryKey: ["scheduled-messages", selectedCell?.id, statusFilter],
    queryFn: async () => {
      if (!selectedCell?.id) return []
      const url = statusFilter === "all"
        ? `/api/scheduled-messages?cellId=${selectedCell.id}`
        : `/api/scheduled-messages?cellId=${selectedCell.id}&status=${statusFilter}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch scheduled messages")
      }
      return response.json()
    },
    enabled: !!selectedCell?.id,
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { message?: string; scheduledFor?: string } }) => {
      const response = await fetch(`/api/scheduled-messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update scheduled message")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] })
      toast.success("Scheduled message updated")
      setEditDialogOpen(false)
      setEditingMessage(null)
    },
    onError: (error: Error) => {
      toast.error("Failed to update", { description: error.message })
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/scheduled-messages/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to cancel scheduled message")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] })
      toast.success("Scheduled message cancelled")
    },
    onError: (error: Error) => {
      toast.error("Failed to cancel", { description: error.message })
    },
  })

  // Hard delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/scheduled-messages/${id}?hard=true`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete scheduled message")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] })
      toast.success("Scheduled message deleted")
    },
    onError: (error: Error) => {
      toast.error("Failed to delete", { description: error.message })
    },
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { cellId: string; message: string; recipients: string[]; scheduledFor: string }) => {
      const response = await fetch("/api/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create scheduled message")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] })
      toast.success("Message scheduled successfully")
      setCreateDialogOpen(false)
      setCreateForm({ message: "", scheduledDate: "", scheduledTime: "" })
    },
    onError: (error: Error) => {
      toast.error("Failed to schedule message", { description: error.message })
    },
  })

  const handleCreate = () => {
    setCreateForm({
      message: "",
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: "",
    })
    setSelectedRecipients([])
    setContactSearch("")
    setManualPhoneNumber("")
    setCreateDialogOpen(true)
  }

  const handleToggleRecipient = (phoneNumber: string) => {
    setSelectedRecipients(prev => 
      prev.includes(phoneNumber)
        ? prev.filter(p => p !== phoneNumber)
        : [...prev, phoneNumber]
    )
  }

  const handleAddManualNumber = () => {
    const trimmed = manualPhoneNumber.trim()
    if (trimmed && !selectedRecipients.includes(trimmed)) {
      setSelectedRecipients(prev => [...prev, trimmed])
      setManualPhoneNumber("")
    }
  }

  const handleRemoveRecipient = (phoneNumber: string) => {
    setSelectedRecipients(prev => prev.filter(p => p !== phoneNumber))
  }

  const handleSaveCreate = () => {
    if (!selectedCell?.id) return

    const scheduledFor = new Date(`${createForm.scheduledDate}T${createForm.scheduledTime}`)
    
    if (isNaN(scheduledFor.getTime())) {
      toast.error("Invalid date/time")
      return
    }

    if (scheduledFor <= new Date()) {
      toast.error("Schedule time must be in the future")
      return
    }

    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient")
      return
    }

    createMutation.mutate({
      cellId: selectedCell.id,
      message: createForm.message,
      recipients: selectedRecipients,
      scheduledFor: scheduledFor.toISOString(),
    })
  }

  const handleEdit = (message: ScheduledMessage) => {
    const scheduledDate = new Date(message.scheduledFor)
    setEditingMessage(message)
    setEditForm({
      message: message.message,
      scheduledDate: scheduledDate.toISOString().split('T')[0],
      scheduledTime: scheduledDate.toTimeString().slice(0, 5),
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (!editingMessage) return

    const scheduledFor = new Date(`${editForm.scheduledDate}T${editForm.scheduledTime}`)
    
    if (isNaN(scheduledFor.getTime())) {
      toast.error("Invalid date/time")
      return
    }

    if (scheduledFor <= new Date()) {
      toast.error("Schedule time must be in the future")
      return
    }

    updateMutation.mutate({
      id: editingMessage.id,
      data: {
        message: editForm.message,
        scheduledFor: scheduledFor.toISOString(),
      },
    })
  }

  const handleCancel = (id: string) => {
    if (confirm("Are you sure you want to cancel this scheduled message?")) {
      cancelMutation.mutate(id)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to permanently delete this scheduled message?")) {
      deleteMutation.mutate(id)
    }
  }

  const formatScheduledTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatRecipients = (recipients: string[]) => {
    if (recipients.length === 1) return recipients[0]
    if (recipients.length <= 3) return recipients.join(", ")
    return `${recipients.slice(0, 2).join(", ")} +${recipients.length - 2} more`
  }

  if (!selectedCell) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Select a Cell</h2>
        <p className="text-muted-foreground">
          Please select a cell from the sidebar to view scheduled messages.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Messages</h1>
          <p className="text-muted-foreground mt-1">
            View and manage messages scheduled to be sent later
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="text-sm text-muted-foreground">
              Filter:
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Message
          </Button>
        </div>
      </div>

      {/* Messages List */}
      <div className="border rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading scheduled messages...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p>Failed to load scheduled messages</p>
          </div>
        ) : scheduledMessages.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled messages</h3>
            <p className="text-muted-foreground mb-4">
              {statusFilter === "all"
                ? "Schedule a message to send it at a future time."
                : `No ${statusFilter} messages found.`}
            </p>
            {statusFilter === "all" && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Message
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {scheduledMessages.map((msg: ScheduledMessage) => {
              const config = statusConfig[msg.status] || statusConfig.pending
              const StatusIcon = config.icon
              
              return (
                <div
                  key={msg.id}
                  className="p-6 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={config.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatScheduledTime(msg.scheduledFor)}
                        </span>
                      </div>
                      
                      <p className="text-sm whitespace-pre-wrap break-words mb-2">
                        {msg.message}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          To: {formatRecipients(msg.recipients)}
                        </span>
                        {msg.sentAt && (
                          <span>• Sent {new Date(msg.sentAt).toLocaleString()}</span>
                        )}
                        {msg.error && (
                          <span className="text-destructive">• Error: {msg.error}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 shrink-0">
                      {msg.status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(msg)}
                            disabled={updateMutation.isPending}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(msg.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(msg.status === "sent" || msg.status === "failed" || msg.status === "cancelled") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(msg.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Scheduled Message</DialogTitle>
            <DialogDescription>
              Update the message content or reschedule the send time.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-message">Message</Label>
              <Textarea
                id="edit-message"
                value={editForm.message}
                onChange={(e) => setEditForm(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.scheduledDate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time">Time</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={editForm.scheduledTime}
                  onChange={(e) => setEditForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                />
              </div>
            </div>
            
            {editingMessage && (
              <div className="text-xs text-muted-foreground">
                Recipients: {formatRecipients(editingMessage.recipients)}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending || !editForm.message.trim() || !editForm.scheduledDate || !editForm.scheduledTime}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Schedule New Message</DialogTitle>
            <DialogDescription>
              Create a new scheduled message to be sent at a future time.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            {/* Recipients Section */}
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-0">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recipients ({selectedRecipients.length} selected)
              </Label>
              
              {/* Selected Recipients */}
              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-md">
                  {selectedRecipients.map(phone => {
                    const contact = contacts.find(c => c.phoneNumber === phone)
                    return (
                      <Badge key={phone} variant="secondary" className="flex items-center gap-1 pr-1">
                        {contact?.firstName || contact?.lastName 
                          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                          : phone}
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(phone)}
                          className="ml-1 hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Contact List */}
              <div className="border rounded-md flex-1 overflow-y-auto min-h-[120px] max-h-[200px]">
                {filteredContacts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {contacts.length === 0 ? "No contacts found" : "No matching contacts"}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredContacts.slice(0, 50).map(contact => (
                      <label
                        key={contact.id}
                        className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedRecipients.includes(contact.phoneNumber)}
                          onCheckedChange={() => handleToggleRecipient(contact.phoneNumber)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {contact.firstName || contact.lastName 
                              ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                              : contact.phoneNumber}
                          </div>
                          {(contact.firstName || contact.lastName) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {contact.phoneNumber}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                    {filteredContacts.length > 50 && (
                      <div className="p-2 text-center text-xs text-muted-foreground">
                        Showing first 50 results. Refine your search.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Manual Phone Number Entry */}
              <div className="flex gap-2">
                <Input
                  placeholder="Or enter phone number manually..."
                  value={manualPhoneNumber}
                  onChange={(e) => setManualPhoneNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddManualNumber()
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={handleAddManualNumber}
                  disabled={!manualPhoneNumber.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create-message">Message</Label>
              <Textarea
                id="create-message"
                placeholder="Type your message here..."
                value={createForm.message}
                onChange={(e) => setCreateForm(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-date">Date</Label>
                <Input
                  id="create-date"
                  type="date"
                  value={createForm.scheduledDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-time">Time</Label>
                <Input
                  id="create-time"
                  type="time"
                  value={createForm.scheduledTime}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCreate}
              disabled={createMutation.isPending || !createForm.message.trim() || selectedRecipients.length === 0 || !createForm.scheduledDate || !createForm.scheduledTime}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
