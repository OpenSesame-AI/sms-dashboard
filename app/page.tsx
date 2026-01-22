"use client"

import { SignedIn, SignedOut } from "@clerk/nextjs"
import { AuthRedirect } from "@/components/auth-redirect"
import { SignInRedirect } from "@/components/sign-in-redirect"

export default function Home() {
  return (
    <>
      <SignedIn>
        <AuthRedirect />
      </SignedIn>
      <SignedOut>
        <SignInRedirect />
      </SignedOut>
    </>
  )
}
