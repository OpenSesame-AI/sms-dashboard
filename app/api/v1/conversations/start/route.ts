import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-key-auth'
import { validatePhoneNumber, normalizePhoneNumber } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    // Validate API key authentication
    let authResult
    try {
      authResult = await validateApiKey(request)
    } catch (error) {
      return NextResponse.json(
        { 
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed' 
        },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { to, message } = body

    // Validate request body
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Message is required and must be a non-empty string' 
        },
        { status: 400 }
      )
    }

    if (!to || typeof to !== 'string' || !to.trim()) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Recipient phone number (to) is required and must be a non-empty string' 
        },
        { status: 400 }
      )
    }

    // Validate and normalize phone number
    const defaultCountry = 'US'
    if (!validatePhoneNumber(to, defaultCountry)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Invalid recipient phone number: ${to}` 
        },
        { status: 400 }
      )
    }

    const normalizedTo = normalizePhoneNumber(to, defaultCountry)
    if (!normalizedTo) {
      return NextResponse.json(
        { 
          success: false,
          error: `Could not normalize phone number: ${to}` 
        },
        { status: 400 }
      )
    }

    // Get admin token from environment variable
    const adminToken = process.env.ADMIN_TOKEN
    if (!adminToken) {
      console.error('ADMIN_TOKEN environment variable is not set')
      return NextResponse.json(
        { 
          success: false,
          error: 'Server configuration error: Admin token not configured' 
        },
        { status: 500 }
      )
    }

    // Get API base URL from environment variable
    const apiBaseUrl = process.env.SMS_API_BASE_URL || ''
    const broadcastUrl = apiBaseUrl 
      ? `${apiBaseUrl}/api/v1/sms/broadcast`
      : '/api/v1/sms/broadcast'

    // Call the broadcast endpoint internally
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      },
      body: JSON.stringify({ 
        message: message.trim(), 
        to: [normalizedTo], 
        from_number: authResult.cell.phoneNumber,
      }),
    })

    const responseData = await response.json().catch(() => ({}))
    
    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false,
          error: responseData.error || `Failed to start conversation: ${response.statusText}` 
        },
        { status: response.status }
      )
    }

    // Return standardized response
    return NextResponse.json({
      success: true,
      to: normalizedTo,
      from: authResult.cell.phoneNumber,
      message: message.trim(),
      ...(responseData.messageSid && { messageSid: responseData.messageSid }),
      ...(responseData.conversationId && { conversationId: responseData.conversationId }),
    })
  } catch (error) {
    console.error('Error in start conversation API route:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start conversation' 
      },
      { status: 500 }
    )
  }
}

