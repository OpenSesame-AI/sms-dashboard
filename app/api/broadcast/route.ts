import { NextRequest, NextResponse } from 'next/server'
import { validatePhoneNumber, normalizePhoneNumber, formatWhatsAppNumber, getWhatsAppSandboxNumber, removeWhatsAppPrefix } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, to, from_number, channel = 'sms' } = body

    // Validate request body
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json(
        { error: 'Recipients (to) must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!from_number || typeof from_number !== 'string' || !from_number.trim()) {
      return NextResponse.json(
        { error: 'from_number is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Validate channel
    if (channel !== 'sms' && channel !== 'whatsapp') {
      return NextResponse.json(
        { error: 'Channel must be either "sms" or "whatsapp"' },
        { status: 400 }
      )
    }

    // For WhatsApp, validate phone numbers without the whatsapp: prefix
    const fromNumberToValidate = channel === 'whatsapp' 
      ? removeWhatsAppPrefix(from_number) 
      : from_number

    // Validate phone numbers
    if (!validatePhoneNumber(fromNumberToValidate)) {
      return NextResponse.json(
        { error: `Invalid from_number: ${from_number}` },
        { status: 400 }
      )
    }

    // Validate and normalize recipient phone numbers
    // Note: External API expects E.164 format and will handle whatsapp: prefix based on channel
    const normalizedRecipients: string[] = []
    for (const recipient of to) {
      if (typeof recipient !== 'string' || !recipient.trim()) {
        return NextResponse.json(
          { error: 'All recipients must be non-empty strings' },
          { status: 400 }
        )
      }
      
      // For WhatsApp, validate without the whatsapp: prefix
      const recipientToValidate = channel === 'whatsapp'
        ? removeWhatsAppPrefix(recipient)
        : recipient
      
      if (!validatePhoneNumber(recipientToValidate)) {
        return NextResponse.json(
          { error: `Invalid recipient phone number: ${recipient}` },
          { status: 400 }
        )
      }

      const normalized = normalizePhoneNumber(recipientToValidate)
      if (!normalized) {
        return NextResponse.json(
          { error: `Could not normalize phone number: ${recipient}` },
          { status: 400 }
        )
      }
      
      // Send in E.164 format - external API will add whatsapp: prefix based on channel parameter
      normalizedRecipients.push(normalized)
    }

    // Normalize from_number
    // For WhatsApp, always use Sandbox number (regular SMS numbers can't send WhatsApp)
    // For SMS, use the provided number
    let finalFromNumber: string
    if (channel === 'whatsapp') {
      // For WhatsApp, always use Sandbox number in E.164 format
      // Regular Twilio numbers can't send WhatsApp - need Sandbox or WhatsApp Business Account
      const sandboxNumber = getWhatsAppSandboxNumber()
      finalFromNumber = removeWhatsAppPrefix(sandboxNumber)
    } else {
      // For SMS, normalize and use the provided number
      const normalizedFromNumber = normalizePhoneNumber(from_number)
      if (!normalizedFromNumber) {
        return NextResponse.json(
          { error: `Could not normalize from_number: ${from_number}` },
          { status: 400 }
        )
      }
      finalFromNumber = normalizedFromNumber
    }

    // Get admin token from environment variable
    const adminToken = process.env.ADMIN_TOKEN
    if (!adminToken) {
      console.error('ADMIN_TOKEN environment variable is not set')
      return NextResponse.json(
        { error: 'Server configuration error: Admin token not configured' },
        { status: 500 }
      )
    }

    // Get API base URL from environment variable (default to empty if not set)
    // The external API endpoint is /api/v1/sms/broadcast
    const apiBaseUrl = process.env.SMS_API_BASE_URL || ''
    const broadcastUrl = apiBaseUrl 
      ? `${apiBaseUrl}/api/v1/sms/broadcast`
      : '/api/v1/sms/broadcast' // Fallback to relative URL if no base URL set

    // Forward request to external SMS API
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      },
      body: JSON.stringify({ 
        message: message.trim(), 
        to: normalizedRecipients, 
        from_number: finalFromNumber,
        channel: channel 
      }),
    })

    const responseData = await response.json().catch(() => ({}))
    
    if (!response.ok) {
      return NextResponse.json(
        { 
          ok: false,
          error: responseData.error || `${channel.toUpperCase()} broadcast failed with status ${response.status}` 
        },
        { status: response.status }
      )
    }

    return NextResponse.json({ 
      ok: true,
      ...responseData 
    })
  } catch (error) {
    console.error('Error in broadcast API route:', error)
    return NextResponse.json(
      { 
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to process broadcast request' 
      },
      { status: 500 }
    )
  }
}




