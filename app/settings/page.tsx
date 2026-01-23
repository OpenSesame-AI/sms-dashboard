"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useCell } from "@/components/cell-context"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@clerk/nextjs"

export default function SettingsPage() {
  const router = useRouter()
  const { selectedCell, setSelectedCell } = useCell()
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  const orgId = organization?.id || null

  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)

  // Update cell mutation
  const updateCellMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      const response = await fetch('/api/cells', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update cell')
      }
      return response.json()
    },
    onSuccess: (updatedCell) => {
      queryClient.invalidateQueries({ queryKey: ['cells', orgId] })
      if (selectedCell?.id === updatedCell.id) {
        setSelectedCell(updatedCell)
      }
      setIsRenameDialogOpen(false)
      setRenameValue("")
      toast.success("Cell updated", {
        description: `${updatedCell.name} has been updated`,
      })
    },
    onError: (error) => {
      toast.error("Failed to update cell", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Delete cell mutation
  const deleteCellMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cells?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete cell')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cells', orgId] })
      if (selectedCell) {
        setSelectedCell(null)
      }
      setIsDeleteDialogOpen(false)
      toast.success("Cell deleted")
      // Redirect to home page if cell was deleted
      router.push("/")
    },
    onError: (error) => {
      toast.error("Failed to delete cell", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleRenameClick = () => {
    if (!selectedCell) return
    setRenameValue(selectedCell.name)
    setIsRenameDialogOpen(true)
  }

  const handleRename = () => {
    if (!selectedCell || !renameValue.trim()) return
    updateCellMutation.mutate({
      id: selectedCell.id,
      name: renameValue.trim(),
    })
  }

  const handleDeleteClick = () => {
    if (!selectedCell) return
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = () => {
    if (!selectedCell) return
    deleteCellMutation.mutate(selectedCell.id)
  }

  if (!selectedCell) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        <div className="rounded-lg border p-6">
          <p className="text-muted-foreground">
            Please select a cell to manage its settings.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your cell settings and preferences.
        </p>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Cell Settings</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Cell Name</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={selectedCell.name}
                  disabled
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRenameClick}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Phone Number</Label>
              <div className="mt-2">
                <Input
                  value={selectedCell.phoneNumber}
                  disabled
                  className="font-mono"
                />
              </div>
            </div>
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium text-destructive">Danger Zone</Label>
              <div className="mt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Cell
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Permanently delete this cell and all its data. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Cell</DialogTitle>
            <DialogDescription>
              Enter a new name for this cell.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cell-name">Cell Name</Label>
              <Input
                id="cell-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter cell name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename()
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRename} 
              disabled={!renameValue.trim() || updateCellMutation.isPending}
            >
              {updateCellMutation.isPending ? "Saving..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedCell.name}" and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCellMutation.isPending}
            >
              {deleteCellMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
