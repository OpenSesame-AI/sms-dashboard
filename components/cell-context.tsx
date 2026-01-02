"use client"

import * as React from "react"
import { useOrganization } from "@clerk/nextjs"
import { useQueryClient } from "@tanstack/react-query"
import { Cell } from "@/lib/db/schema"

type CellContextType = {
  selectedCell: Cell | null
  setSelectedCell: (cell: Cell | null) => void
}

const CellContext = React.createContext<CellContextType | undefined>(undefined)

export function CellProvider({ children }: { children: React.ReactNode }) {
  const [selectedCell, setSelectedCell] = React.useState<Cell | null>(null)
  const { organization } = useOrganization()
  const queryClient = useQueryClient()

  // Clear selected cell and refetch when organization changes
  React.useEffect(() => {
    setSelectedCell(null)
    // Invalidate all cell queries (both personal and org contexts)
    queryClient.invalidateQueries({ queryKey: ['cells'] })
  }, [organization?.id, queryClient])

  // Memoize the context value to prevent unnecessary re-renders
  // This ensures the value object only changes when selectedCell actually changes
  const value = React.useMemo(
    () => ({ selectedCell, setSelectedCell }),
    [selectedCell]
  )

  return (
    <CellContext.Provider value={value}>
      {children}
    </CellContext.Provider>
  )
}

export function useCell() {
  const context = React.useContext(CellContext)
  if (context === undefined) {
    throw new Error("useCell must be used within a CellProvider")
  }
  return context
}


