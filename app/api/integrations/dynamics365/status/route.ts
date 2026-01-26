import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getGlobalIntegration, getConnectionIdFromIntegration, createOrUpdateGlobalIntegrationWithConnectionId } from '@/lib/db/queries'
import { composio, getConnection, isConnectionStatusActive } from '@/lib/composio'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get global integration for this user/org
    let integration = await getGlobalIntegration(userId, orgId || null, 'dynamics365')
    
    if (!integration) {
      // No integration in database - check if Dynamics365 connection exists in Composio
      if (!composio) {
        return NextResponse.json({ connected: false })
      }
      
      try {
        // List user's connections from Composio
        const connectionsResponse = await composio.connectedAccounts.list({ userIds: [userId] })
        
        // Handle different possible response structures
        let connections: any[] = []
        if (Array.isArray(connectionsResponse)) {
          connections = connectionsResponse
        } else if (connectionsResponse && typeof connectionsResponse === 'object') {
          connections = (connectionsResponse as any).data || 
                       (connectionsResponse as any).items || 
                       (connectionsResponse as any).connections ||
                       (connectionsResponse as any).results ||
                       []
        }
        
        // Find Dynamics365 connections
        const dynamics365Connections = connections.filter((conn: any) => {
          // Check toolkit field (most reliable)
          if (conn.toolkit) {
            const toolkit = typeof conn.toolkit === 'string' ? conn.toolkit : conn.toolkit.name || conn.toolkit.id
            if (toolkit && toolkit.toUpperCase().includes('DYNAMICS365')) {
              return true
            }
          }
          
          // Check direct properties
          if (conn.appUniqueId === 'DYNAMICS365' || 
              conn.appName === 'DYNAMICS365' ||
              (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('dynamics365')) ||
              (conn.appName && conn.appName.toLowerCase().includes('dynamics365'))) {
            return true
          }
          
          // Check authConfig
          if (conn.authConfig) {
            const authConfig = conn.authConfig
            if (authConfig.appUniqueId === 'DYNAMICS365' ||
                authConfig.appName === 'DYNAMICS365' ||
                (authConfig.appUniqueId && authConfig.appUniqueId.toLowerCase().includes('dynamics365'))) {
              return true
            }
          }
          
          return false
        })
        
        if (dynamics365Connections.length === 0) {
          return NextResponse.json({ connected: false })
        }
        
        // Use the first active Dynamics365 connection
        const firstConnection = dynamics365Connections[0]
        const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
        const isActive = isConnectionStatusActive(connectionStatus)
        
        if (!isActive) {
          return NextResponse.json({ 
            connected: false,
            error: `Connection found but status is: ${connectionStatus}`,
          })
        }
        
        const connectionId = firstConnection.id
        if (!connectionId) {
          return NextResponse.json({ 
            connected: false,
            error: 'Connection found but missing connection ID',
          })
        }
        
        // Auto-create the global integration record
        console.log(`[Dynamics365 Status] Auto-linking Dynamics365 connection ${connectionId} for user ${userId}`)
        integration = await createOrUpdateGlobalIntegrationWithConnectionId(
          userId,
          orgId || null,
          'dynamics365',
          connectionId
        )
        
        return NextResponse.json({
          connected: true,
          connectedAt: integration.connectedAt?.toISOString(),
          syncedContactsCount: integration.syncedContactsCount || 0,
          autoLinked: true,
        })
      } catch (error) {
        console.error('[Dynamics365 Status] Error checking Composio connections:', error)
        return NextResponse.json({ connected: false })
      }
    }

    // Integration exists - verify it's still valid
    const connectionId = getConnectionIdFromIntegration(integration)
    
    if (!connectionId) {
      return NextResponse.json({
        connected: false,
        error: 'Legacy integration detected. Please reconnect.',
      })
    }

    // Verify connection is still active
    try {
      const connection = await getConnection(connectionId)
      const isActive = connection && isConnectionStatusActive(connection.status)
      
      if (!isActive) {
        return NextResponse.json({
          connected: false,
          error: 'Connection expired. Please reconnect.',
        })
      }
    } catch (error) {
      console.error('[Dynamics365 Status] Error verifying connection:', error)
      return NextResponse.json({
        connected: false,
        error: 'Failed to verify connection status.',
      })
    }

    return NextResponse.json({
      connected: true,
      connectedAt: integration.connectedAt?.toISOString(),
      syncedContactsCount: integration.syncedContactsCount || 0,
    })
  } catch (error) {
    console.error('Error checking Dynamics365 status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check connection status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
