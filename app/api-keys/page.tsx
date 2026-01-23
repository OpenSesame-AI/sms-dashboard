"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useCell } from "@/components/cell-context"
import { ApiKeysManagement } from "@/components/api-keys/api-keys-management"

export default function ApiKeysPage() {
  const router = useRouter()
  const { selectedCell } = useCell()

  // Redirect if no cell is selected
  React.useEffect(() => {
    if (!selectedCell) {
      router.push("/table")
    }
  }, [selectedCell, router])

  if (!selectedCell) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">
          Manage API keys for programmatic access to {selectedCell.name}.
        </p>
      </div>
      <div className="space-y-4">
        <ApiKeysManagement cellId={selectedCell.id} />
      </div>
    </div>
  )
}
