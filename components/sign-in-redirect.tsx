"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function SignInRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.push("/sign-in")
  }, [router])
  
  return null
}
