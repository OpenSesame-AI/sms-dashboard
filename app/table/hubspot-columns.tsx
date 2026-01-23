"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Contact } from "@/lib/data"
import { ArrowUpDown } from "lucide-react"

export function createHubspotColumns(): ColumnDef<Contact>[] {
  return [
    {
      id: "hubspotId",
      accessorKey: "hubspotId",
      enableHiding: true,
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>HubSpot ID</span>
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
        const value = row.getValue("hubspotId") as string | undefined
        return (
          <div className="truncate font-mono text-xs" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
    {
      id: "companyName",
      accessorKey: "companyName",
      enableHiding: true,
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Company Name</span>
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
        const value = row.getValue("companyName") as string | undefined
        return (
          <div className="truncate" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
    {
      id: "companyId",
      accessorKey: "companyId",
      enableHiding: true,
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-2">
            <span>Company ID</span>
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
        const value = row.getValue("companyId") as string | undefined
        return (
          <div className="truncate font-mono text-xs" title={value || ""}>
            {value || "-"}
          </div>
        )
      },
    },
  ]
}
