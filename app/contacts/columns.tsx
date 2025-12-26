"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Plus, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Contact } from "@/lib/data"

export const columns: ColumnDef<Contact>[] = [
  {
    accessorKey: "phoneNumber",
    enableSorting: false,
    header: ({ column, table }) => {
      const onStartConversation = (table.options.meta as any)?.onStartConversation
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
          <span>Phone Number</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={onStartConversation}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Start conversation</span>
          </Button>
        </div>
      )
    },
    cell: ({ row, table }) => {
      const onOpenMessageSheet = (table.options.meta as any)?.onOpenMessageSheet
      const phoneNumber = row.getValue("phoneNumber") as string
      
      return (
        <div className="flex items-center gap-2 group">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
          <span className="flex-1">{phoneNumber}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onOpenMessageSheet?.(phoneNumber)}
            aria-label={`Start conversation with ${phoneNumber}`}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  },
  {
    accessorKey: "userId",
    enableSorting: false,
    header: () => "User ID",
  },
  {
    accessorKey: "lastMessage",
    enableSorting: false,
    header: () => "Last Message",
    cell: ({ row }) => {
      const message = row.getValue("lastMessage") as string | null
      return (
        <div className="max-w-[300px] truncate" title={message || ""}>
          {message || "-"}
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    enableSorting: false,
    header: () => "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const variant =
        status === "active"
          ? "default"
          : status === "pending"
            ? "secondary"
            : "outline"
      return (
        <Badge variant={variant} className="capitalize">
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "numberOfMessages",
    enableSorting: false,
    header: () => "# of Messages",
    cell: ({ row }) => {
      return <div>{row.getValue("numberOfMessages")}</div>
    },
  },
  {
    accessorKey: "started",
    enableSorting: false,
    header: () => "Started",
  },
  {
    accessorKey: "lastActivity",
    enableSorting: false,
    header: () => "Last Activity",
  },
]

