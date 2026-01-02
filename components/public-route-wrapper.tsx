"use client"

import { usePathname } from "next/navigation"
import { SignIn, SignedIn, SignedOut, OrganizationSwitcher } from "@clerk/nextjs"
import { HeaderActions } from "@/components/header-actions"
import { TableSelector } from "@/components/table-selector"
import { AnalyticsButton } from "@/components/analytics-button"
import { ContextButton } from "@/components/context-button"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { UserButton } from "@clerk/nextjs"

export function PublicRouteWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicRoute = pathname?.startsWith("/c/")

  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center">
          <SignIn />
        </div>
        {children}
      </SignedOut>
      <SignedIn>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 relative z-[100] bg-background">
          <div className="flex items-center gap-2">
            <TableSelector />
            <AnalyticsButton />
            <ContextButton />
          </div>
          <div className="flex items-center gap-2 relative z-[100]">
            <HeaderActions />
            <div className="relative z-[100]">
              <OrganizationSwitcher 
                hidePersonal={false}
                afterSelectOrganizationUrl="/"
                afterSelectPersonalUrl="/"
              />
            </div>
            <AnimatedThemeToggler className="h-8 w-8" />
            <div className="relative z-[100]">
              <UserButton />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SignedIn>
    </>
  )
}

