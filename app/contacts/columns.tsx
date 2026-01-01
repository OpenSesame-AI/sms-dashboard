"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Plus, MessageSquare, AlertTriangle, Type } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Contact } from "@/lib/data"
import { formatPhoneNumber, getCountryCode } from "@/lib/utils"
import ReactCountryFlag from "react-country-flag"

export const columns: ColumnDef<Contact>[] = [
  {
    id: "select",
    enableSorting: false,
    enableResizing: false,
    size: 80,
    minSize: 80,
    maxSize: 80,
    header: ({ table }) => {
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select all"
          />
        </div>
      )
    },
    cell: ({ row, table }) => {
      const rowIndex = table.getRowModel().rows.findIndex(r => r.id === row.id)
      const displayIndex = rowIndex + 1
      const onOpenMessageSheet = (table.options.meta as any)?.onOpenMessageSheet
      const phoneNumber = row.original.phoneNumber
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => {
              row.toggleSelected(!!value)
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
          <span className="text-sm text-muted-foreground">{displayIndex}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto mr-2"
            onClick={(e) => {
              e.stopPropagation()
              onOpenMessageSheet?.(phoneNumber)
            }}
            aria-label={`Start conversation with ${phoneNumber}`}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  },
  {
    accessorKey: "phoneNumber",
    enableSorting: false,
    header: ({ column, table }) => {
      const onStartConversation = (table.options.meta as any)?.onStartConversation
      return (
        <div className="flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Phone Number</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onStartConversation()
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Start conversation</span>
          </Button>
        </div>
      )
    },
    cell: ({ row, table }) => {
      const unreadPhoneNumbers = (table.options.meta as any)?.unreadPhoneNumbers as Set<string> | undefined
      const alertTriggers = (table.options.meta as any)?.alertTriggers as Map<string, Array<any>> | undefined
      const onDismissAlerts = (table.options.meta as any)?.onDismissAlerts as ((phoneNumber: string) => void) | undefined
      const phoneNumber = row.getValue("phoneNumber") as string
      const isUnread = unreadPhoneNumbers?.has(phoneNumber) ?? false
      const contactAlerts = alertTriggers?.get(phoneNumber) || []
      const hasAlerts = contactAlerts.length > 0
      
      const formattedPhoneNumber = formatPhoneNumber(phoneNumber)
      const countryCode = getCountryCode(phoneNumber)
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {countryCode && (
              <ReactCountryFlag
                countryCode={countryCode}
                svg
                style={{
                  width: '1.2em',
                  height: '1.2em',
                }}
                title={countryCode}
              />
            )}
            <span className="truncate" title={phoneNumber}>{formattedPhoneNumber}</span>
            {isUnread && (
              <span
                className="relative flex h-2 w-2"
                aria-label="New message"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
            )}
            {hasAlerts && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDismissAlerts?.(phoneNumber)
                }}
                className="relative flex items-center"
                aria-label={`${contactAlerts.length} alert(s)`}
                title={`${contactAlerts.length} alert(s): ${contactAlerts.map(a => a.alertName).join(', ')}`}
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {contactAlerts.length > 1 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {contactAlerts.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "userId",
    enableSorting: false,
    header: () => "User ID",
    cell: ({ row }) => {
      const value = row.getValue("userId") as string
      return (
        <div className="truncate" title={value || ""}>
          {value || "-"}
        </div>
      )
    },
  },
  {
    accessorKey: "lastMessage",
    enableSorting: false,
    header: () => "Last Message",
    cell: ({ row, table }) => {
      const message = row.getValue("lastMessage") as string | null
      const phoneNumber = row.getValue("phoneNumber") as string
      const onOpenMessageSheet = (table.options.meta as any)?.onOpenMessageSheet
      
      return (
        <div 
          className="truncate cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors" 
          title={message || ""}
          onClick={(e) => {
            e.stopPropagation()
            onOpenMessageSheet?.(phoneNumber)
          }}
        >
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
    cell: ({ row }) => {
      const value = row.getValue("started") as string
      return (
        <div className="truncate" title={value || ""}>
          {value || "-"}
        </div>
      )
    },
  },
  {
    accessorKey: "lastActivity",
    enableSorting: false,
    header: () => "Last Activity",
    cell: ({ row }) => {
      const value = row.getValue("lastActivity") as string
      return (
        <div className="truncate" title={value || ""}>
          {value || "-"}
        </div>
      )
    },
  },
]

