import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getGlobalIntegration, getConnectionIdFromIntegration } from '@/lib/db/queries'
import { getConnection, isConnectionStatusActive, composio } from '@/lib/composio'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get global integration from database
    const integration = await getGlobalIntegration(userId, orgId || null, 'agencyzoom')
    
    if (!integration) {
      // Try to find connection in Composio directly
      try {
        if (composio) {
          const connectionsResponse = await composio.connectedAccounts.list({ userIds: [userId] })
          
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
          
          // Check for AgencyZoom connections
          const agencyzoomConnections = connections.filter((conn: any) => {
            // Check toolkit field
            if (conn.toolkit) {
              const toolkit = typeof conn.toolkit === 'string' ? conn.toolkit : conn.toolkit.name || conn.toolkit.id
              if (toolkit && toolkit.toUpperCase().includes('AGENCYZOOM')) {
                return true
              }
            }
            
            // Check direct properties
            if (conn.appUniqueId === 'AGENCYZOOM' || 
                conn.appName === 'AGENCYZOOM' ||
                (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('agencyzoom')) ||
                (conn.appName && conn.appName.toLowerCase().includes('agencyzoom'))) {
              return true
            }
            
            // Check authConfig
            if (conn.authConfig) {
              const authConfig = conn.authConfig
              if (authConfig.appUniqueId === 'AGENCYZOOM' ||
                  authConfig.appName === 'AGENCYZOOM' ||
                  (authConfig.appUniqueId && authConfig.appUniqueId.toLowerCase().includes('agencyzoom'))) {
                return true
              }
            }
            
            return false
          })
          
          if (agencyzoomConnections.length > 0) {
            const firstConnection = agencyzoomConnections[0]
            const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
            const isActive = isConnectionStatusActive(connectionStatus)
            
            return NextResponse.json({
              connected: isActive,
              syncedContactsCount: 0,
              connectionId: firstConnection.id,
              connectionStatus: connectionStatus,
              needsLinking: true,
            })
          }
        }
      } catch (composioError) {
        console.error('[AgencyZoom Status] Error checking Composio connections:', composioError)
      }
      
      return NextResponse.json({
        connected: false,
        syncedContactsCount: 0,
      })
    }

    // Check if this is a Composio integration
    const connectionId = getConnectionIdFromIntegration(integration)
    
    if (connectionId) {
      try {
        const connection = await getConnection(connectionId)
        
        if (!connection) {
          return NextResponse.json({
            connected: false,
            syncedContactsCount: integration.syncedContactsCount || 0,
            error: 'Connection not found',
          })
        }

        const connectionStatus = connection.status || 
                                 (connection as any)?.data?.status || 
                                 null
        
        const isActive = connectionStatus 
          ? isConnectionStatusActive(connectionStatus)
          : true

        if (!isActive) {
          return NextResponse.json({
            connected: false,
            syncedContactsCount: integration.syncedContactsCount || 0,
            error: `Connection status: ${connectionStatus}`,
            connectionStatus: connectionStatus,
          })
        }

        return NextResponse.json({
          connected: true,
          connectedAt: integration.connectedAt?.toISOString(),
          lastSyncedAt: integration.lastSyncedAt?.toISOString(),
          syncedContactsCount: integration.syncedContactsCount || 0,
          connectionId,
          connectionStatus: connectionStatus,
        })
      } catch (error) {
        console.error('[AgencyZoom Status] Error fetching connection:', error)
        return NextResponse.json({
          connected: false,
          syncedContactsCount: integration.syncedContactsCount || 0,
          error: error instanceof Error ? error.message : 'Failed to verify connection',
        })
      }
    } else {
      // Legacy integration
      const hasTokens = integration.accessToken && integration.refreshToken
      
      return NextResponse.json({
        connected: hasTokens ? true : false,
        connectedAt: integration.connectedAt?.toISOString(),
        lastSyncedAt: integration.lastSyncedAt?.toISOString(),
        syncedContactsCount: integration.syncedContactsCount || 0,
        legacy: true,
      })
    }
  } catch (error) {
    console.error('[AgencyZoom Status] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch connection status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
