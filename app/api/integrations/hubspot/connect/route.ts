import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { randomBytes } from 'crypto'
import { getCellById, createIntegrationWithConnectionId, getIntegration, updateIntegration } from '@/lib/db/queries'
import { getOrCreateHubspotAuthConfig, initiateHubspotConnection } from '@/lib/composio'

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
    const { cellId, apiKey } = body

    if (!cellId) {
      return NextResponse.json(
        { error: 'cellId is required' },
        { status: 400 }
      )
    }

    // Verify user has access to the cell
    const cell = await getCellById(cellId, userId, orgId)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
        { status: 404 }
      )
    }

    // Get or create HubSpot auth config
    const authConfigId = await getOrCreateHubspotAuthConfig()

    // Generate secure state parameter for callback verification
    // State format: base64(cellId:randomBytes)
    const randomState = randomBytes(16).toString('base64')
    const state = Buffer.from(`${cellId}:${randomState}`).toString('base64')

    // Initiate Composio connection
    // Use userId as the user identifier for Composio
    // If apiKey is provided, use API Key authentication (immediate)
    const { connectionRequestId, redirectUrl, connectionRequest, immediate } = await initiateHubspotConnection(
      userId,
      authConfigId,
      apiKey
    )

    // Store connection request ID in state for callback verification
    // We'll encode it in the state parameter along with cellId
    const stateWithRequestId = Buffer.from(
      JSON.stringify({
        cellId,
        connectionRequestId,
        randomState,
      })
    ).toString('base64')

    // If immediate (API Key), create integration directly
    if (immediate && connectionRequestId) {
      // For API Key auth, the connection is already established
      // Create the integration record in the database
      try {
        const existingIntegration = await getIntegration(cellId, 'hubspot')
        
        if (existingIntegration) {
          // Update existing integration with connection ID
          await updateIntegration(existingIntegration.id, {
            connectionId: connectionRequestId,
            accessToken: null,
            refreshToken: null,
            instanceUrl: null,
          })
        } else {
          // Create new integration with connection ID
          await createIntegrationWithConnectionId(
            cellId,
            'hubspot',
            connectionRequestId
          )
        }
        
        return NextResponse.json({
          success: true,
          connectionId: connectionRequestId,
          immediate: true,
          message: 'HubSpot connected successfully via API Key',
        })
      } catch (error) {
        console.error('Error creating integration record for API Key connection:', error)
        // Still return success since connection is established in Composio
        // The status route will auto-link it
        return NextResponse.json({
          success: true,
          connectionId: connectionRequestId,
          immediate: true,
          message: 'HubSpot connected successfully via API Key',
          warning: 'Integration record creation failed, but connection is active',
        })
      }
    }

    // For OAuth, return redirect URL
    return NextResponse.json({
      authUrl: redirectUrl,
      state: stateWithRequestId, // Return state for callback verification
      connectionRequestId, // Also return for reference
      immediate: false,
    })
  } catch (error) {
    console.error('Error initiating HubSpot connection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
