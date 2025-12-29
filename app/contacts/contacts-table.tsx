"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
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
import { Plus, X, GripVertical, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Download, Search, Pencil, Funnel } from "lucide-react"
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
} from "@/components/ui/dropdown-menu"

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

  // Create columns with AI columns dynamically
  const columns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    const aiColumnDefs: ColumnDef<TData, TValue>[] = Array.from(aiColumns.entries()).map(([columnKey, columnDef]) => ({
      accessorKey: columnKey,
      header: () => (
        <div className="flex items-center gap-2">
          <span>{columnDef.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              setEditingColumnKey(columnKey)
              setEditColumnName(columnDef.name)
              setEditAiDescription(columnDef.prompt)
              setIsEditColumnDialogOpen(true)
            }}
          >
            <Pencil className="h-3 w-3" />
            <span className="sr-only">Edit column</span>
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const contact = row.original as Contact
        const result = analysisResults.get(columnKey)?.get(contact.phoneNumber)
        const isLoading = analysisLoading.get(columnKey) || false
        
        if (isLoading) {
          return <span className="text-muted-foreground">Analyzing...</span>
        }
        
        if (result === undefined) {
          return <span className="text-muted-foreground">Pending</span>
        }
        
        if (result === null) {
          return <span className="text-destructive">Error</span>
        }
        
        return <span className="text-sm">{result}</span>
      },
    }))
    
    return [...initialColumnOrder, ...aiColumnDefs]
  }, [initialColumnOrder, aiColumns, analysisResults, analysisLoading])
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

  const handleOpenMessageSheet = (phoneNumber: string) => {
    setSheetPhoneNumber(phoneNumber)
    setIsMessageSheetOpen(true)
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
        body: JSON.stringify({ message, to: [phoneNumber] }),
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
      meta: {
        onStartConversation: handleStartConversation,
        onOpenMessageSheet: handleOpenMessageSheet,
      },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  // Get selected rows and determine broadcast button text
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const totalRows = table.getFilteredRowModel().rows.length
  const allSelected = selectedCount > 0 && selectedCount === totalRows

  const getBroadcastButtonText = () => {
    if (allSelected) {
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
        body: JSON.stringify({ message: body, to: selectedPhones }),
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
      {/* Phone Number Search Bar */}
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

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 flex-1">
          {filters.map((filter) => (
            <div key={filter.id} className="flex items-center gap-2">
              <Select
                value={filter.column}
                onValueChange={(value) => updateFilter(filter.id, "column", value)}
              >
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select condition" />
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
                placeholder="Filter value..."
                value={filter.value}
                onChange={(event) => updateFilter(filter.id, "value", event.target.value)}
                className="w-[200px]"
                disabled={
                  filter.condition === "is empty" || filter.condition === "is not empty"
                }
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeFilter(filter.id)}
                className="h-10 w-10"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove filter</span>
              </Button>
            </div>
          ))}
          {sorts.map((sort) => (
            <div key={sort.column} className="flex items-center gap-2">
              <Select
                value={sort.column}
                onValueChange={(value) => updateSort(sort.column, "column", value)}
              >
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[120px]">
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
                className="h-10 w-10"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove sort</span>
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addFilter}>
              <Funnel className=" h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline" size="sm" onClick={addSort}>
              <ArrowUpDown className=" h-4 w-4" />
              Sort
            </Button>
            {selectedCount > 0 && (
              <>
                <Button onClick={handleBroadcast}>
                  {getBroadcastButtonText()}
                </Button>
                {aiColumns.size > 0 && (
                  <Button onClick={() => setIsRunAnalysisDialogOpen(true)}>
                    Run Analysis
                  </Button>
                )}
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
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
              </>
            )}
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
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
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
            <Plus className="mr-2 h-4 w-4" />
            Start conversation
          </Button>
        </div>
      </div>
      <div ref={tableContainerRef} className="overflow-x-auto rounded-md border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => {
                // Filter out Phone Number and non-sortable columns from SortableContext
                const sortableHeaders = headerGroup.headers.filter((header) => {
                  const accessorKey = 'accessorKey' in header.column.columnDef ? header.column.columnDef.accessorKey : undefined
                  const columnId = header.id || header.column.id || String(accessorKey || "")
                  return (
                    accessorKey !== "phoneNumber" &&
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
                        const isSortable = !isPhoneNumber && !header.isPlaceholder
                        // Phone Number column (with checkbox) is sticky
                        const isSticky = isPhoneNumber
                        // Phone Number is at the left edge
                        const leftOffset = isSticky ? "0" : undefined
                        
                        return (
                          <TableHead 
                            key={header.id}
                            className={cn(
                              isSticky ? "sticky z-10 bg-background border-r" : "border-r"
                            )}
                            style={isSticky ? { 
                              left: leftOffset,
                              ...(isScrolled && {
                                boxShadow: "4px 0 12px -2px rgba(0, 0, 0, 0.25), 2px 0 6px -1px rgba(0, 0, 0, 0.2)"
                              })
                            } : undefined}
                          >
                            {header.isPlaceholder ? null : (
                              isSortable ? (
                                <SortableColumnHeader
                                  id={columnId}
                                  isPhoneNumber={false}
                                >
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                                </SortableColumnHeader>
                              ) : (
                                flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )
                              )
                            )}
                          </TableHead>
                        )
                      })}
                    </SortableContext>
                  <TableHead>
                    <Dialog open={isAddColumnDialogOpen} onOpenChange={setIsAddColumnDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          <Plus className="mr-2 h-4 w-4" />
                          Add AI analysis
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add AI Analysis</DialogTitle>
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
                            type="submit"
                            onClick={handleEditColumn}
                            disabled={!editColumnName.trim() || !editAiDescription.trim()}
                          >
                            Save Changes
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableHead>
                  </TableRow>
                )
              })}
            </TableHeader>
            <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const accessorKey = 'accessorKey' in cell.column.columnDef ? cell.column.columnDef.accessorKey : undefined
                    const columnId = cell.column.id || String(accessorKey || "")
                    const isPhoneNumber = accessorKey === "phoneNumber"
                    // Phone Number column (with checkbox) is sticky
                    const isSticky = isPhoneNumber
                    // Phone Number is at the left edge
                    const leftOffset = isSticky ? "0" : undefined
                    
                    return (
                      <TableCell 
                        key={cell.id}
                        className={cn(
                          isSticky ? "sticky z-10 bg-background border-r" : "border-r"
                        )}
                        style={isSticky ? { 
                          left: leftOffset,
                          ...(isScrolled && {
                            boxShadow: "4px 0 12px -2px rgba(0, 0, 0, 0.25), 2px 0 6px -1px rgba(0, 0, 0, 0.2)"
                          })
                        } : undefined}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
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
              <TableRow>
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
                    const isPhoneNumber = accessorKey === "phoneNumber"
                    const isNumberOfMessages = accessorKey === "numberOfMessages"
                    const isSticky = isPhoneNumber
                    const leftOffset = isSticky ? "0" : undefined
                    
                    return (
                      <TableCell
                        key={header.id}
                        className={cn(
                          isSticky ? "sticky z-10 bg-muted/50 border-r" : "border-r",
                          index === 0 ? "font-medium" : ""
                        )}
                        style={isSticky ? { 
                          left: leftOffset,
                          ...(isScrolled && {
                            boxShadow: "4px 0 12px -2px rgba(0, 0, 0, 0.25), 2px 0 6px -1px rgba(0, 0, 0, 0.2)"
                          })
                        } : undefined}
                      >
                        {isPhoneNumber ? (
                          <span>Total: {rows.length}</span>
                        ) : isNumberOfMessages ? (
                          <span>Avg: {averageMessages}</span>
                        ) : null}
                      </TableCell>
                    )
                  })
                })()}
              </TableRow>
            </TableFooter>
          </Table>
        </DndContext>
      </div>
    </div>
  )
}

