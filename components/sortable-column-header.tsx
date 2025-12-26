"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SortableColumnHeaderProps {
  id: string
  children: ReactNode
  isPhoneNumber?: boolean
}

export function SortableColumnHeader({
  id,
  children,
  isPhoneNumber = false,
}: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: isPhoneNumber, // Disable dragging for Phone Number column
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (isPhoneNumber) {
    return <>{children}</>
  }

  // Extract onPointerDown to handle in capture phase, keep other listeners
  const { onPointerDown, ...otherListeners } = listeners || {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...otherListeners}
      onPointerDownCapture={(e) => {
        // Capture phase - runs before button receives the event
        // This allows drag to initiate from anywhere
        if (onPointerDown) {
          onPointerDown(e as any)
        }
      }}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      {children}
    </div>
  )
}

