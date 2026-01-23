"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useOrganization } from "@clerk/nextjs"
import { useQuery } from "@tanstack/react-query"
import { Cell } from "@/lib/db/schema"
import { useCell } from "@/components/cell-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

export function CellsGrid() {
  const router = useRouter()
  const { organization } = useOrganization()
  const { setSelectedCell } = useCell()
  const orgId = organization?.id || null

  // Fetch cells from API
  const { data: cells = [], isLoading } = useQuery<Cell[]>({
    queryKey: ['cells', orgId],
    queryFn: async () => {
      const response = await fetch('/api/cells')
      if (!response.ok) {
        throw new Error('Failed to fetch cells')
      }
      return response.json()
    },
  })

  const handleCellClick = (cell: Cell) => {
    setSelectedCell(cell)
    router.push('/table')
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading cells...</p>
      </div>
    )
  }

  if (cells.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground text-lg">No cells yet</p>
        <p className="text-muted-foreground text-sm">Create your first cell to get started</p>
        <Button asChild>
          <Link href="/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Cell
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cells</h1>
          <p className="text-muted-foreground mt-1">
            Select a cell to view its contacts and conversations
          </p>
        </div>
        <Button asChild>
          <Link href="/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Cell
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cells.map((cell) => (
          <Card
            key={cell.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleCellClick(cell)}
          >
            <CardHeader>
              <CardTitle>{cell.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription className="font-mono text-sm">
                {cell.phoneNumber}
              </CardDescription>
              <p className="text-xs text-muted-foreground">
                {cell.createdAt ? `Created on ${formatDate(cell.createdAt)}` : 'Created date unavailable'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
