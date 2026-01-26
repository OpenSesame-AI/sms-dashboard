import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getScheduledMessages, createScheduledMessage } from '@/lib/db/queries'
import { validatePhoneNumber, normalizePhoneNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const cellId = searchParams.get('cellId')
    const status = searchParams.get('status')

    if (!cellId) {
      return NextResponse.json(
        { error: 'cellId is required' },
        { status: 400 }
      )
    }

    const messages = await getScheduledMessages(cellId, status || undefined)
    
    // Parse recipients JSON for each message
    const messagesWithParsedRecipients = messages.map(msg => ({
      ...msg,
      recipients: JSON.parse(msg.recipients),
    }))

    return NextResponse.json(messagesWithParsedRecipients)
  } catch (error) {
    console.error('Error fetching scheduled messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled messages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { cellId, message, recipients, scheduledFor } = body

    // Validate required fields
    if (!cellId || typeof cellId !== 'string') {
      return NextResponse.json(
        { error: 'cellId is required' },
        { status: 400 }
      )
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'message is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'recipients must be a non-empty array of phone numbers' },
        { status: 400 }
      )
    }

    if (!scheduledFor) {
      return NextResponse.json(
        { error: 'scheduledFor is required' },
        { status: 400 }
      )
    }

    // Parse and validate scheduledFor date
    const scheduledDate = new Date(scheduledFor)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'scheduledFor must be a valid date' },
        { status: 400 }
      )
    }

    // Ensure scheduled time is in the future
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'scheduledFor must be in the future' },
        { status: 400 }
      )
    }

    // Validate and normalize phone numbers
    const defaultCountry = 'US'
    const normalizedRecipients: string[] = []
    
    for (const recipient of recipients) {
      if (typeof recipient !== 'string' || !recipient.trim()) {
        return NextResponse.json(
          { error: 'All recipients must be non-empty strings' },
          { status: 400 }
        )
      }
      
      if (!validatePhoneNumber(recipient, defaultCountry)) {
        return NextResponse.json(
          { error: `Invalid phone number: ${recipient}` },
          { status: 400 }
        )
      }

      const normalized = normalizePhoneNumber(recipient, defaultCountry)
      if (!normalized) {
        return NextResponse.json(
          { error: `Could not normalize phone number: ${recipient}` },
          { status: 400 }
        )
      }
      
      normalizedRecipients.push(normalized)
    }

    const scheduledMessage = await createScheduledMessage({
      cellId,
      message: message.trim(),
      recipients: normalizedRecipients,
      scheduledFor: scheduledDate,
      createdBy: userId,
    })

    return NextResponse.json({
      ...scheduledMessage,
      recipients: normalizedRecipients,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating scheduled message:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create scheduled message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
