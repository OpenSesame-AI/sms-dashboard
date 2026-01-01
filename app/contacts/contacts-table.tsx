"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTablePagination } from "@/components/data-table-pagination"
import { Contact, ConversationMessage } from "@/lib/data"
import { Plus, X, GripVertical, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download, Search, Pencil, Funnel, Bell, AlertTriangle, WandSparkles, Settings, Eye, EyeOff, Copy, ArrowLeft, ArrowRight, Pin, Info, Palette, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCell } from "@/components/cell-context"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable"
import { SortableColumnHeader } from "@/components/sortable-column-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ContactsTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data?: TData[] // Made optional since we'll fetch client-side
}

export function ContactsTable<TData, TValue>({
  columns: initialColumns,
  data: initialData,
}: ContactsTableProps<TData, TValue>) {
  const { selectedCell } = useCell()
  
  // Use useState instead of React Query to avoid fetch stalling issues
  const [contactsData, setContactsData] = React.useState<Contact[]>(initialData as Contact[] || [])
  const [isLoadingContacts, setIsLoadingContacts] = React.useState(false)
  const [contactsError, setContactsError] = React.useState<Error | null>(null)
  const [hasInitialData, setHasInitialData] = React.useState(!!initialData)
  
  // Compute unread phone numbers from contact data (using DB state)
  const unreadPhoneNumbers = React.useMemo(() => {
    const unread = new Set<string>()
    contactsData.forEach((contact) => {
      // Contact is unread if:
      // 1. Last message is inbound
      // 2. Has activity
      // 3. Never seen OR last activity is newer than last seen
      if (
        contact.lastMessageDirection === 'inbound' &&
        contact.lastActivity &&
        (!contact.lastSeenActivity || contact.lastActivity !== contact.lastSeenActivity)
      ) {
        unread.add(contact.phoneNumber)
      }
    })
    return unread
  }, [contactsData])
  
  // Fetch contacts function using XMLHttpRequest (works around fetch stalling issue)
  const fetchContacts = React.useCallback(async (cellId?: string, isPolling: boolean = false) => {
    const url = cellId 
      ? `/api/contacts?cellId=${encodeURIComponent(cellId)}`
      : '/api/contacts'
    
    // Only show loading state if this is initial load (not polling)
    if (!isPolling) {
      setIsLoadingContacts(true)
    }
    setContactsError(null)
    
    try {
      // Use XMLHttpRequest as a workaround for fetch stalling in Next.js dev server
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, true)
      xhr.timeout = 10000 // 10 second timeout
      xhr.setRequestHeader('Cache-Control', 'no-cache')
      
      const result = await new Promise<Contact[]>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve(data)
            } catch (e) {
              reject(new Error('Failed to parse JSON response'))
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`))
          }
        }
        
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.ontimeout = () => reject(new Error('Request timeout after 10 seconds'))
        
        xhr.send()
      })
      
      // Update contacts data (seen state is now in DB, computed via useMemo)
      setContactsData(result)
      
      setIsLoadingContacts(false)
      setContactsError(null)
      setHasInitialData(true)
    } catch (err: any) {
      setContactsError(err)
      setIsLoadingContacts(false)
      // Don't clear data on error, keep previous data visible
    }
  }, [])
  
  // Fetch contacts when cell changes (initial load)
  React.useEffect(() => {
    if (!selectedCell) {
      setContactsData([])
      setHasInitialData(false)
      setIsLoadingContacts(false)
      return
    }
    
    // Reset state for new cell
    setHasInitialData(false)
    fetchContacts(selectedCell.id, false)
  }, [selectedCell?.id, fetchContacts])
  
  // Poll for updates every 10 seconds (silent background updates)
  React.useEffect(() => {
    if (!selectedCell || !hasInitialData) return
    
    const intervalId = setInterval(() => {
      fetchContacts(selectedCell.id, true) // Pass isPolling=true to prevent loading state
    }, 10000)
    
    return () => clearInterval(intervalId)
  }, [selectedCell?.id, fetchContacts, hasInitialData])

  // Load column colors from database
  React.useEffect(() => {
    const loadColumnColors = async () => {
      try {
        const cellId = selectedCell?.id
        const url = cellId 
          ? `/api/column-colors?cellId=${encodeURIComponent(cellId)}`
          : '/api/column-colors'
        
        const response = await fetch(url)
        if (response.ok) {
          const colors = await response.json()
          console.log('Loaded column colors:', colors)
          setColumnColors(colors)
        } else {
          console.error('Failed to load column colors:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error loading column colors:', error)
      }
    }
    
    if (selectedCell) {
      loadColumnColors()
    } else {
      // Load global colors when no cell is selected
      loadColumnColors()
    }
  }, [selectedCell?.id])
  
  // Use the state data
  const data = contactsData
  const isLoading = isLoadingContacts
  const error = contactsError

  // Use fetched data or fallback to initial data
  const tableData = (data || initialData || []) as TData[]
  
  // AI column definitions: map of columnKey -> { name, prompt }
  const [aiColumns, setAiColumns] = React.useState<Map<string, { name: string; prompt: string }>>(new Map())
  
  // Analysis results: map of columnKey -> map of phoneNumber -> result
  const [analysisResults, setAnalysisResults] = React.useState<Map<string, Map<string, string | null>>>(new Map())
  
  // Loading state for analysis: map of columnKey -> boolean
  const [analysisLoading, setAnalysisLoading] = React.useState<Map<string, boolean>>(new Map())
  
  // Store order of initial columns for reordering (AI columns always at end)
  const [initialColumnOrder, setInitialColumnOrder] = React.useState<ColumnDef<TData, TValue>[]>(initialColumns)
  
  // Alert state (needed before columns useMemo)
  const [alerts, setAlerts] = React.useState<Array<{
    id: string
    name: string
    type: 'ai' | 'keyword'
    condition: string
    enabled: boolean
  }>>([])
  const [alertTriggers, setAlertTriggers] = React.useState<Map<string, Array<{
    id: string
    alertId: string
    alertName: string
    triggeredAt: string
  }>>>(new Map())

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "lastActivity", desc: true }
  ])
  const [sorts, setSorts] = React.useState<Array<{ column: string; direction: "asc" | "desc" }>>([
    { column: "lastActivity", direction: "desc" }
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [columnColors, setColumnColors] = React.useState<Record<string, string>>({})
  
  // Helper function to get contrasting text color (black or white) based on background
  const getContrastColor = (backgroundColor: string): string => {
    if (!backgroundColor) return ""
    // Remove # if present
    const hex = backgroundColor.replace("#", "")
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? "#000000" : "#ffffff"
  }

  // Helper function to convert hex color to rgba with reduced opacity
  const getColorWithOpacity = (hexColor: string, opacity: number = 0.1): string => {
    if (!hexColor) return ""
    // Remove # if present
    const hex = hexColor.replace("#", "")
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    // Return rgba string
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  // Available colors for column headers
  const availableColors = [
    { name: "Default", value: "" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Yellow", value: "#eab308" },
    { name: "Lime", value: "#84cc16" },
    { name: "Green", value: "#22c55e" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Sky", value: "#0ea5e9" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Purple", value: "#a855f7" },
    { name: "Fuchsia", value: "#d946ef" },
    { name: "Pink", value: "#ec4899" },
    { name: "Rose", value: "#f43f5e" },
  ]

  // Column Header Menu Component
  const ColumnHeaderMenu = React.useCallback(({
    children,
    columnId,
    columnName,
    columnType = 'regular',
    columnKey,
    onRename,
    onEdit,
    onDelete,
    onHide,
    onSortAsc,
    onSortDesc,
    onFilter,
  }: {
    children: React.ReactNode
    columnId: string
    columnName: string
    columnType?: 'regular' | 'ai' | 'alert'
    columnKey?: string
    onRename?: () => void
    onEdit?: () => void
    onDelete?: () => void
    onHide?: () => void
    onSortAsc?: () => void
    onSortDesc?: () => void
    onFilter?: () => void
  }) => {
    const isHidden = columnVisibility[columnId] === false
    const isPhoneNumber = columnId === 'phoneNumber'
    const currentColor = columnColors[columnId] || ""
    
    const handleColorChange = async (color: string) => {
      console.log('Changing color for columnId:', columnId, 'to:', color)
      // Update local state immediately for responsive UI
      setColumnColors((prev) => ({
        ...prev,
        [columnId]: color,
      }))
      
      // Save to database
      try {
        const cellId = selectedCell?.id
        console.log('Saving column color:', { columnId, color, cellId })
        const response = await fetch('/api/column-colors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            columnId,
            color,
            cellId,
          }),
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to save column color:', response.status, errorData)
          // Revert on error
          setColumnColors((prev) => {
            const updated = { ...prev }
            if (color === '') {
              delete updated[columnId]
            } else {
              updated[columnId] = color
            }
            return updated
          })
        } else {
          console.log('Successfully saved column color')
        }
      } catch (error) {
        console.error('Error saving column color:', error)
        // Revert on error
        setColumnColors((prev) => {
          const updated = { ...prev }
          if (color === '') {
            delete updated[columnId]
          } else {
            updated[columnId] = color
          }
          return updated
        })
      }
    }
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer rounded px-1 -mx-1 w-full">
            {children}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{columnName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {onRename && (
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename column
            </DropdownMenuItem>
          )}
          
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Settings className="h-4 w-4 mr-2" />
              Edit column
            </DropdownMenuItem>
          )}
          
         
          
          {columnType === 'ai' && (
            <DropdownMenuItem onClick={onEdit}>
              <Info className="h-4 w-4 mr-2" />
              Edit description
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette className="h-4 w-4 mr-2" />
              Change color
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <div className="grid grid-cols-6 gap-2 p-2">
                {availableColors.map((color) => (
                  <button
                    key={color.value || "default"}
                    onClick={() => handleColorChange(color.value)}
                    className={cn(
                      "h-8 w-8 rounded-md border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
                      color.value === "" 
                        ? "bg-background border-foreground/20 hover:border-foreground/40"
                        : "border-transparent hover:border-foreground/40",
                      currentColor === color.value && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={color.value ? { backgroundColor: color.value } : {}}
                    title={color.name}
                    aria-label={color.name}
                  />
                ))}
              </div>
              {currentColor && (
                <div className="px-2 pb-2">
                  <DropdownMenuItem
                    onClick={() => handleColorChange("")}
                  >
                    Reset to default
                  </DropdownMenuItem>
                </div>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          
          <DropdownMenuSeparator />
          
          {onSortAsc && (
            <DropdownMenuItem onClick={onSortAsc}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Sort A → Z
            </DropdownMenuItem>
          )}
          
          {onSortDesc && (
            <DropdownMenuItem onClick={onSortDesc}>
              <ArrowDown className="h-4 w-4 mr-2" />
              Sort Z → A
            </DropdownMenuItem>
          )}
          
          {onFilter && (
            <DropdownMenuItem onClick={onFilter}>
              <Funnel className="h-4 w-4 mr-2" />
              Filter on this column
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem disabled>
            <Pin className="h-4 w-4 mr-2" />
            Pin
          </DropdownMenuItem>
          
          {onHide && (
            <DropdownMenuItem onClick={onHide}>
              {isHidden ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Show column
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Hide column
                </>
              )}
            </DropdownMenuItem>
          )}
          
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }, [columnVisibility, columnColors, selectedCell?.id])

  // Create columns with AI columns and Alert columns dynamically
  const columns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    const aiColumnDefs: ColumnDef<TData, TValue>[] = Array.from(aiColumns.entries()).map(([columnKey, columnDef]) => ({
      accessorKey: columnKey,
      header: ({ column }) => (
        <ColumnHeaderMenu
          columnId={column.id}
          columnName={columnDef.name}
          columnType="ai"
          columnKey={columnKey}
          onRename={() => {
            setEditingColumnKey(columnKey)
            setEditColumnName(columnDef.name)
            setEditAiDescription(columnDef.prompt)
            setIsEditColumnDialogOpen(true)
          }}
          onEdit={() => {
            setEditingColumnKey(columnKey)
            setEditColumnName(columnDef.name)
            setEditAiDescription(columnDef.prompt)
            setIsEditColumnDialogOpen(true)
          }}
          onDelete={() => handleDeleteColumn(columnKey)}
          onHide={() => {
            setColumnVisibility((prev) => ({
              ...prev,
              [column.id]: !prev[column.id],
            }))
          }}
          onSortAsc={() => {
            column.toggleSorting(false)
          }}
          onSortDesc={() => {
            column.toggleSorting(true)
          }}
          onFilter={() => {
            const newFilterId = Date.now().toString()
            setFilters((prev) => [...prev, {
              id: newFilterId,
              column: columnKey,
              condition: "contains",
              value: "",
            }])
          }}
        >
          <div className="flex items-center gap-2">
            <WandSparkles className="h-3 w-3" />
            <span>{columnDef.name}</span>
          </div>
        </ColumnHeaderMenu>
      ),
      cell: ({ row }) => {
        const contact = row.original as Contact
        const result = analysisResults.get(columnKey)?.get(contact.phoneNumber)
        const isLoading = analysisLoading.get(columnKey) || false
        
        if (isLoading) {
          return <span className="text-muted-foreground">Analyzing...</span>
        }
        
        if (result === undefined) {
          return <span className="text-muted-foreground"></span>
        }
        
        if (result === null) {
          return <span className="text-destructive">Error</span>
        }
        
        return <span className="text-sm">{result}</span>
      },
    }))
    
    // Create alert columns
    const alertColumnDefs: ColumnDef<TData, TValue>[] = alerts.map((alert) => {
      const alertId = alert.id
      return {
        accessorKey: `alert_${alertId}`,
        header: ({ column }) => (
          <ColumnHeaderMenu
            columnId={column.id}
            columnName={alert.name}
            columnType="alert"
            columnKey={`alert_${alertId}`}
            onRename={() => {
              setEditingAlertId(alert.id)
              setEditAlertName(alert.name)
              setEditAlertType(alert.type)
              setEditAlertCondition(alert.condition)
              setEditAlertEnabled(alert.enabled)
              setIsEditAlertDialogOpen(true)
            }}
            onEdit={() => {
              setEditingAlertId(alert.id)
              setEditAlertName(alert.name)
              setEditAlertType(alert.type)
              setEditAlertCondition(alert.condition)
              setEditAlertEnabled(alert.enabled)
              setIsEditAlertDialogOpen(true)
            }}
            onDelete={() => handleDeleteAlert(alert.id)}
            onHide={() => {
              setColumnVisibility((prev) => ({
                ...prev,
                [column.id]: !prev[column.id],
              }))
            }}
            onFilter={() => {
              const newFilterId = Date.now().toString()
              setFilters((prev) => [...prev, {
                id: newFilterId,
                column: `alert_${alertId}`,
                condition: "contains",
                value: "",
              }])
            }}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-3 w-3" />
              <span>{alert.name}</span>
            </div>
          </ColumnHeaderMenu>
        ),
        cell: ({ row }) => {
          const contact = row.original as Contact
          const contactTriggers = alertTriggers.get(contact.phoneNumber) || []
          const alertTrigger = contactTriggers.find(t => t.alertId === alertId)
          
          if (alertTrigger) {
            return (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Triggered
              </Badge>
            )
          }
          
          return <span className="text-muted-foreground text-sm">-</span>
        },
      }
    })
    
    // Transform regular columns to add menu to headers (except phoneNumber which has special handling)
    const transformedRegularColumns = initialColumnOrder.map((col) => {
      const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
      const columnId = col.id || String(accessorKey || "")
      const isPhoneNumber = accessorKey === "phoneNumber"
      
      // Don't wrap phoneNumber or select column - they have special logic
      if (isPhoneNumber || columnId === "select") {
        return col
      }
      
      // Get the original header
      const originalHeader = col.header
      const columnName = typeof originalHeader === 'string' 
        ? originalHeader 
        : String(accessorKey || columnId).replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase())
      
      return {
        ...col,
        id: columnId,
        header: (context: any) => {
          const { column, table, header } = context
          // If original header is a function, render it first to get the content
          const headerContent = typeof originalHeader === 'function' 
            ? originalHeader(context)
            : originalHeader || columnName
          
          return (
            <ColumnHeaderMenu
              columnId={column.id}
              columnName={columnName}
              columnType="regular"
              columnKey={String(accessorKey || "")}
              onHide={() => {
                setColumnVisibility((prev) => ({
                  ...prev,
                  [column.id]: !prev[column.id],
                }))
              }}
              onSortAsc={() => {
                column.toggleSorting(false)
              }}
              onSortDesc={() => {
                column.toggleSorting(true)
              }}
              onFilter={() => {
                const newFilterId = Date.now().toString()
                setFilters((prev) => [...prev, {
                  id: newFilterId,
                  column: String(accessorKey || ""),
                  condition: "contains",
                  value: "",
                }])
              }}
            >
              {headerContent}
            </ColumnHeaderMenu>
          )
        },
      }
    })
    
    return [...transformedRegularColumns, ...aiColumnDefs, ...alertColumnDefs]
  }, [initialColumnOrder, aiColumns, analysisResults, analysisLoading, alerts, alertTriggers, ColumnHeaderMenu, setColumnVisibility])
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = React.useState(false)
  const [newColumnName, setNewColumnName] = React.useState("")
  const [aiDescription, setAiDescription] = React.useState("")
  
  // Edit column dialog state
  const [isEditColumnDialogOpen, setIsEditColumnDialogOpen] = React.useState(false)
  const [editingColumnKey, setEditingColumnKey] = React.useState<string>("")
  const [editColumnName, setEditColumnName] = React.useState("")
  const [editAiDescription, setEditAiDescription] = React.useState("")
  
  // Broadcast dialog state
  const [isBroadcastDialogOpen, setIsBroadcastDialogOpen] = React.useState(false)
  const [broadcastMessage, setBroadcastMessage] = React.useState("")

  // Start conversation dialog state
  const [isStartConversationDialogOpen, setIsStartConversationDialogOpen] = React.useState(false)
  const [conversationPhoneNumber, setConversationPhoneNumber] = React.useState("")
  const [conversationMessage, setConversationMessage] = React.useState("Hello! I'd like to start a conversation with you.")

  // Message sheet state (for message icon click)
  const [isMessageSheetOpen, setIsMessageSheetOpen] = React.useState(false)
  const [sheetPhoneNumber, setSheetPhoneNumber] = React.useState("")
  const [sheetMessage, setSheetMessage] = React.useState("")
  
  // Mock conversation messages - in a real app, this would come from an API
  const [conversationMessages, setConversationMessages] = React.useState<Array<{
    id: string
    text: string
    timestamp: string
    isInbound: boolean
  }>>([])
  
  // Phone number search state
  const [phoneSearch, setPhoneSearch] = React.useState("")
  
  // Popover state
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false)
  const [sortPopoverOpen, setSortPopoverOpen] = React.useState(false)
  
  // Alert management dialog state
  const [isAddAlertDialogOpen, setIsAddAlertDialogOpen] = React.useState(false)
  const [newAlertName, setNewAlertName] = React.useState("")
  const [newAlertType, setNewAlertType] = React.useState<'ai' | 'keyword'>('keyword')
  const [newAlertCondition, setNewAlertCondition] = React.useState("")
  const [newAlertCellId, setNewAlertCellId] = React.useState<string | null>(null)
  
  // Fetch all cells for alert dialog
  const { data: cells = [] } = useQuery({
    queryKey: ['cells'],
    queryFn: async () => {
      const response = await fetch('/api/cells')
      if (!response.ok) throw new Error('Failed to fetch cells')
      return response.json()
    },
  })
  
  // Edit alert dialog state
  const [isEditAlertDialogOpen, setIsEditAlertDialogOpen] = React.useState(false)
  const [editingAlertId, setEditingAlertId] = React.useState<string>("")
  const [editAlertName, setEditAlertName] = React.useState("")
  const [editAlertType, setEditAlertType] = React.useState<'ai' | 'keyword'>('keyword')
  const [editAlertCondition, setEditAlertCondition] = React.useState("")
  const [editAlertEnabled, setEditAlertEnabled] = React.useState(true)
  
  // Filter state - array of filters
  type Filter = {
    id: string
    column: string
    condition: string
    value: string
  }
  const [filters, setFilters] = React.useState<Filter[]>([])

  // Track horizontal scroll state for shadow effect
  const [isScrolled, setIsScrolled] = React.useState(false)
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  
  // Ref for message area to scroll to bottom
  const messageAreaRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const container = tableContainerRef.current
    if (!container) return

    const handleScroll = () => {
      setIsScrolled(container.scrollLeft > 0)
    }

    container.addEventListener("scroll", handleScroll)
    // Check initial state
    handleScroll()

    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Fetch conversations when sheet opens with a phone number
  React.useEffect(() => {
    if (isMessageSheetOpen && sheetPhoneNumber && selectedCell) {
      const url = selectedCell.id
        ? `/api/conversations?phoneNumber=${encodeURIComponent(sheetPhoneNumber)}&cellId=${encodeURIComponent(selectedCell.id)}`
        : `/api/conversations?phoneNumber=${encodeURIComponent(sheetPhoneNumber)}`
      fetch(url)
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch conversations')
          }
          return res.json()
        })
        .then((messages: ConversationMessage[]) => {
          setConversationMessages(messages)
        })
        .catch((error) => {
          console.error('Error fetching conversations:', error)
          setConversationMessages([])
        })
    } else if (!isMessageSheetOpen) {
      // Clear messages when sheet closes
      setConversationMessages([])
    }
  }, [isMessageSheetOpen, sheetPhoneNumber, selectedCell])

  // Scroll to bottom when sheet opens or messages change
  React.useEffect(() => {
    if (isMessageSheetOpen && messageAreaRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (messageAreaRef.current) {
          messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight
        }
      }, 100)
    }
  }, [isMessageSheetOpen, conversationMessages])

  // Load AI columns and results on mount
  React.useEffect(() => {
    const loadAiColumns = async () => {
      try {
        const response = await fetch('/api/ai-columns')
        if (!response.ok) throw new Error('Failed to fetch AI columns')
        const columns = await response.json()
        
        // Convert to Map
        const columnsMap = new Map<string, { name: string; prompt: string }>()
        const resultsMap = new Map<string, Map<string, string | null>>()
        
        for (const column of columns) {
          columnsMap.set(column.columnKey, {
            name: column.name,
            prompt: column.prompt,
          })
          
          // Load results for this column
          try {
            const resultsResponse = await fetch(`/api/ai-results?columnKey=${encodeURIComponent(column.columnKey)}`)
            if (resultsResponse.ok) {
              const results = await resultsResponse.json()
              const columnResults = new Map<string, string | null>()
              Object.entries(results).forEach(([phoneNumber, result]) => {
                columnResults.set(phoneNumber, result as string | null)
              })
              resultsMap.set(column.columnKey, columnResults)
            }
          } catch (error) {
            console.error(`Error loading results for column ${column.columnKey}:`, error)
          }
        }
        
        setAiColumns(columnsMap)
        setAnalysisResults(resultsMap)
      } catch (error) {
        console.error('Error loading AI columns:', error)
      }
    }
    
    loadAiColumns()
  }, [])
  
  // Load alerts on mount and when cell changes
  React.useEffect(() => {
    const loadAlerts = async () => {
      if (!selectedCell) {
        setAlerts([])
        setAlertTriggers(new Map())
        return
      }
      
      try {
        const response = await fetch(`/api/alerts?cellId=${encodeURIComponent(selectedCell.id)}`)
        if (!response.ok) throw new Error('Failed to fetch alerts')
        const alertsData = await response.json()
        setAlerts(alertsData)
        
        // Load alert triggers for all contacts
        const triggersResponse = await fetch(`/api/alerts/triggers?cellId=${encodeURIComponent(selectedCell.id)}&dismissed=false`)
        if (triggersResponse.ok) {
          const triggersData = await triggersResponse.json()
          const triggersMap = new Map<string, Array<any>>()
          
          triggersData.forEach((trigger: any) => {
            if (!triggersMap.has(trigger.phoneNumber)) {
              triggersMap.set(trigger.phoneNumber, [])
            }
            triggersMap.get(trigger.phoneNumber)!.push({
              id: trigger.id,
              alertId: trigger.alertId,
              alertName: trigger.alert?.name || 'Unknown Alert',
              triggeredAt: trigger.triggeredAt,
            })
          })
          
          setAlertTriggers(triggersMap)
        }
      } catch (error) {
        console.error('Error loading alerts:', error)
      }
    }
    
    loadAlerts()
  }, [selectedCell?.id])
  
  // Check for new alert triggers during polling
  const previousTriggerIdsRef = React.useRef<Set<string>>(new Set())
  
  React.useEffect(() => {
    if (!selectedCell || !hasInitialData) return
    
    const checkNewTriggers = async () => {
      try {
        const triggersResponse = await fetch(`/api/alerts/triggers?cellId=${encodeURIComponent(selectedCell.id)}&dismissed=false`)
        if (triggersResponse.ok) {
          const triggersData = await triggersResponse.json()
          const triggersMap = new Map<string, Array<any>>()
          
          triggersData.forEach((trigger: any) => {
            if (!triggersMap.has(trigger.phoneNumber)) {
              triggersMap.set(trigger.phoneNumber, [])
            }
            triggersMap.get(trigger.phoneNumber)!.push({
              id: trigger.id,
              alertId: trigger.alertId,
              alertName: trigger.alert?.name || 'Unknown Alert',
              triggeredAt: trigger.triggeredAt,
            })
            
            // Check if this is a new trigger (not seen before)
            const isNew = !previousTriggerIdsRef.current.has(trigger.id)
            
            if (isNew) {
              // Show toast notification
              toast.warning(`Alert: ${trigger.alert?.name || 'Unknown'}`, {
                description: `Triggered for ${trigger.phoneNumber}`,
                duration: 5000,
              })
              previousTriggerIdsRef.current.add(trigger.id)
            }
          })
          
          setAlertTriggers(triggersMap)
        }
      } catch (error) {
        console.error('Error checking alert triggers:', error)
      }
    }
    
    // Check every 10 seconds (same as polling interval)
    const intervalId = setInterval(checkNewTriggers, 10000)
    return () => clearInterval(intervalId)
  }, [selectedCell?.id, hasInitialData])
  
  // Reset trigger IDs when cell changes
  React.useEffect(() => {
    previousTriggerIdsRef.current.clear()
  }, [selectedCell?.id])

  // Sync sorting state with sorts array
  React.useEffect(() => {
    setSorting(sorts.map(s => ({ id: s.column, desc: s.direction === "desc" })))
  }, [sorts])

  const addSort = () => {
    const newSort = {
      id: Date.now().toString(),
      column: "phoneNumber", // Default to Phone Number
      direction: "asc" as const,
    }
    setSorts([...sorts, newSort])
  }

  const removeSort = (column: string) => {
    setSorts(sorts.filter((sort) => sort.column !== column))
  }

  const updateSort = (id: string, field: "column" | "direction", value: string) => {
    setSorts(
      sorts.map((sort) =>
        sort.column === id ? { ...sort, [field]: value } : sort
      )
    )
  }

  // Custom filter function
  const applyFilter = React.useCallback(
    (contact: Contact, columnId: string, filterValue: string, condition: string): boolean => {
      let cellValue = ""

      switch (columnId) {
        case "phoneNumber":
          cellValue = contact.phoneNumber
          break
        case "userId":
          cellValue = contact.userId
          break
        case "lastMessage":
          cellValue = contact.lastMessage || ""
          break
        case "status":
          cellValue = contact.status || ""
          break
        case "numberOfMessages":
          cellValue = String(contact.numberOfMessages)
          break
        case "started":
          cellValue = contact.started || ""
          break
        case "lastActivity":
          cellValue = contact.lastActivity || ""
          break
        default:
          cellValue = String((contact as any)[columnId] || "")
      }

      const normalizedCellValue = cellValue.toLowerCase()
      const normalizedFilterValue = filterValue.toLowerCase()

      switch (condition) {
        case "contains":
          return normalizedCellValue.includes(normalizedFilterValue)
        case "does not contain":
          return !normalizedCellValue.includes(normalizedFilterValue)
        case "starts with":
          return normalizedCellValue.startsWith(normalizedFilterValue)
        case "ends with":
          return normalizedCellValue.endsWith(normalizedFilterValue)
        case "equals":
          return normalizedCellValue === normalizedFilterValue
        case "not equals":
          return normalizedCellValue !== normalizedFilterValue
        case "is empty":
          return cellValue === "" || cellValue === null || cellValue === undefined
        case "is not empty":
          return cellValue !== "" && cellValue !== null && cellValue !== undefined
        default:
          return true
      }
    },
    []
  )

  // Filter data manually - apply all filters with AND logic
  const filteredData = React.useMemo(() => {
    const activeFilters = filters.filter(
      (filter) =>
        filter.value.trim() ||
        filter.condition === "is empty" ||
        filter.condition === "is not empty"
    )

    let result = tableData

    // Apply phone search filter first
    if (phoneSearch.trim()) {
      const searchLower = phoneSearch.toLowerCase().trim()
      result = result.filter((row) => {
        const contact = row as Contact
        return contact.phoneNumber.toLowerCase().includes(searchLower)
      })
    }

    // Then apply additional filters
    if (activeFilters.length === 0) {
      return result
    }

    return result.filter((row) => {
      return activeFilters.every((filter) => {
        return applyFilter(row as Contact, filter.column, filter.value, filter.condition)
      })
    })
  }, [tableData, filters, phoneSearch, applyFilter])

  const addFilter = () => {
    const newFilter: Filter = {
      id: Date.now().toString(),
      column: "phoneNumber",
      condition: "contains",
      value: "",
    }
    setFilters([...filters, newFilter])
  }

  const removeFilter = (id: string) => {
    setFilters(filters.filter((filter) => filter.id !== id))
  }

  const updateFilter = (id: string, field: keyof Filter, value: string) => {
    setFilters(
      filters.map((filter) =>
        filter.id === id ? { ...filter, [field]: value } : filter
      )
    )
  }

  // Column reordering
      const sensors = useSensors(
        useSensor(PointerSensor, {
          activationConstraint: {
            distance: 5, // Require 5px of movement before dragging starts - allows clicks to work
          },
        }),
        useSensor(KeyboardSensor, {
          coordinateGetter: sortableKeyboardCoordinates,
        })
      )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    // Find column indices in initial columns only (AI columns can't be reordered)
    const getColumnId = (col: ColumnDef<TData, TValue>) => {
      const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
      return col.id || String(accessorKey || "")
    }

    const oldIndex = initialColumnOrder.findIndex((col) => getColumnId(col) === active.id)
    const newIndex = initialColumnOrder.findIndex((col) => getColumnId(col) === over.id)

    // If not found in initial columns, it's an AI column - don't allow reordering
    if (oldIndex === -1 || newIndex === -1) return

    // Find Phone Number column index
    const phoneNumberIndex = initialColumnOrder.findIndex(
      (col) => {
        const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
        return accessorKey === "phoneNumber"
      }
    )

    // Prevent moving Phone Number column
    if (oldIndex === phoneNumberIndex) {
      return
    }

    // Prevent moving anything to Phone Number's position (it should stay first)
    if (newIndex === phoneNumberIndex) {
      return
    }

    // Reorder initial columns
    const reorderedInitialColumns = arrayMove(initialColumnOrder, oldIndex, newIndex)
    
    // Ensure Phone Number stays in correct position (first, before other columns)
    const phoneNumberCol = reorderedInitialColumns.find((col) => {
      const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
      return accessorKey === "phoneNumber"
    })
    const otherColumns = reorderedInitialColumns.filter(
      (col) => {
        const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
        return accessorKey !== "phoneNumber"
      }
    )

    // Reconstruct: phoneNumber, ...others
    const finalOrder: ColumnDef<TData, TValue>[] = []
    if (phoneNumberCol) finalOrder.push(phoneNumberCol)
    finalOrder.push(...otherColumns)

    setInitialColumnOrder(finalOrder)
  }

  const handleStartConversation = (phoneNumber?: string) => {
    if (phoneNumber) {
      setConversationPhoneNumber(phoneNumber)
    }
    setIsStartConversationDialogOpen(true)
  }

  const handleOpenMessageSheet = async (phoneNumber: string) => {
    setSheetPhoneNumber(phoneNumber)
    setIsMessageSheetOpen(true)
    
    // Mark this contact as seen in the database
    const contact = contactsData.find((c) => c.phoneNumber === phoneNumber)
    if (contact?.lastActivity && selectedCell) {
      try {
        await fetch('/api/contacts/mark-seen', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber,
            lastSeenActivity: contact.lastActivity,
            cellId: selectedCell.id,
          }),
        })
        
        // Update local state immediately for better UX
        setContactsData((prev) =>
          prev.map((c) =>
            c.phoneNumber === phoneNumber
              ? { ...c, lastSeenActivity: contact.lastActivity }
              : c
          )
        )
      } catch (error) {
        console.error('Error marking contact as seen:', error)
        // Don't block UI if API call fails
      }
    }
    
    // Conversations will be fetched by useEffect when sheet opens
  }

  const handleSendSheetMessage = () => {
    // TODO: Implement actual message sending functionality
    const phoneNumber = String(sheetPhoneNumber || "")
    const message = String(sheetMessage || "").trim()
    
    if (!message) return

    // Add message to conversation
    const newMessage = {
      id: Date.now().toString(),
      text: message,
      timestamp: new Date().toLocaleString(),
      isInbound: false, // Outbound (sent by agent)
    }
    
    setConversationMessages((prev) => [...prev, newMessage])
    setSheetMessage("")
    
    // Scroll to bottom after message is added
    setTimeout(() => {
      if (messageAreaRef.current) {
        messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight
      }
    }, 50)
    
    console.log("Sending message to:", phoneNumber)
    console.log("Message:", message)
  }

  const [isSendingConversation, setIsSendingConversation] = React.useState(false)

  const handleSendConversation = async () => {
    const phoneNumber = String(conversationPhoneNumber || "").trim()
    const message = String(conversationMessage || "").trim()
    
    if (!phoneNumber || !message) return

    setIsSendingConversation(true)
    
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, to: [phoneNumber], from_number: selectedCell?.phoneNumber }),
      })

      const data = await res.json()
      const ok = typeof data?.ok === "boolean" ? data.ok : res.ok
      
      if (!ok) {
        throw new Error(data?.error || "Failed to start conversation")
      }
      
      toast.success("Message sent", {
        description: `Conversation started with ${phoneNumber}`,
      })

      // Reset and close dialog
      setConversationPhoneNumber("")
      setConversationMessage("Hello! I'd like to start a conversation with you.")
      setIsStartConversationDialogOpen(false)
    } catch (err) {
      toast.error("Failed to start conversation", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setIsSendingConversation(false)
    }
  }
  
  const handleDismissAlerts = React.useCallback(async (phoneNumber: string) => {
    try {
      const response = await fetch('/api/alerts/triggers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dismissAll: true,
          phoneNumber,
          cellId: selectedCell?.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss alerts')
      }

      setAlertTriggers((prev) => {
        const updated = new Map(prev)
        updated.delete(phoneNumber)
        return updated
      })
    } catch (error) {
      console.error('Error dismissing alerts:', error)
    }
  }, [selectedCell?.id])

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 50,
      size: 150,
      maxSize: 1000,
    },
      meta: {
        onStartConversation: handleStartConversation,
        onOpenMessageSheet: handleOpenMessageSheet,
        unreadPhoneNumbers: unreadPhoneNumbers,
        alertTriggers: alertTriggers,
        onDismissAlerts: handleDismissAlerts,
      },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
  })

  // Get selected rows and determine broadcast button text
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const totalRows = table.getFilteredRowModel().rows.length
  const allSelected = selectedCount > 0 && selectedCount === totalRows

  const getBroadcastButtonText = () => {
    if (selectedCount === 0) {
      return ""
    } else if (allSelected) {
      return "Broadcast to all"
    } else if (selectedCount === 1) {
      const selectedContact = selectedRows[0].original as Contact
      return `Broadcast to ${selectedContact.phoneNumber}`
    } else {
      return "Broadcast to selected"
    }
  }

  const handleBroadcast = () => {
    setIsBroadcastDialogOpen(true)
  }

  const sendMutation = useMutation({
    mutationFn: async () => {
      const body = broadcastMessage.trim()
      if (!body) throw new Error("Message is empty")
      
      // Get selected phone numbers
      const selectedPhones = allSelected
        ? filteredData.map((contact) => (contact as Contact).phoneNumber)
        : selectedRows.map((row) => (row.original as Contact).phoneNumber)
      
      if (selectedPhones.length === 0) throw new Error("Select at least one recipient")

      // Call the broadcast API
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: body, to: selectedPhones, from_number: selectedCell?.phoneNumber }),
      })

      const data = await res.json()
      const ok = typeof data?.ok === "boolean" ? data.ok : res.ok
      
      if (!ok) {
        throw new Error(data?.error || "Broadcast failed")
      }
      
      return { okCount: selectedPhones.length }
    },
    onSuccess: ({ okCount }) => {
      toast.success("Broadcast sent", {
        description: `${okCount} queued.`,
      })
      setBroadcastMessage("")
      setIsBroadcastDialogOpen(false)
    },
    onError: (err) => {
      toast.error("Broadcast failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    },
  })

  const handleSendBroadcast = () => {
    sendMutation.mutate()
  }

  const handleDelete = () => {
    // TODO: Implement actual delete functionality
    const contactsToDelete = allSelected
      ? "all contacts"
      : selectedRows.map((row) => (row.original as Contact).phoneNumber).join(", ")
    
    console.log("Deleting contacts:", contactsToDelete)
    
    // Clear selection after deletion
    setRowSelection({})
  }

  // AI Analysis state
  const [isRunAnalysisDialogOpen, setIsRunAnalysisDialogOpen] = React.useState(false)
  const [selectedAnalysisColumn, setSelectedAnalysisColumn] = React.useState<string>("")
  const [isRunningAnalysis, setIsRunningAnalysis] = React.useState(false)

  const handleRunAnalysis = async () => {
    if (!selectedAnalysisColumn || !aiColumns.has(selectedAnalysisColumn)) {
      return
    }

    const aiColumn = aiColumns.get(selectedAnalysisColumn)
    if (!aiColumn) return

    // Get selected phone numbers
    const selectedPhones = allSelected
      ? filteredData.map((contact) => (contact as Contact).phoneNumber)
      : selectedRows.map((row) => (row.original as Contact).phoneNumber)

    if (selectedPhones.length === 0) return

    setIsRunningAnalysis(true)
    
    // Set loading state for this column
    setAnalysisLoading((prev) => {
      const newMap = new Map(prev)
      newMap.set(selectedAnalysisColumn, true)
      return newMap
    })

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumbers: selectedPhones,
          prompt: aiColumn.prompt,
          columnKey: selectedAnalysisColumn, // Pass columnKey to save results
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Analysis failed")
      }

      const data = await res.json()
      
      // Update results for this column (results are already saved by API)
      setAnalysisResults((prev) => {
        const newMap = new Map(prev)
        const columnResults = new Map(prev.get(selectedAnalysisColumn) || new Map())
        
        data.results.forEach((result: { phoneNumber: string; result: string | null; error: string | null }) => {
          if (result.error) {
            columnResults.set(result.phoneNumber, null)
          } else {
            columnResults.set(result.phoneNumber, result.result)
          }
        })
        
        newMap.set(selectedAnalysisColumn, columnResults)
        return newMap
      })

      toast.success("Analysis complete", {
        description: `Analyzed ${selectedPhones.length} contact(s)`,
      })

      setIsRunAnalysisDialogOpen(false)
      setSelectedAnalysisColumn("")
    } catch (error) {
      toast.error("Analysis failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsRunningAnalysis(false)
      setAnalysisLoading((prev) => {
        const newMap = new Map(prev)
        newMap.set(selectedAnalysisColumn, false)
        return newMap
      })
    }
  }

  const exportToCSV = () => {
    const headers = columns
      .filter((col) => col.id !== "select" && 'accessorKey' in col ? col.accessorKey : undefined)
      .map((col) => {
        if (typeof col.header === "function") {
          const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
          return accessorKey || col.id || ""
        }
        const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
        return String(col.header || accessorKey || col.id || "")
      })

    const rows = filteredData.map((row) => {
      return columns
        .filter((col) => col.id !== "select" && 'accessorKey' in col ? col.accessorKey : undefined)
        .map((col) => {
          const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
          const value = (row as any)[accessorKey as string]
          // Escape commas and quotes in CSV
          if (value === null || value === undefined) return ""
          const stringValue = String(value)
          if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        })
    })

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `contacts_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToExcel = () => {
    // For Excel export, we'll create a TSV (tab-separated) file which Excel can open
    const headers = columns
      .filter((col) => col.id !== "select" && 'accessorKey' in col ? col.accessorKey : undefined)
      .map((col) => {
        if (typeof col.header === "function") {
          const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
          return accessorKey || col.id || ""
        }
        const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
        return String(col.header || accessorKey || col.id || "")
      })

    const rows = filteredData.map((row) => {
      return columns
        .filter((col) => col.id !== "select" && 'accessorKey' in col ? col.accessorKey : undefined)
        .map((col) => {
          const accessorKey = 'accessorKey' in col ? col.accessorKey : undefined
          const value = (row as any)[accessorKey as string]
          if (value === null || value === undefined) return ""
          return String(value)
        })
    })

    // Create TSV (tab-separated) format which Excel can open
    const tsvContent = [
      headers.join("\t"),
      ...rows.map((row) => row.join("\t")),
    ].join("\n")

    const blob = new Blob([tsvContent], { type: "application/vnd.ms-excel" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `contacts_${new Date().toISOString().split("T")[0]}.xls`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleAddColumn = async () => {
    if (!newColumnName.trim() || !aiDescription.trim()) return

    // Generate a key from the column name (lowercase, replace spaces with underscores)
    const columnKey = newColumnName.toLowerCase().replace(/\s+/g, "_")

    try {
      // Save to database
      const response = await fetch('/api/ai-columns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          columnKey,
          name: newColumnName,
          prompt: aiDescription,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save column')
      }

      // Store AI column definition
      setAiColumns((prev) => {
        const newMap = new Map(prev)
        newMap.set(columnKey, { name: newColumnName, prompt: aiDescription })
        return newMap
      })

      // Initialize results map for this column
      setAnalysisResults((prev) => {
        const newMap = new Map(prev)
        newMap.set(columnKey, new Map())
        return newMap
      })

      setNewColumnName("")
      setAiDescription("")
      setIsAddColumnDialogOpen(false)
    } catch (error) {
      console.error('Error adding column:', error)
      toast.error('Failed to add column', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleEditColumn = async () => {
    if (!editingColumnKey || !editColumnName.trim() || !editAiDescription.trim()) return

    try {
      // Update in database
      const response = await fetch('/api/ai-columns', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          columnKey: editingColumnKey,
          name: editColumnName,
          prompt: editAiDescription,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update column')
      }

      // Update AI column definition
      setAiColumns((prev) => {
        const newMap = new Map(prev)
        if (newMap.has(editingColumnKey)) {
          newMap.set(editingColumnKey, { name: editColumnName, prompt: editAiDescription })
        }
        return newMap
      })

      // Clear edit state
      setEditingColumnKey("")
      setEditColumnName("")
      setEditAiDescription("")
      setIsEditColumnDialogOpen(false)
    } catch (error) {
      console.error('Error editing column:', error)
      toast.error('Failed to update column', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  
  const handleDeleteColumn = async (columnKey: string) => {
    const columnName = aiColumns.get(columnKey)?.name || columnKey
    if (!confirm(`Are you sure you want to delete the "${columnName}" column?`)) {
      return
    }

    try {
      const response = await fetch(`/api/ai-columns?columnKey=${encodeURIComponent(columnKey)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete column')
      }

      // Remove from state
      setAiColumns((prev) => {
        const newMap = new Map(prev)
        newMap.delete(columnKey)
        return newMap
      })
      
      // Remove results
      setAnalysisResults((prev) => {
        const newMap = new Map(prev)
        newMap.delete(columnKey)
        return newMap
      })
      
      toast.success('Column deleted', {
        description: `The "${columnName}" column has been deleted`,
      })
    } catch (error) {
      console.error('Error deleting column:', error)
      toast.error('Failed to delete column', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  
  // Alert management handlers
  const handleAddAlert = async () => {
    if (!newAlertName.trim() || !newAlertCondition.trim() || !newAlertCellId) return

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newAlertName,
          type: newAlertType,
          condition: newAlertCondition,
          cellId: newAlertCellId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create alert')
      }

      const alert = await response.json()
      setAlerts((prev) => [...prev, alert])
      
      setNewAlertName("")
      setNewAlertCondition("")
      setNewAlertType('keyword')
      setNewAlertCellId(null)
      setIsAddAlertDialogOpen(false)
      
      toast.success('Alert created', {
        description: `Alert "${alert.name}" has been created`,
      })
    } catch (error) {
      console.error('Error creating alert:', error)
      toast.error('Failed to create alert', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  
  const handleEditAlert = async () => {
    if (!editingAlertId || !editAlertName.trim() || !editAlertCondition.trim()) return

    try {
      const response = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingAlertId,
          name: editAlertName,
          type: editAlertType,
          condition: editAlertCondition,
          enabled: editAlertEnabled,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update alert')
      }

      const alert = await response.json()
      setAlerts((prev) => prev.map(a => a.id === editingAlertId ? alert : a))
      
      setEditingAlertId("")
      setEditAlertName("")
      setEditAlertCondition("")
      setEditAlertType('keyword')
      setEditAlertEnabled(true)
      setIsEditAlertDialogOpen(false)
      
      toast.success('Alert updated', {
        description: `Alert "${alert.name}" has been updated`,
      })
    } catch (error) {
      console.error('Error updating alert:', error)
      toast.error('Failed to update alert', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  
  const handleDeleteAlert = async (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId)
    const alertName = alert?.name || 'this alert'
    
    if (!confirm(`Are you sure you want to delete "${alertName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/alerts?id=${encodeURIComponent(alertId)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete alert')
      }

      setAlerts((prev) => prev.filter(a => a.id !== alertId))
      toast.success('Alert deleted', {
        description: `"${alertName}" has been deleted`,
      })
    } catch (error) {
      console.error('Error deleting alert:', error)
      toast.error('Failed to delete alert', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Show message if no cell is selected
  if (!selectedCell) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Please select a cell from the dropdown above</div>
      </div>
    )
  }

  // Show loading state on initial load
  if (isLoading && !initialData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading contacts...</div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">
          Error loading contacts: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Phone Number Search Bar and Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search phone number..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            className="pl-9"
          />
          {phoneSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setPhoneSearch("")}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>
                Export to Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => handleStartConversation()}>
            <Plus className="h-4 w-4" />
            Start conversation
          </Button>
          <Dialog open={isAddColumnDialogOpen} onOpenChange={setIsAddColumnDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <WandSparkles className="h-4 w-4" />
                Add analysis
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Analysis</DialogTitle>
                <DialogDescription>
                  Add a new AI analysis column to the table. Describe what the AI should check or analyze.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="column-name">Column Name</Label>
                  <Input
                    id="column-name"
                    placeholder="e.g., Sentiment Analysis"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-description">What should the AI check?</Label>
                  <Textarea
                    id="ai-description"
                    placeholder="e.g., Analyze the sentiment of the last message and determine if it's positive, negative, or neutral"
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleAddColumn}
                  disabled={!newColumnName.trim() || !aiDescription.trim()}
                >
                  Add AI Analysis
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddAlertDialogOpen} onOpenChange={setIsAddAlertDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4" />
                Add Alert
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Alert</DialogTitle>
                <DialogDescription>
                  Create a new alert that will notify you when specific conditions are met in incoming messages.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="alert-name">Alert Name</Label>
                  <Input
                    id="alert-name"
                    placeholder="e.g., Urgent Request"
                    value={newAlertName}
                    onChange={(e) => setNewAlertName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alert-type">Alert Type</Label>
                  <Select value={newAlertType} onValueChange={(value: 'ai' | 'keyword') => setNewAlertType(value)}>
                    <SelectTrigger id="alert-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Keyword Match</SelectItem>
                      <SelectItem value="ai">AI Evaluation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alert-condition">
                    {newAlertType === 'keyword' ? 'Keywords (comma-separated)' : 'AI Condition'}
                  </Label>
                  <Textarea
                    id="alert-condition"
                    placeholder={
                      newAlertType === 'keyword'
                        ? 'e.g., urgent, emergency, help'
                        : 'e.g., Check if the message indicates an urgent request or emergency situation'
                    }
                    value={newAlertCondition}
                    onChange={(e) => setNewAlertCondition(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alert-cell">Cell</Label>
                  <Select value={newAlertCellId || ""} onValueChange={setNewAlertCellId}>
                    <SelectTrigger id="alert-cell">
                      <SelectValue placeholder="Select a cell" />
                    </SelectTrigger>
                    <SelectContent>
                      {cells.map((cell: { id: string; name: string }) => (
                        <SelectItem key={cell.id} value={cell.id}>
                          {cell.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddAlertDialogOpen(false)
                    setNewAlertName("")
                    setNewAlertCondition("")
                    setNewAlertType("keyword")
                    setNewAlertCellId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddAlert}
                  disabled={!newAlertName.trim() || !newAlertCondition.trim() || !newAlertCellId}
                >
                  Add Alert
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant={filters.length > 0 ? "default" : "outline"} 
                    size="sm"
                    className={filters.length === 0 ? "border-dashed" : ""}
                  >
                    <Funnel className="h-4 w-4" />
                    {filters.length > 0 ? `Filtered by ${filters.length} ${filters.length === 1 ? 'field' : 'fields'}` : 'Filter'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full" align="start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Filters</h4>
                      {filters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No filters applied</p>
                      ) : (
                        <div className="space-y-2">
                          {filters.map((filter) => (
                            <div key={filter.id} className="flex items-center gap-2 p-2 rounded-md">
                              <Select
                                value={filter.column}
                                onValueChange={(value) => updateFilter(filter.id, "column", value)}
                              >
                                <SelectTrigger className="w-[140px] h-8">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="phoneNumber">Phone Number</SelectItem>
                                  <SelectItem value="userId">User ID</SelectItem>
                                  <SelectItem value="lastMessage">Last Message</SelectItem>
                                  <SelectItem value="status">Status</SelectItem>
                                  <SelectItem value="numberOfMessages"># of Messages</SelectItem>
                                  <SelectItem value="started">Started</SelectItem>
                                  <SelectItem value="lastActivity">Last Activity</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={filter.condition}
                                onValueChange={(value) => updateFilter(filter.id, "condition", value)}
                              >
                                <SelectTrigger className="w-[140px] h-8">
                                  <SelectValue placeholder="Condition" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="contains">Contains</SelectItem>
                                  <SelectItem value="does not contain">Does not contain</SelectItem>
                                  <SelectItem value="starts with">Starts with</SelectItem>
                                  <SelectItem value="ends with">Ends with</SelectItem>
                                  <SelectItem value="equals">Equals</SelectItem>
                                  <SelectItem value="not equals">Not equals</SelectItem>
                                  <SelectItem value="is empty">Is empty</SelectItem>
                                  <SelectItem value="is not empty">Is not empty</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="Value..."
                                value={filter.value}
                                onChange={(event) => updateFilter(filter.id, "value", event.target.value)}
                                className="w-[120px] h-8"
                                disabled={
                                  filter.condition === "is empty" || filter.condition === "is not empty"
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFilter(filter.id)}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        addFilter()
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Add filter
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant={sorts.length > 0 ? "default" : "outline"} 
                    size="sm"
                    className={sorts.length === 0 ? "border-dashed" : ""}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {sorts.length > 0 ? `Sorted by ${sorts[0].column}` : 'Sort'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full" align="start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Sorts</h4>
                      {sorts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sorts applied</p>
                      ) : (
                        <div className="space-y-2">
                          {sorts.map((sort) => (
                            <div key={sort.column} className="flex items-center gap-2 p-2 rounded-md">
                              <Select
                                value={sort.column}
                                onValueChange={(value) => updateSort(sort.column, "column", value)}
                              >
                                <SelectTrigger className="w-[140px] h-8">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="phoneNumber">Phone Number</SelectItem>
                                  <SelectItem value="userId">User ID</SelectItem>
                                  <SelectItem value="lastMessage">Last Message</SelectItem>
                                  <SelectItem value="status">Status</SelectItem>
                                  <SelectItem value="numberOfMessages"># of Messages</SelectItem>
                                  <SelectItem value="started">Started</SelectItem>
                                  <SelectItem value="lastActivity">Last Activity</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={sort.direction}
                                onValueChange={(value) => updateSort(sort.column, "direction", value as "asc" | "desc")}
                              >
                                <SelectTrigger className="w-[120px] h-8">
                                  <SelectValue placeholder="Direction" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="asc">
                                    <div className="flex items-center gap-2">
                                      <ArrowUp className="h-3 w-3" />
                                      Ascending
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="desc">
                                    <div className="flex items-center gap-2">
                                      <ArrowDown className="h-3 w-3" />
                                      Descending
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSort(sort.column)}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        addSort()
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4" />
                      Add sort
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2 h-9">
              {selectedCount > 0 ? (
                <>
                  <Button size="sm" onClick={handleBroadcast}>
                    {getBroadcastButtonText()}
                  </Button>
                  {aiColumns.size > 0 && (
                    <Button size="sm" onClick={() => setIsRunAnalysisDialogOpen(true)}>
                      Run Analysis
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
      </div>
      <Dialog open={isBroadcastDialogOpen} onOpenChange={setIsBroadcastDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast Message</DialogTitle>
            <DialogDescription>
              {allSelected
                ? "Send a message to all contacts"
                : selectedCount === 1
                  ? `Send a message to ${(selectedRows[0].original as Contact).phoneNumber}`
                  : `Send a message to ${selectedCount} selected contacts`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="broadcast-message">Message</Label>
              <Textarea
                id="broadcast-message"
                placeholder="Type your message here..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBroadcastDialogOpen(false)
                setBroadcastMessage("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendBroadcast}
              disabled={!broadcastMessage.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? "Sending..." : "Send Broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isRunAnalysisDialogOpen} onOpenChange={setIsRunAnalysisDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run AI Analysis</DialogTitle>
            <DialogDescription>
              Select an AI analysis column to run on {selectedCount === 1 
                ? `contact ${(selectedRows[0].original as Contact).phoneNumber}`
                : `${selectedCount} selected contacts`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="analysis-column">Analysis Column</Label>
              <Select
                value={selectedAnalysisColumn}
                onValueChange={setSelectedAnalysisColumn}
              >
                <SelectTrigger id="analysis-column">
                  <SelectValue placeholder="Select a column to analyze" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(aiColumns.entries()).map(([key, column]) => (
                    <SelectItem key={key} value={key}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRunAnalysisDialogOpen(false)
                setSelectedAnalysisColumn("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRunAnalysis}
              disabled={!selectedAnalysisColumn || isRunningAnalysis}
            >
              {isRunningAnalysis ? "Analyzing..." : "Run Analysis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div ref={tableContainerRef} className="overflow-auto rounded-md border max-h-[calc(100vh-200px)] [&_[data-slot=table-container]]:overflow-visible">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => {
                // Filter out Phone Number and non-sortable columns from SortableContext
                const sortableHeaders = headerGroup.headers.filter((header) => {
                  const accessorKey = 'accessorKey' in header.column.columnDef ? header.column.columnDef.accessorKey : undefined
                  const columnId = header.id || header.column.id || String(accessorKey || "")
                  return (
                    accessorKey !== "phoneNumber" &&
                    columnId !== "select" &&
                    !header.isPlaceholder
                  )
                })

                const sortableIds = sortableHeaders.map((h) => {
                  const accessorKey = 'accessorKey' in h.column.columnDef ? h.column.columnDef.accessorKey : undefined
                  return h.id || h.column.id || String(accessorKey || "")
                })

                return (
                  <TableRow key={headerGroup.id}>
                    <SortableContext
                      items={sortableIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      {headerGroup.headers.map((header, index) => {
                        const accessorKey = 'accessorKey' in header.column.columnDef ? header.column.columnDef.accessorKey : undefined
                        const columnId = header.id || header.column.id || String(accessorKey || "")
                        const isPhoneNumber = accessorKey === "phoneNumber"
                        const isSelectColumn = columnId === "select"
                        const isSortable = !isPhoneNumber && !isSelectColumn && !header.isPlaceholder
                        // Select column and Phone Number column are sticky
                        const isSticky = isSelectColumn || isPhoneNumber
                        // Calculate left offset for sticky columns
                        let leftOffset: string | undefined = undefined
                        // if (isSelectColumn) {
                        //   leftOffset = "0"
                        // } else if (isPhoneNumber) {
                        //   // Phone number comes after select column, so offset by select column width
                        //   const selectColumn = table.getAllColumns().find(col => col.id === "select")
                        //   const selectWidth = selectColumn?.getSize() || 80
                        //   leftOffset = `${selectWidth}px`
                        // }
                        const headerColor = columnColors[header.id] || ""
                        const headerTextColor = headerColor ? getContrastColor(headerColor) : undefined
                        
                        return (
                          <TableHead 
                            key={header.id}
                            className={cn(
                              isSticky ? "sticky z-10 border-r" : "border-r",
                              isSticky && !headerColor && "bg-background",
                              "relative overflow-hidden",
                              !headerColor && "hover:bg-muted/50"
                            )}
                            style={{
                              ...(isSticky ? { 
                                left: leftOffset,
                                ...(isScrolled && {
                                  boxShadow: "4px 0 12px -2px rgba(0, 0, 0, 0.25), 2px 0 6px -1px rgba(0, 0, 0, 0.2)"
                                }),
                              } : {}),
                              width: header.getSize(),
                              minWidth: header.column.columnDef.minSize,
                              maxWidth: header.column.columnDef.maxSize,
                              ...(headerColor ? {
                                backgroundColor: headerColor,
                                color: headerTextColor,
                              } : {}),
                            }}
                          >
                            {header.isPlaceholder ? null : (
                              isSortable ? (
                                <SortableColumnHeader
                                  id={columnId}
                                  isPhoneNumber={false}
                                >
                                  <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                    {flexRender(
                                      header.column.columnDef.header,
                                      header.getContext()
                                    )}
                                  </div>
                                </SortableColumnHeader>
                              ) : (
                                <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                                </div>
                              )
                            )}
                            {header.column.getCanResize() && (
                              <div
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  const handler = header.getResizeHandler()
                                  if (handler) {
                                    handler(e)
                                  }
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation()
                                  const handler = header.getResizeHandler()
                                  if (handler) {
                                    handler(e)
                                  }
                                }}
                                className={cn(
                                  "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none z-20",
                                  "bg-border hover:bg-primary/50 transition-colors",
                                  "hover:w-1.5",
                                  header.column.getIsResizing() && "bg-primary"
                                )}
                              />
                            )}
                          </TableHead>
                        )
                      })}
                    </SortableContext>
                  </TableRow>
                )
              })}
            </TableHeader>
            {/* Edit Column Dialog */}
            <Dialog open={isEditColumnDialogOpen} onOpenChange={setIsEditColumnDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit AI Analysis</DialogTitle>
                  <DialogDescription>
                    Update the column name and AI analysis prompt.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-column-name">Column Name</Label>
                    <Input
                      id="edit-column-name"
                      placeholder="e.g., Sentiment Analysis"
                      value={editColumnName}
                      onChange={(e) => setEditColumnName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-ai-description">What should the AI check?</Label>
                    <Textarea
                      id="edit-ai-description"
                      placeholder="e.g., Analyze the sentiment of the last message and determine if it's positive, negative, or neutral"
                      value={editAiDescription}
                      onChange={(e) => setEditAiDescription(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditColumnDialogOpen(false)
                      setEditingColumnKey("")
                      setEditColumnName("")
                      setEditAiDescription("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditColumn}
                    disabled={!editColumnName.trim() || !editAiDescription.trim()}
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {/* Alert Management Dialogs */}
            <Dialog open={isEditAlertDialogOpen} onOpenChange={setIsEditAlertDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Alert</DialogTitle>
                  <DialogDescription>
                    Update the alert name, type, and condition.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-alert-name">Alert Name</Label>
                    <Input
                      id="edit-alert-name"
                      placeholder="e.g., Customer Frustration"
                      value={editAlertName}
                      onChange={(e) => setEditAlertName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-alert-type">Alert Type</Label>
                    <Select value={editAlertType} onValueChange={(value) => setEditAlertType(value as 'ai' | 'keyword')}>
                      <SelectTrigger id="edit-alert-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keyword">Keyword Matching</SelectItem>
                        <SelectItem value="ai">AI Evaluation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-alert-condition">
                      {editAlertType === 'keyword' ? 'Keywords (comma-separated)' : 'AI Condition'}
                    </Label>
                    {editAlertType === 'keyword' ? (
                      <Input
                        id="edit-alert-condition"
                        placeholder="e.g., refund, cancel, complaint"
                        value={editAlertCondition}
                        onChange={(e) => setEditAlertCondition(e.target.value)}
                      />
                    ) : (
                      <Textarea
                        id="edit-alert-condition"
                        placeholder="e.g., Alert me if the customer seems frustrated or wants to cancel"
                        value={editAlertCondition}
                        onChange={(e) => setEditAlertCondition(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-alert-enabled"
                      checked={editAlertEnabled}
                      onChange={(e) => setEditAlertEnabled(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="edit-alert-enabled" className="cursor-pointer">
                      Enabled
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditAlertDialogOpen(false)
                      setEditingAlertId("")
                      setEditAlertName("")
                      setEditAlertCondition("")
                      setEditAlertType('keyword')
                      setEditAlertEnabled(true)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditAlert}
                    disabled={!editAlertName.trim() || !editAlertCondition.trim()}
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => row.toggleSelected()}
                  className="cursor-pointer group"
                >
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const accessorKey = 'accessorKey' in cell.column.columnDef ? cell.column.columnDef.accessorKey : undefined
                    const columnId = cell.column.id || String(accessorKey || "")
                    const isPhoneNumber = accessorKey === "phoneNumber"
                    const isSelectColumn = columnId === "select"
                    // Select column and Phone Number column are sticky
                    const isSticky = isSelectColumn || isPhoneNumber
                    // Calculate left offset for sticky columns
                    let leftOffset: string | undefined = undefined
                    if (isSelectColumn) {
                      leftOffset = "0"
                    } else if (isPhoneNumber) {
                      // Phone number comes after select column, so offset by select column width
                      const selectColumn = table.getAllColumns().find(col => col.id === "select")
                      const selectWidth = selectColumn?.getSize() || 80
                      leftOffset = `${selectWidth}px`
                    }
                    const cellColor = columnColors[cell.column.id] || ""
                    const cellBackgroundColor = cellColor ? getColorWithOpacity(cellColor, 0.1) : undefined
                    
                    return (
                      <TableCell 
                        key={cell.id}
                        className={cn(
                          isSticky ? "sticky z-10 border-r" : "border-r",
                          isSticky && !cellBackgroundColor && "bg-background group-hover:bg-muted/50",
                          "overflow-hidden"
                        )}
                        style={{
                          ...(isSticky ? { 
                            left: leftOffset,
                            ...(isScrolled && {
                              boxShadow: "4px 0 12px -2px rgba(0, 0, 0, 0.25), 2px 0 6px -1px rgba(0, 0, 0, 0.2)"
                            }),
                          } : {}),
                          width: cell.column.getSize(),
                          minWidth: cell.column.columnDef.minSize,
                          maxWidth: cell.column.columnDef.maxSize,
                          ...(cellBackgroundColor ? {
                            backgroundColor: cellBackgroundColor,
                          } : {}),
                        }}
                      >
                        <div className="min-w-0 overflow-hidden">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
            </TableBody>
            <TableFooter>
              <TableRow className="sticky bottom-0 z-20 bg-background border-t-2">
                {(() => {
                  // Calculate average number of messages once
                  const rows = table.getFilteredRowModel().rows
                  const averageMessages = rows.length > 0
                    ? (rows.reduce((sum, row) => {
                        const contact = row.original as Contact
                        return sum + (contact.numberOfMessages || 0)
                      }, 0) / rows.length).toFixed(2)
                    : "0.00"
                  
                  return table.getHeaderGroups()[0]?.headers.map((header, index) => {
                    const accessorKey = 'accessorKey' in header.column.columnDef ? header.column.columnDef.accessorKey : undefined
                    const columnId = header.column.id || String(accessorKey || "")
                    const isPhoneNumber = accessorKey === "phoneNumber"
                    const isSelectColumn = columnId === "select"
                    const isNumberOfMessages = accessorKey === "numberOfMessages"
                    // Select column and Phone Number column are sticky
                    const isSticky = isSelectColumn || isPhoneNumber
                    // Calculate left offset for sticky columns
                    let leftOffset: string | undefined = undefined
                    if (isSelectColumn) {
                      leftOffset = "0"
                    } else if (isPhoneNumber) {
                      // Phone number comes after select column, so offset by select column width
                      const selectColumn = table.getAllColumns().find(col => col.id === "select")
                      const selectWidth = selectColumn?.getSize() || 80
                      leftOffset = `${selectWidth}px`
                    }
                    const footerColor = columnColors[header.id] || ""
                    const footerBackgroundColor = footerColor ? getColorWithOpacity(footerColor, 0.1) : undefined
                    
                    return (
                      <TableCell
                        key={header.id}
                        className={cn(
                          isSticky ? "sticky z-30 border-r" : "border-r",
                          isSticky && !footerBackgroundColor && "bg-background",
                          index === 0 ? "font-medium" : "",
                          "overflow-hidden"
                        )}
                        style={{
                          ...(isSticky ? { 
                            left: leftOffset,
                            ...(isScrolled && {
                              boxShadow: "4px 0 12px -2px rgba(0, 0, 0, 0.25), 2px 0 6px -1px rgba(0, 0, 0, 0.2)"
                            }),
                          } : {}),
                          width: header.getSize(),
                          minWidth: header.column.columnDef.minSize,
                          maxWidth: header.column.columnDef.maxSize,
                          ...(footerBackgroundColor ? {
                            backgroundColor: footerBackgroundColor,
                          } : {}),
                        }}
                      >
                        <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                          {isSelectColumn ? (
                            <span>Total: {rows.length}</span>
                          ) : isNumberOfMessages ? (
                            <span>Avg: {averageMessages}</span>
                          ) : null}
                        </div>
                      </TableCell>
                    )
                  })
                })()}
              </TableRow>
            </TableFooter>
          </Table>
        </DndContext>
      </div>
      <Dialog open={isStartConversationDialogOpen} onOpenChange={setIsStartConversationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Conversation</DialogTitle>
            <DialogDescription>
              Add a phone number and send a message to start a new conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="conversation-phone">Phone Number</Label>
              <Input
                id="conversation-phone"
                placeholder="+1 (555) 123-4567"
                value={conversationPhoneNumber}
                onChange={(e) => setConversationPhoneNumber(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conversation-message">Message</Label>
              <Textarea
                id="conversation-message"
                placeholder="Type your message here..."
                value={conversationMessage}
                onChange={(e) => setConversationMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsStartConversationDialogOpen(false)
                setConversationPhoneNumber("")
                setConversationMessage("Hello! I'd like to start a conversation with you.")
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSendConversation}
              disabled={!(String(conversationPhoneNumber || "").trim()) || !(String(conversationMessage || "").trim()) || isSendingConversation}
            >
              {isSendingConversation ? "Sending..." : "Start Conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={isMessageSheetOpen} onOpenChange={setIsMessageSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <div className="border-b p-4">
            <SheetHeader>
              <SheetTitle>Conversation</SheetTitle>
              <SheetDescription>
                Thread for {sheetPhoneNumber || "this contact"}
              </SheetDescription>
            </SheetHeader>
          </div>
          
          {/* Message area */}
          <div ref={messageAreaRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversationMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm mb-2">No messages yet</p>
                <p className="text-xs">Start the conversation by sending a message below</p>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground text-center mb-4">
                  Inbound (customer) on the left • Outbound (you) on the right
                </div>
                {conversationMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isInbound ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.isInbound
                          ? "bg-muted"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p className={`text-xs mt-1 ${
                        msg.isInbound ? "text-muted-foreground" : "text-primary-foreground/70"
                      }`}>
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          
          {/* Input area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message here..."
                value={sheetMessage}
                onChange={(e) => setSheetMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendSheetMessage()
                  }
                }}
                rows={3}
                className="resize-none flex-1"
              />
              <Button
                onClick={handleSendSheetMessage}
                disabled={!sheetMessage.trim()}
                className="self-end"
              >
                Send
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

