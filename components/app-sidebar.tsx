"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Users,
  BarChart3,
  Settings,
  FileText,
  Key,
  LayoutGrid,
  BookOpen,
  CreditCard,
  Plug,
  Wrench,
  Monitor,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useCell } from "@/components/cell-context"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"

const menuItems = [
  {
    title: "Cells",
    url: "/",
    icon: LayoutGrid,
  },
//   {
//     title: "Usage",
//     url: "/usage",
//     icon: BookOpen,
//   },
//   {
//     title: "Billing",
//     url: "/billing",
//     icon: CreditCard,
//   },
  {
    title: "Integrations",
    url: "/integrations",
    icon: Plug,
  },
  {
    title: "Table",
    url: "/table",
    icon: Users,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Tools",
    url: "/tools",
    icon: Wrench,
  },
  {
    title: "Platforms",
    url: "/platforms",
    icon: Monitor,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { selectedCell } = useCell()
  const { setOpen } = useSidebar()
  
  const isContextPage = pathname === "/context"
  const isApiKeysPage = pathname === "/api-keys"
  
  // Handle hover to expand/collapse sidebar
  const handleMouseEnter = React.useCallback(() => {
    setOpen(true)
  }, [setOpen])
  
  const handleMouseLeave = React.useCallback(() => {
    setOpen(false)
  }, [setOpen])

  // Fetch context count for selected cell
  const { data: contextItems = [] } = useQuery({
    queryKey: ["cell-context", selectedCell?.id],
    queryFn: async () => {
      if (!selectedCell?.id) return []
      const response = await fetch(`/api/cells/${selectedCell.id}/context`)
      if (!response.ok) {
        throw new Error("Failed to fetch context")
      }
      return response.json()
    },
    enabled: !!selectedCell?.id,
  })

  const contextCount = contextItems.length

  return (
    <Sidebar 
      collapsible="icon" 
      variant="sidebar"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarContent>
        {/* Base URL bundle group: Cells, Usage, Billing, Integrations */}
        {["/", "/usage", "/billing", "/integrations"].includes(pathname) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems
                  .filter((item) => {
                    // Base URL bundle: these pages should only show each other
                    const baseUrlBundle = ["/", "/usage", "/billing", "/integrations"]
                    return baseUrlBundle.includes(item.url)
                  })
                  .map((item) => {
                    const isActive = item.url === "/" 
                      ? pathname === "/"
                      : pathname === item.url || pathname?.startsWith(item.url + "/")
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {/* First group: Table and Analytics */}
        {!["/", "/usage", "/billing", "/integrations"].includes(pathname) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems
                  .filter((item) => item.url === "/table" || item.url === "/analytics")
                  .map((item) => {
                    const isActive = pathname === item.url || pathname?.startsWith(item.url + "/")
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {/* Second group: Tools, Platforms, and Context */}
        {!["/", "/usage", "/billing", "/integrations"].includes(pathname) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems
                  .filter((item) => item.url === "/tools" || item.url === "/platforms")
                  .map((item) => {
                    const isActive = pathname === item.url || pathname?.startsWith(item.url + "/")
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                {selectedCell && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isContextPage}>
                      <Link href="/context">
                        <FileText />
                        <span>Context</span>
                        {contextCount > 0 && (
                          <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                            {contextCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {/* Third group: API Keys and Settings */}
        {!["/", "/usage", "/billing", "/integrations"].includes(pathname) && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {selectedCell && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isApiKeysPage}>
                      <Link href="/api-keys">
                        <Key />
                        <span>API Keys</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/settings"}>
                    <Link href="/settings">
                      <Settings />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
