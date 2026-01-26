import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { deleteGlobalIntegration, getGlobalIntegration, getConnectionIdFromIntegration } from '@/lib/db/queries'
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

    // Get global integration to check if it's a Composio connection
    const integration = await getGlobalIntegration(userId, orgId || null, 'agencyzoom')
    
    if (integration) {
      // Check if this is a Composio integration
      const connectionId = getConnectionIdFromIntegration(integration)
      
      if (connectionId) {
        try {
          // Revoke connection in Composio
          await revokeConnection(connectionId)
        } catch (error) {
          // Log error but continue with database deletion
          console.error('Error revoking Composio connection:', error)
        }
      }
    }

    // Delete global integration record from database
    await deleteGlobalIntegration(userId, orgId || null, 'agencyzoom')

    return NextResponse.json({
      success: true,
      message: 'Disconnected from AgencyZoom',
    })
  } catch (error) {
    console.error('Error disconnecting from AgencyZoom:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
