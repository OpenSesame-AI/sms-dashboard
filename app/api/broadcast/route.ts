import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, to, from_number } = body

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
      body: JSON.stringify({ message: message.trim(), to, from_number: from_number.trim() }),
    })

    const responseData = await response.json().catch(() => ({}))
    
    if (!response.ok) {
      return NextResponse.json(
        { 
          ok: false,
          error: responseData.error || `Broadcast failed with status ${response.status}` 
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




