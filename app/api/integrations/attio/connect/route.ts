import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { randomBytes } from 'crypto'
import { getOrCreateAttioAuthConfig, initiateAttioConnection } from '@/lib/composio'

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get or create Attio auth config
    const authConfigId = await getOrCreateAttioAuthConfig()

    // Generate secure state parameter for callback verification
    const randomState = randomBytes(16).toString('base64')

    // Initiate Composio connection
    const { connectionRequestId, redirectUrl } = await initiateAttioConnection(
      userId,
      authConfigId
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
    console.error('Error initiating Attio connection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
