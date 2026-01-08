import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getIntegration, getCellById, getConnectionIdFromIntegration } from '@/lib/db/queries'
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

    const { searchParams } = new URL(request.url)
    const cellId = searchParams.get('cellId')

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

    // Get integration from database
    const integration = await getIntegration(cellId, 'salesforce')
    
    console.log(`[Salesforce Status] Integration lookup for cellId: ${cellId}`, {
      integrationExists: !!integration,
      integrationId: integration?.id,
      hasMetadata: !!integration?.metadata,
      metadata: integration?.metadata,
    })
    
    if (!integration) {
      console.warn(`[Salesforce Status] No integration found in database for cellId: ${cellId}`, {
        cellId,
        userId,
        orgId: orgId || null,
      })
      
      // Try to find connection in Composio directly by listing user's connections
      // This helps if the integration wasn't saved to DB but connection exists in Composio
      try {
        if (composio) {
          // Composio SDK expects an object with userIds (plural), not userId
          const connectionsResponse = await composio.connectedAccounts.list({ userIds: [userId] })
          
          // Log the response structure to understand what we're getting
          console.log(`[Salesforce Status] Composio list response type:`, {
            type: typeof connectionsResponse,
            isArray: Array.isArray(connectionsResponse),
            keys: connectionsResponse && typeof connectionsResponse === 'object' ? Object.keys(connectionsResponse) : [],
            response: JSON.stringify(connectionsResponse).substring(0, 500),
          })
          
          // Handle different possible response structures
          // The SDK might return an array directly, or an object with a data/items property
          let connections: any[] = []
          if (Array.isArray(connectionsResponse)) {
            connections = connectionsResponse
          } else if (connectionsResponse && typeof connectionsResponse === 'object') {
            // Try common property names
            connections = (connectionsResponse as any).data || 
                         (connectionsResponse as any).items || 
                         (connectionsResponse as any).connections ||
                         (connectionsResponse as any).results ||
                         []
          }
          
          // Log first connection structure to understand the format
          if (connections.length > 0) {
            console.log(`[Salesforce Status] Sample connection structure:`, {
              firstConnection: JSON.stringify(connections[0], null, 2).substring(0, 1000),
              connectionKeys: Object.keys(connections[0] || {}),
              hasAppUniqueId: 'appUniqueId' in (connections[0] || {}),
              hasAppName: 'appName' in (connections[0] || {}),
              hasAuthConfig: 'authConfig' in (connections[0] || {}),
              hasData: 'data' in (connections[0] || {}),
            })
          }
          
          // Check for Salesforce connections - try multiple ways to identify them
          const salesforceConnections = connections.filter((conn: any) => {
            // Check toolkit field (most reliable)
            if (conn.toolkit) {
              const toolkit = typeof conn.toolkit === 'string' ? conn.toolkit : conn.toolkit.name || conn.toolkit.id
              if (toolkit && toolkit.toUpperCase().includes('SALESFORCE')) {
                return true
              }
            }
            
            // Check direct properties
            if (conn.appUniqueId === 'SALESFORCE' || 
                conn.appName === 'SALESFORCE' ||
                (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('salesforce')) ||
                (conn.appName && conn.appName.toLowerCase().includes('salesforce'))) {
              return true
            }
            
            // Check authConfig for app identifier
            if (conn.authConfig) {
              const authConfig = conn.authConfig
              if (authConfig.appUniqueId === 'SALESFORCE' ||
                  authConfig.appName === 'SALESFORCE' ||
                  (authConfig.appUniqueId && authConfig.appUniqueId.toLowerCase().includes('salesforce'))) {
                return true
              }
            }
            
            // Check data.status for ACTIVE Salesforce connections
            // If it has status ACTIVE and subdomain (Salesforce-specific), it's likely Salesforce
            if (conn.data && conn.data.status === 'ACTIVE' && conn.data.subdomain) {
              // Salesforce connections typically have 'login' subdomain
              if (conn.data.subdomain === 'login' || conn.data.subdomain.includes('salesforce')) {
                return true
              }
            }
            
            return false
          })
          
          console.log(`[Salesforce Status] Found ${salesforceConnections.length} Salesforce connections in Composio for userId: ${userId}`, {
            totalConnections: connections.length,
            salesforceConnections: salesforceConnections.map((c: any) => ({
              id: c.id,
              status: c.data?.status || c.status,
              appName: c.appName || c.authConfig?.appName,
              appUniqueId: c.appUniqueId || c.authConfig?.appUniqueId,
              subdomain: c.data?.subdomain,
            })),
          })
          
          if (salesforceConnections.length > 0) {
            // Found connections in Composio but not in DB
            // Check the status of the first Salesforce connection
            const firstConnection = salesforceConnections[0]
            const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
            const isActive = isConnectionStatusActive(connectionStatus)
            
            console.log(`[Salesforce Status] Salesforce connection found in Composio but not linked to cell`, {
              connectionId: firstConnection.id,
              status: connectionStatus,
              isActive,
              cellId,
            })
            
            // If connection is active, we can still report it as connected
            // even though it's not in the database (user needs to link it)
            return NextResponse.json({
              connected: isActive, // Show as connected if active, but note it needs linking
              syncedContactsCount: 0,
              connectionId: firstConnection.id,
              connectionStatus: connectionStatus,
              error: isActive 
                ? 'Salesforce connection exists in Composio but is not linked to this cell in the database'
                : `Salesforce connection found but status is: ${connectionStatus}`,
              composioConnectionsFound: salesforceConnections.length,
              suggestion: 'Please reconnect Salesforce integration through the UI to link it to this cell',
              needsLinking: true, // Flag to indicate connection exists but needs database entry
            })
          }
        }
      } catch (composioError) {
        console.error('[Salesforce Status] Error checking Composio connections:', {
          error: composioError instanceof Error ? composioError.message : String(composioError),
          errorType: composioError instanceof Error ? composioError.constructor.name : typeof composioError,
        })
      }
      
      return NextResponse.json({
        connected: false,
        syncedContactsCount: 0,
        error: 'No Salesforce integration found for this cell',
      })
    }

    // Check if this is a Composio integration (has connectionId in metadata)
    const connectionId = getConnectionIdFromIntegration(integration)
    
    console.log(`[Salesforce Status] Connection ID extraction for integration ${integration.id}:`, {
      hasMetadata: !!integration.metadata,
      metadata: integration.metadata,
      connectionId,
      integrationType: connectionId ? 'Composio' : 'Legacy',
    })
    
    if (connectionId) {
      // Always try to fetch the connection object directly to check its actual status
      try {
        const connection = await getConnection(connectionId)
        
        // Log the full connection object to understand its structure
        console.log(`[Salesforce Status] Raw connection object for ${connectionId}:`, {
          connection: JSON.stringify(connection, null, 2),
          connectionType: typeof connection,
          hasStatus: 'status' in (connection || {}),
          connectionKeys: connection ? Object.keys(connection) : [],
        })
        
        // Check if connection exists
        if (!connection) {
          // Connection doesn't exist
          console.error(`[Salesforce Status] Connection ${connectionId} not found for cellId: ${cellId}`)
          return NextResponse.json({
            connected: false,
            syncedContactsCount: integration.syncedContactsCount || 0,
            error: 'Connection not found',
            connectionStatus: null,
          })
        }

        // Extract status - handle different possible structures
        // The connection might have status directly, or it might be nested
        const connectionStatus = connection.status || 
                                 (connection as any)?.data?.status || 
                                 (connection as any)?.state ||
                                 (connection as any)?.connectionStatus ||
                                 null
        
        // If status is missing but connection exists, log warning but consider it might be active
        // (Some Composio SDK versions might not expose status directly)
        if (!connectionStatus) {
          console.warn(`[Salesforce Status] Connection ${connectionId} exists but status field is missing`, {
            cellId,
            connectionId,
            connectionKeys: Object.keys(connection),
            connectionPreview: JSON.stringify(connection).substring(0, 500),
          })
        }
        
        // Check if connection has an active status
        // Use helper function to check if status indicates an active connection
        // If status is null/undefined but connection exists, we'll check if it's usable
        const isActive = connectionStatus 
          ? isConnectionStatusActive(connectionStatus)
          : true // If no status field, assume active if connection exists (fallback)

        if (!isActive) {
          // Connection exists but is not active
          console.warn(`[Salesforce Status] Connection ${connectionId} exists but has inactive status: ${connectionStatus}`, {
            cellId,
            connectionId,
            status: connectionStatus,
            fullConnection: connection,
            connectionData: {
              id: (connection as any)?.id,
              appName: (connection as any)?.appName,
              appUniqueId: (connection as any)?.appUniqueId,
              status: connectionStatus,
            },
          })
          return NextResponse.json({
            connected: false,
            syncedContactsCount: integration.syncedContactsCount || 0,
            error: `Connection status: ${connectionStatus}`,
            connectionStatus: connectionStatus,
            debug: {
              rawStatus: connection.status,
              extractedStatus: connectionStatus,
            },
          })
        }

        // Connection is active
        console.log(`[Salesforce Status] Connection ${connectionId} is active for cellId: ${cellId}`, {
          status: connectionStatus,
          syncedContactsCount: integration.syncedContactsCount || 0,
          connectionId: (connection as any)?.id,
        })
        
        return NextResponse.json({
          connected: true,
          connectedAt: integration.connectedAt?.toISOString(),
          lastSyncedAt: integration.lastSyncedAt?.toISOString(),
          syncedContactsCount: integration.syncedContactsCount || 0,
          connectionId,
          connectionStatus: connectionStatus,
        })
      } catch (error) {
        // Log detailed error information for debugging
        const errorDetails = {
          cellId,
          connectionId,
          userId,
          orgId: orgId || null,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
        
        console.error('[Salesforce Status] Error fetching connection from Composio:', errorDetails)
        
        // Connection might be invalid or there was an API error
        return NextResponse.json({
          connected: false,
          syncedContactsCount: integration.syncedContactsCount || 0,
          error: error instanceof Error ? error.message : 'Failed to verify connection',
          connectionStatus: null,
        })
      }
    } else {
      // Legacy integration (token-based) - check if tokens exist
      const hasTokens = integration.accessToken && integration.refreshToken
      
      return NextResponse.json({
        connected: hasTokens ? true : false,
        connectedAt: integration.connectedAt?.toISOString(),
        lastSyncedAt: integration.lastSyncedAt?.toISOString(),
        syncedContactsCount: integration.syncedContactsCount || 0,
        legacy: true, // Indicate this is a legacy token-based integration
      })
    }
  } catch (error) {
    // Log top-level errors with full context
    const errorDetails = {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cellId: request.nextUrl.searchParams.get('cellId') || 'unknown',
    }
    
    console.error('[Salesforce Status] Unexpected error in status route:', errorDetails)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch connection status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
