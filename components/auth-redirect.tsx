"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function AuthRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.push("/table")
  }, [router])
  
  return null
}








