import { headers } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { getCellById } from "@/lib/db/queries"
import { CellLandingPage } from "@/components/cell-landing-page"

function isMobileDevice(userAgent: string | null): boolean {
  if (!userAgent) return false
  
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
  return mobileRegex.test(userAgent)
}

export default async function CellPage({
  params,
}: {
  params: Promise<{ cellId: string }>
}) {
  const { cellId } = await params
  const headersList = await headers()
  const userAgent = headersList.get("user-agent")
  
  // Fetch the cell
  const cell = await getCellById(cellId)
  
  if (!cell) {
    notFound()
  }
  
  // Check if mobile device and redirect to SMS
  if (isMobileDevice(userAgent)) {
    redirect(`sms:${cell.phoneNumber}`)
  }
  
  // Desktop: show landing page
  return <CellLandingPage cell={cell} />
}

