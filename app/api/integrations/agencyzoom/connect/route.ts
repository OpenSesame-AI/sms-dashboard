import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOrCreateAgencyzoomAuthConfig, initiateAgencyzoomConnection } from '@/lib/composio'
import { createOrUpdateGlobalIntegrationWithConnectionId } from '@/lib/db/queries'

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get API key from request body
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Get or create AgencyZoom auth config
    const authConfigId = await getOrCreateAgencyzoomAuthConfig()

    // Initiate Composio connection with API Key (immediate, no redirect)
    const { connectionRequestId } = await initiateAgencyzoomConnection(
      userId,
      authConfigId,
      apiKey.trim()
    )

    // For API Key auth, the connection is immediate - store it in the database
    await createOrUpdateGlobalIntegrationWithConnectionId(
      userId,
      orgId || null,
      'agencyzoom',
      connectionRequestId
    )

    return NextResponse.json({
      success: true,
      immediate: true, // Flag to indicate immediate connection (no redirect)
      connectionId: connectionRequestId,
      message: 'Connected to AgencyZoom successfully',
    })
  } catch (error) {
    console.error('Error initiating AgencyZoom connection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to connect to AgencyZoom',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
