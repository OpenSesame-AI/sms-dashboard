"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Contact } from "@/lib/data"
import { ArrowUpDown } from "lucide-react"

export function createSalesforceColumns(): ColumnDef<Contact>[] {
  return [
    {
      accessorKey: "firstName",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>First Name</span>
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-4 w-4 hover:bg-muted rounded"
            >
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        )
      },
      cell: ({ row }) => {
        const value = row.getValue("firstName") as string | undefined
        return (
          <div className="truncate" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
    {
      accessorKey: "lastName",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Last Name</span>
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-4 w-4 hover:bg-muted rounded"
            >
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        )
      },
      cell: ({ row }) => {
        const value = row.getValue("lastName") as string | undefined
        return (
          <div className="truncate" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Email</span>
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-4 w-4 hover:bg-muted rounded"
            >
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        )
      },
      cell: ({ row }) => {
        const value = row.getValue("email") as string | undefined
        return (
          <div className="truncate" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
    {
      accessorKey: "accountName",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Account Name</span>
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-4 w-4 hover:bg-muted rounded"
            >
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        )
      },
      cell: ({ row }) => {
        const value = row.getValue("accountName") as string | undefined
        return (
          <div className="truncate" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
    {
      accessorKey: "salesforceId",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Salesforce ID</span>
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-4 w-4 hover:bg-muted rounded"
            >
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        )
      },
      cell: ({ row }) => {
        const value = row.getValue("salesforceId") as string | undefined
        return (
          <div className="truncate font-mono text-xs" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
  ]
}

