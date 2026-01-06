import { NextResponse } from 'next/server'
import {
  getAnalyticsSummary,
  getMessagesOverTime,
  getMessagesByDirection,
  getStatusBreakdown,
  getTopActiveContacts,
  getNewContactsOverTime,
  getHourlyDistribution,
} from '@/lib/db/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cellId = searchParams.get('cellId') || undefined

    if (!cellId) {
      return NextResponse.json(
        { error: 'cellId is required' },
        { status: 400 }
      )
    }

    const [
      summary,
      messagesOverTime,
      messagesByDirection,
      statusBreakdown,
      topContacts,
      newContactsOverTime,
      hourlyDistribution,
    ] = await Promise.all([
      getAnalyticsSummary(cellId),
      getMessagesOverTime(cellId),
      getMessagesByDirection(cellId),
      getStatusBreakdown(cellId),
      getTopActiveContacts(10, cellId),
      getNewContactsOverTime(cellId),
      getHourlyDistribution(cellId),
    ])

    return NextResponse.json({
      summary,
      messagesOverTime,
      messagesByDirection,
      statusBreakdown,
      topContacts,
      newContactsOverTime,
      hourlyDistribution,
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}





