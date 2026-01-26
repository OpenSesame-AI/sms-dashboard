import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { randomBytes } from 'crypto'
import { getOrCreateZendeskAuthConfig, initiateZendeskConnection } from '@/lib/composio'

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body to get subdomain
    const body = await request.json().catch(() => ({}))
    const subdomain = body.subdomain?.trim()
    
    if (!subdomain) {
      return NextResponse.json(
        { error: 'Zendesk subdomain is required. Please provide your subdomain (e.g., "your-company" from your-company.zendesk.com)' },
        { status: 400 }
      )
    }

    // Get or create Zendesk auth config
    const authConfigId = await getOrCreateZendeskAuthConfig()

    // Generate secure state parameter for callback verification
    const randomState = randomBytes(16).toString('base64')

    // Initiate Composio connection with subdomain
    const { connectionRequestId, redirectUrl } = await initiateZendeskConnection(
      userId,
      authConfigId,
      subdomain
    )

    // Store connection request ID in state for callback verification
    const stateWithRequestId = Buffer.from(
      JSON.stringify({
        userId,
        orgId: orgId || null,
        connectionRequestId,
        randomState,
      })
    ).toString('base64')

    return NextResponse.json({
      authUrl: redirectUrl,
      state: stateWithRequestId,
      connectionRequestId,
    })
  } catch (error) {
    console.error('Error initiating Zendesk connection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
