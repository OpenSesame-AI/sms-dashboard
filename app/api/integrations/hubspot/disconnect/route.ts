import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { deleteIntegration, getCellById, getIntegration, getConnectionIdFromIntegration } from '@/lib/db/queries'
import { revokeConnection } from '@/lib/composio'

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

    // Get integration to check if it's a Composio connection
    const integration = await getIntegration(cellId, 'hubspot')
    
    if (integration) {
      // Check if this is a Composio integration
      const connectionId = getConnectionIdFromIntegration(integration)
      
      if (connectionId) {
        try {
          // Revoke connection in Composio
          await revokeConnection(connectionId)
        } catch (error) {
          // Log error but continue with database deletion
          // Connection might already be revoked or invalid
          console.error('Error revoking Composio connection:', error)
        }
      }
      // Note: For legacy token-based integrations, we just delete from database
      // The token will naturally expire
    }

    // Delete integration record from database
    await deleteIntegration(cellId, 'hubspot')

    return NextResponse.json({
      success: true,
      message: 'Disconnected from HubSpot',
    })
  } catch (error) {
    console.error('Error disconnecting from HubSpot:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
