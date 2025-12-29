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

export async function GET() {
  try {
    const [
      summary,
      messagesOverTime,
      messagesByDirection,
      statusBreakdown,
      topContacts,
      newContactsOverTime,
      hourlyDistribution,
    ] = await Promise.all([
      getAnalyticsSummary(),
      getMessagesOverTime(),
      getMessagesByDirection(),
      getStatusBreakdown(),
      getTopActiveContacts(10),
      getNewContactsOverTime(),
      getHourlyDistribution(),
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




