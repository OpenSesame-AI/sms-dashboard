import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { randomBytes } from 'crypto'
import { getOrCreateDynamics365AuthConfig, initiateDynamics365Connection } from '@/lib/composio'

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { organizationName } = body

    if (!organizationName || typeof organizationName !== 'string' || !organizationName.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required', details: 'Please provide your Dynamics 365 organization name (e.g., myorg from myorg.crm.dynamics.com)' },
        { status: 400 }
      )
    }

    // Get or create Dynamics365 auth config
    const authConfigId = await getOrCreateDynamics365AuthConfig()

    // Generate secure state parameter for callback verification
    const randomState = randomBytes(16).toString('base64')

    // Initiate Composio connection with organization name
    const { connectionRequestId, redirectUrl } = await initiateDynamics365Connection(
      userId,
      authConfigId,
      organizationName.trim()
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

    // Return redirect URL for OAuth flow
    return NextResponse.json({
      authUrl: redirectUrl,
      state: stateWithRequestId, // Return state for callback verification
      connectionRequestId, // Also return for reference
    })
  } catch (error) {
    console.error('Error initiating Dynamics365 connection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
