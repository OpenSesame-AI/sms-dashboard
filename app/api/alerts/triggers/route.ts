import { NextRequest, NextResponse } from 'next/server'
import { getAiAlertTriggers, dismissAiAlertTrigger, dismissAllAlertTriggersForContact, getActiveAlertTriggersForContact } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const phoneNumber = searchParams.get('phoneNumber') || undefined
    const cellId = searchParams.get('cellId') || undefined
    const dismissed = searchParams.get('dismissed')
    const dismissedBool = dismissed === 'true' ? true : dismissed === 'false' ? false : undefined
    
    const triggers = await getAiAlertTriggers(phoneNumber, cellId, dismissedBool)
    
    // Join with alert details
    const triggersWithAlerts = await Promise.all(
      triggers.map(async (trigger) => {
        const { getAiAlertById } = await import('@/lib/db/queries')
        const alert = await getAiAlertById(trigger.alertId)
        return {
          ...trigger,
          alert: alert ? {
            id: alert.id,
            name: alert.name,
            type: alert.type,
          } : null,
        }
      })
    )
    
    return NextResponse.json(triggersWithAlerts)
  } catch (error) {
    console.error('Error fetching alert triggers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert triggers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { triggerId, phoneNumber, cellId, dismissAll } = body

    if (dismissAll && phoneNumber) {
      await dismissAllAlertTriggersForContact(phoneNumber, cellId)
      return NextResponse.json({ success: true })
    }

    if (!triggerId) {
      return NextResponse.json(
        { error: 'triggerId is required' },
        { status: 400 }
      )
    }

    const trigger = await dismissAiAlertTrigger(triggerId)
    if (!trigger) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, trigger })
  } catch (error) {
    console.error('Error dismissing alert trigger:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to dismiss alert trigger', details: errorMessage },
      { status: 500 }
    )
  }
}

