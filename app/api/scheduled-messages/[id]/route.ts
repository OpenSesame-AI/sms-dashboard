import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { 
  getScheduledMessageById, 
  updateScheduledMessage, 
  cancelScheduledMessage,
  deleteScheduledMessage 
} from '@/lib/db/queries'
import { validatePhoneNumber, normalizePhoneNumber } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const message = await getScheduledMessageById(id)

    if (!message) {
      return NextResponse.json(
        { error: 'Scheduled message not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...message,
      recipients: JSON.parse(message.recipients),
    })
  } catch (error) {
    console.error('Error fetching scheduled message:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled message' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { message, recipients, scheduledFor, status } = body

    // Check if message exists
    const existingMessage = await getScheduledMessageById(id)
    if (!existingMessage) {
      return NextResponse.json(
        { error: 'Scheduled message not found' },
        { status: 404 }
      )
    }

    // Only allow editing pending messages
    if (existingMessage.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only edit pending scheduled messages' },
        { status: 400 }
      )
    }

    const updateData: {
      message?: string
      recipients?: string[]
      scheduledFor?: Date
      status?: string
    } = {}

    if (message !== undefined) {
      if (typeof message !== 'string' || !message.trim()) {
        return NextResponse.json(
          { error: 'message must be a non-empty string' },
          { status: 400 }
        )
      }
      updateData.message = message.trim()
    }

    if (recipients !== undefined) {
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return NextResponse.json(
          { error: 'recipients must be a non-empty array of phone numbers' },
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
      
      updateData.recipients = normalizedRecipients
    }

    if (scheduledFor !== undefined) {
      const scheduledDate = new Date(scheduledFor)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: 'scheduledFor must be a valid date' },
          { status: 400 }
        )
      }

      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: 'scheduledFor must be in the future' },
          { status: 400 }
        )
      }

      updateData.scheduledFor = scheduledDate
    }

    if (status !== undefined) {
      if (!['pending', 'cancelled'].includes(status)) {
        return NextResponse.json(
          { error: 'status can only be set to pending or cancelled' },
          { status: 400 }
        )
      }
      updateData.status = status
    }

    const updatedMessage = await updateScheduledMessage(id, updateData)

    if (!updatedMessage) {
      return NextResponse.json(
        { error: 'Failed to update scheduled message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ...updatedMessage,
      recipients: JSON.parse(updatedMessage.recipients),
    })
  } catch (error) {
    console.error('Error updating scheduled message:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update scheduled message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const hard = searchParams.get('hard') === 'true'

    // Check if message exists
    const existingMessage = await getScheduledMessageById(id)
    if (!existingMessage) {
      return NextResponse.json(
        { error: 'Scheduled message not found' },
        { status: 404 }
      )
    }

    if (hard) {
      // Hard delete - remove from database
      const deleted = await deleteScheduledMessage(id)
      if (!deleted) {
        return NextResponse.json(
          { error: 'Failed to delete scheduled message' },
          { status: 500 }
        )
      }
    } else {
      // Soft delete - cancel the message
      if (existingMessage.status !== 'pending') {
        return NextResponse.json(
          { error: 'Can only cancel pending scheduled messages' },
          { status: 400 }
        )
      }

      const cancelled = await cancelScheduledMessage(id)
      if (!cancelled) {
        return NextResponse.json(
          { error: 'Failed to cancel scheduled message' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting scheduled message:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete scheduled message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
