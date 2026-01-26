import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getGlobalIntegration, deleteGlobalIntegration, getConnectionIdFromIntegration } from '@/lib/db/queries'
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

    // Get global integration
    const integration = await getGlobalIntegration(userId, orgId || null, 'dynamics365')
    
    if (!integration) {
      return NextResponse.json(
        { error: 'Dynamics365 integration not found' },
        { status: 404 }
      )
    }

    // Get connection ID and revoke in Composio
    const connectionId = getConnectionIdFromIntegration(integration)
    
    if (connectionId) {
      try {
        await revokeConnection(connectionId)
        console.log(`[Dynamics365 Disconnect] Revoked Composio connection: ${connectionId}`)
      } catch (error) {
        // Log but don't fail - connection might already be revoked
        console.warn(`[Dynamics365 Disconnect] Failed to revoke Composio connection: ${connectionId}`, error)
      }
    }

    // Delete the integration record from database
    await deleteGlobalIntegration(userId, orgId || null, 'dynamics365')
    
    console.log(`[Dynamics365 Disconnect] Deleted integration for user: ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Disconnected from Dynamics365',
    })
  } catch (error) {
    console.error('Error disconnecting Dynamics365:', error)
    return NextResponse.json(
      { 
        error: 'Failed to disconnect',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
