import { NextRequest, NextResponse } from 'next/server'
import { getDueScheduledMessages, updateScheduledMessage } from '@/lib/db/queries'

// This endpoint is called by Vercel Cron every minute
// It processes all pending scheduled messages that are due to be sent

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require CRON_SECRET for security
    // Allow local development without it
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('Unauthorized cron request')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    console.log('[Cron] Starting scheduled message processing...')

    // Get all pending messages that are due
    const dueMessages = await getDueScheduledMessages()

    if (dueMessages.length === 0) {
      console.log('[Cron] No messages due for sending')
      return NextResponse.json({ 
        success: true, 
        processed: 0,
        message: 'No messages due for sending' 
      })
    }

    console.log(`[Cron] Found ${dueMessages.length} messages to send`)

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as { id: string; error: string }[],
    }

    // Get admin token and API base URL for broadcast
    const adminToken = process.env.ADMIN_TOKEN
    const apiBaseUrl = process.env.SMS_API_BASE_URL || ''

    if (!adminToken) {
      console.error('[Cron] ADMIN_TOKEN not configured')
      return NextResponse.json(
        { error: 'Server configuration error: Admin token not configured' },
        { status: 500 }
      )
    }

    // Process each due message
    for (const scheduledMessage of dueMessages) {
      results.processed++

      try {
        const recipients = JSON.parse(scheduledMessage.recipients) as string[]

        // Call the broadcast API to send the message
        const broadcastUrl = apiBaseUrl 
          ? `${apiBaseUrl}/api/v1/sms/broadcast`
          : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/broadcast`

        const response = await fetch(broadcastUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': adminToken,
          },
          body: JSON.stringify({
            message: scheduledMessage.message,
            to: recipients,
            from_number: scheduledMessage.cellPhoneNumber,
          }),
        })

        const responseData = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(responseData.error || `Broadcast failed with status ${response.status}`)
        }

        // Mark message as sent
        await updateScheduledMessage(scheduledMessage.id, {
          status: 'sent',
          sentAt: new Date(),
        })

        results.sent++
        console.log(`[Cron] Successfully sent scheduled message ${scheduledMessage.id} to ${recipients.length} recipients`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Mark message as failed
        await updateScheduledMessage(scheduledMessage.id, {
          status: 'failed',
          error: errorMessage,
        })

        results.failed++
        results.errors.push({ id: scheduledMessage.id, error: errorMessage })
        console.error(`[Cron] Failed to send scheduled message ${scheduledMessage.id}:`, errorMessage)
      }
    }

    console.log(`[Cron] Completed processing. Sent: ${results.sent}, Failed: ${results.failed}`)

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('[Cron] Error processing scheduled messages:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process scheduled messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support GET for manual triggering and health checks
export async function GET(request: NextRequest) {
  // For GET requests, just return info about pending messages
  try {
    const dueMessages = await getDueScheduledMessages()
    
    return NextResponse.json({
      pendingCount: dueMessages.length,
      messages: dueMessages.map(m => ({
        id: m.id,
        scheduledFor: m.scheduledFor,
        recipientCount: JSON.parse(m.recipients).length,
      })),
    })
  } catch (error) {
    console.error('[Cron] Error checking scheduled messages:', error)
    return NextResponse.json(
      { error: 'Failed to check scheduled messages' },
      { status: 500 }
    )
  }
}
