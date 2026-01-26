"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { SignedIn, SignedOut, OrganizationSwitcher } from "@clerk/nextjs"
import { HeaderActions } from "@/components/header-actions"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { UserButton } from "@clerk/nextjs"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { TableSelector } from "@/components/table-selector"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// Route name mapping
const routeNames: Record<string, string> = {
  "/": "Home",
  "/table": "Table",
  "/create": "Create",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/video": "Video",
  "/context": "Context",
  "/templates": "Templates",
}

export function PublicRouteWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicRoute = pathname?.startsWith("/c/")

  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <>
      <SignedOut>
        {children}
      </SignedOut>
      <SignedIn>
        <SidebarProvider defaultOpen={false} className="flex flex-col h-screen">
          <header className="flex py-2 shrink-0 items-center justify-between gap-2 border-b px-2 relative z-[100] bg-background w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Link href="/" className="flex items-center hover:opacity-80 transition-opacity shrink-0">
                <img 
                  src="/apple-touch-icon.png" 
                  alt="Logo" 
                  className="h-8 w-8 object-contain"
                  style={{ display: 'block' }}
                />
              </Link>
              <Breadcrumb className="hidden md:flex">
                <BreadcrumbList>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <div className="relative z-[100]">
                      <OrganizationSwitcher 
                        hidePersonal={false}
                        afterSelectOrganizationUrl="/"
                        afterSelectPersonalUrl="/"
                      />
                    </div>
                  </BreadcrumbItem>
                  {pathname !== "/create" && pathname !== "/" && pathname !== "/integrations" && pathname !== "/templates" && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <TableSelector />
                      </BreadcrumbItem>
                    </>
                  )}
                  {pathname !== "/" && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          {routeNames[pathname || "/"] || pathname?.split("/").pop() || pathname || "Home"}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2 relative z-[100]">
              <HeaderActions />
              <AnimatedThemeToggler className="h-8 w-8" />
              <div className="relative z-[100]">
                <UserButton />
              </div>
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden">
            <AppSidebar />
            <SidebarInset>
              <div className="flex flex-1 flex-col gap-4 p-4 overflow-y-auto">
                {children}
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </SignedIn>
    </>
  )
}
