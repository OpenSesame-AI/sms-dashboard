"use client"

import * as React from "react"
import { Table2, Pencil, Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCell } from "./cell-context"
import { Cell } from "@/lib/db/schema"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { OnboardingDialog } from "./onboarding-dialog"
import { useOrganization } from "@clerk/nextjs"

export function TableSelector() {
  const { selectedCell, setSelectedCell } = useCell()
  const queryClient = useQueryClient()
  const { organization } = useOrganization()
  
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState("")
  const [cellToRename, setCellToRename] = React.useState<Cell | null>(null)
  const [isAddCellDialogOpen, setIsAddCellDialogOpen] = React.useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = React.useState(false)
  const [newCellName, setNewCellName] = React.useState("")
  const [newCellCountry, setNewCellCountry] = React.useState("US")
  const isClosingAfterSuccess = React.useRef(false)

  // Include organization ID in query key so React Query treats different org contexts as separate queries
  const orgId = organization?.id || null
  const queryKey = ['cells', orgId]

  // Fetch cells from API
  const { data: cells = [], isLoading } = useQuery<Cell[]>({
    queryKey,
    queryFn: async () => {
      const response = await fetch('/api/cells')
      if (!response.ok) {
        throw new Error('Failed to fetch cells')
      }
      return response.json()
    },
  })

  // When cells change (e.g., after org switch), check if selected cell is still valid
  React.useEffect(() => {
    if (!isLoading && cells.length > 0) {
      // If there's a selected cell, check if it's still in the current cells list
      if (selectedCell) {
        const isStillValid = cells.some(cell => cell.id === selectedCell.id)
        if (!isStillValid) {
          // Selected cell is no longer available (e.g., switched org), select first available
          setSelectedCell(cells[0])
        }
      } else {
        // No selected cell, auto-select first one
        setSelectedCell(cells[0])
      }
    } else if (!isLoading && cells.length === 0 && selectedCell) {
      // No cells available but we have a selected cell, clear it
      setSelectedCell(null)
    }
  }, [cells, selectedCell, isLoading, setSelectedCell])

  // Track if Clerk dialogs are open
  const [isClerkDialogOpen, setIsClerkDialogOpen] = React.useState(false)

  // Watch for Clerk dialogs opening/closing
  React.useEffect(() => {
    if (typeof document === 'undefined') return

    const checkClerkDialogs = () => {
      // Check for Clerk's dialog/modal elements - check for OrganizationSwitcher popover specifically
      const clerkDialogs = document.querySelectorAll(
        '[class*="cl-organizationSwitcherPopover"]:not([style*="display: none"]), ' +
        '[class*="cl-"] [role="dialog"]:not([style*="display: none"]), ' +
        '[class*="cl-"] [data-state="open"]:not([style*="display: none"])'
      )
      setIsClerkDialogOpen(clerkDialogs.length > 0)
    }

    // Check immediately
    checkClerkDialogs()

    // Watch for changes in the DOM
    const observer = new MutationObserver(checkClerkDialogs)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-state', 'style']
    })

    // Also check periodically as a fallback
    const interval = setInterval(checkClerkDialogs, 200)

    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [])

  // Auto-open Onboarding dialog if user has no cells
  React.useEffect(() => {
    // Don't open onboarding if Clerk dialogs are open (e.g., OrganizationSwitcher, invite members)
    if (!isLoading && cells.length === 0 && !isOnboardingOpen && !isAddCellDialogOpen && !isClerkDialogOpen) {
      setIsOnboardingOpen(true)
    }
  }, [isLoading, cells.length, isOnboardingOpen, isAddCellDialogOpen, isClerkDialogOpen])

  // Create cell mutation
  const createCellMutation = useMutation({
    mutationFn: async (data: { name: string; country: string }) => {
      const response = await fetch('/api/cells', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create cell')
      }
      return response.json()
    },
    onSuccess: async (newCell) => {
      // Mark that we're closing due to successful creation
      isClosingAfterSuccess.current = true
      // Close dialog first before invalidating queries to prevent race condition
      setIsAddCellDialogOpen(false)
      setNewCellName("")
      setNewCellCountry("US")
      setSelectedCell(newCell)
      // Invalidate queries after dialog is closed
      await queryClient.invalidateQueries({ queryKey: ['cells'] })
      // Reset the flag after a short delay to allow dialog to close
      setTimeout(() => {
        isClosingAfterSuccess.current = false
      }, 100)
      toast.success("Cell created", {
        description: `${newCell.name} has been created with phone number ${newCell.phoneNumber}`,
      })
    },
    onError: (error) => {
      toast.error("Failed to create cell", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  // Update cell mutation
  const updateCellMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; phoneNumber?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['cells'] })
      if (selectedCell?.id === updatedCell.id) {
        setSelectedCell(updatedCell)
      }
      setIsRenameDialogOpen(false)
      setCellToRename(null)
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
      queryClient.invalidateQueries({ queryKey: ['cells'] })
      if (selectedCell && cellToRename?.id === selectedCell.id) {
        setSelectedCell(null)
      }
      toast.success("Cell deleted")
    },
    onError: (error) => {
      toast.error("Failed to delete cell", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    },
  })

  const handleRenameClick = (cell: Cell, e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    setCellToRename(cell)
    setRenameValue(cell.name)
    setIsRenameDialogOpen(true)
  }

  const handleRename = () => {
    if (!cellToRename || !renameValue.trim()) return
    updateCellMutation.mutate({
      id: cellToRename.id,
      name: renameValue.trim(),
    })
  }

  const handleAddCell = () => {
    if (!newCellName.trim()) {
      toast.error("Missing required fields", {
        description: "Please fill in the cell name",
      })
      return
    }
    createCellMutation.mutate({
      name: newCellName.trim(),
      country: newCellCountry,
    })
  }

  const handleDeleteCell = (cell: Cell, e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (confirm(`Are you sure you want to delete "${cell.name}"?`)) {
      deleteCellMutation.mutate(cell.id)
    }
  }

  const handleDialogClose = (open: boolean) => {
    // Prevent closing if user has no cells - they must create at least one
    // But allow closing if we're closing after successful creation
    if (!open && cells.length === 0 && !isLoading && !isClosingAfterSuccess.current) {
      return
    }
    setIsAddCellDialogOpen(open)
    if (!open) {
      setNewCellName("")
      setNewCellCountry("US")
    }
  }

  const handleOnboardingComplete = (cell: Cell) => {
    setIsOnboardingOpen(false)
    setSelectedCell(cell)
    toast.success("Onboarding complete!", {
      description: "Your cell is ready to receive messages",
    })
  }

  const selectedCellLabel = selectedCell?.name || (isLoading ? "Loading..." : "Select cell")

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[180px] h-8 justify-start gap-2" disabled={isLoading}>
            <Table2 className="h-4 w-4" />
            <span className="flex-1 text-left">{selectedCellLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[180px]">
          {cells.map((cell) => (
            <div key={cell.id} className="group">
              <DropdownMenuItem
                onClick={() => setSelectedCell(cell)}
                className="flex items-center justify-between"
              >
                <span>{cell.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleRenameClick(cell, e)}
                  >
                    <Pencil className="h-3 w-3" />
                    <span className="sr-only">Rename {cell.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleDeleteCell(cell, e)}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Delete {cell.name}</span>
                  </Button>
                </div>
              </DropdownMenuItem>
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsAddCellDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Cell
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

      <Dialog open={isAddCellDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Cell</DialogTitle>
            <DialogDescription>
              Create a new AI SMS agent cell. A phone number will be automatically purchased from Twilio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-cell-name">Cell Name</Label>
              <Input
                id="new-cell-name"
                value={newCellName}
                onChange={(e) => setNewCellName(e.target.value)}
                placeholder="e.g., Contacts, Messages, Conversations"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-cell-country">Country</Label>
              <Select value={newCellCountry} onValueChange={setNewCellCountry}>
                <SelectTrigger id="new-cell-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="ES">Spain</SelectItem>
                  <SelectItem value="IT">Italy</SelectItem>
                  <SelectItem value="NL">Netherlands</SelectItem>
                  <SelectItem value="SE">Sweden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddCell} 
              disabled={!newCellName.trim() || createCellMutation.isPending}
            >
              {createCellMutation.isPending ? "Purchasing number..." : "Add Cell"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OnboardingDialog
        open={isOnboardingOpen}
        onComplete={handleOnboardingComplete}
      />
    </>
  )
}

