import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { randomBytes } from 'crypto'
import { getCellById } from '@/lib/db/queries'
import { getOrCreateSalesforceAuthConfig, initiateSalesforceConnection } from '@/lib/composio'

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
    const { cellId } = body

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

    // Get or create Salesforce auth config
    const authConfigId = await getOrCreateSalesforceAuthConfig()

    // Generate secure state parameter for callback verification
    // State format: base64(cellId:randomBytes)
    const randomState = randomBytes(16).toString('base64')
    const state = Buffer.from(`${cellId}:${randomState}`).toString('base64')

    // Initiate Composio connection
    // Use userId as the user identifier for Composio
    const { connectionRequestId, redirectUrl, connectionRequest } = await initiateSalesforceConnection(
      userId,
      authConfigId
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

    // Note: We need to store the connectionRequest object somewhere accessible
    // For now, we'll pass the connectionRequestId and retrieve it in callback
    // In production, you might want to store this in a database or session

    return NextResponse.json({
      authUrl: redirectUrl,
      state: stateWithRequestId, // Return state for callback verification
      connectionRequestId, // Also return for reference
    })
  } catch (error) {
    console.error('Error initiating Salesforce connection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
