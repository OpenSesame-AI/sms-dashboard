"use client"

import { SignedIn, SignedOut } from "@clerk/nextjs"
import { CellsGrid } from "@/components/cells-grid"
import { SignInRedirect } from "@/components/sign-in-redirect"

export default function Home() {
  return (
    <>
      <SignedIn>
        <CellsGrid />
      </SignedIn>
      <SignedOut>
        <SignInRedirect />
      </SignedOut>
    </>
  )
}
