import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCellById, createIntegrationWithConnectionId, getIntegration, updateIntegration } from '@/lib/db/queries'
import { composio } from '@/lib/composio'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      // Redirect to home with error
      return NextResponse.redirect(
        new URL('/?error=unauthorized', request.url)
      )
    }

    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth error
    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=hubspot_oauth_error&error_description=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!state) {
      return NextResponse.redirect(
        new URL('/?error=missing_state', request.url)
      )
    }

    // Decode state to get cellId and connectionRequestId
    let cellId: string
    let connectionRequestId: string
    try {
      const decodedState = Buffer.from(state, 'base64').toString('utf-8')
      const stateData = JSON.parse(decodedState)
      cellId = stateData.cellId
      connectionRequestId = stateData.connectionRequestId
    } catch (err) {
      // Fallback to old format for backward compatibility
      try {
        const decodedState = Buffer.from(state, 'base64').toString('utf-8')
        const [decodedCellId] = decodedState.split(':')
        cellId = decodedCellId
        // If no connectionRequestId, we can't proceed with Composio flow
        return NextResponse.redirect(
          new URL('/?error=invalid_state_format', request.url)
        )
      } catch (parseErr) {
        return NextResponse.redirect(
          new URL('/?error=invalid_state', request.url)
        )
      }
    }

    // Verify user has access to the cell
    const cell = await getCellById(cellId, userId, orgId)
    if (!cell) {
      return NextResponse.redirect(
        new URL('/?error=cell_not_found', request.url)
      )
    }

    // Wait for Composio connection to complete
    // Note: In a production app, you might want to store the connectionRequest object
    // in a database or session to avoid re-initiating. For now, we'll try to get
    // the connection by checking the user's connections.
    let connectionId: string
    try {
      if (!composio) {
        throw new Error('Composio client not initialized')
      }
      
      // Try to get the connection by ID first
      // Note: By the time we're in the callback, the connection should already be established
      // The connectionRequestId might actually be the connectionId at this point
      try {
        const connection = await composio.connectedAccounts.get(connectionRequestId)
        // If we can get it and it has an active status, use it
        if (connection && connection.status === 'ACTIVE') {
          connectionId = connection.id
        } else {
          throw new Error('Connection not active yet')
        }
      } catch {
        // If that doesn't work, list user's connections and find the HubSpot one
        // This assumes the connection was just created
        // Composio SDK expects an object with userIds (plural), not userId
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
        
        const hubspotConnection = connections.find((conn: any) => {
          // Check toolkit field (most reliable)
          if (conn.toolkit) {
            const toolkit = typeof conn.toolkit === 'string' ? conn.toolkit : conn.toolkit.name || conn.toolkit.id
            if (toolkit && toolkit.toUpperCase().includes('HUBSPOT')) {
              return true
            }
          }
          
          // Check direct properties
          if (conn.appUniqueId === 'HUBSPOT' || 
              conn.appName === 'HUBSPOT' ||
              (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('hubspot')) ||
              (conn.appName && conn.appName.toLowerCase().includes('hubspot'))) {
            return true
          }
          
          // Check authConfig
          if (conn.authConfig) {
            const authConfig = conn.authConfig
            if (authConfig.appUniqueId === 'HUBSPOT' ||
                authConfig.appName === 'HUBSPOT' ||
                (authConfig.appUniqueId && authConfig.appUniqueId.toLowerCase().includes('hubspot'))) {
              return true
            }
          }
          
          return false
        })
        
        if (!hubspotConnection) {
          throw new Error('HubSpot connection not found. Please try connecting again.')
        }
        
        connectionId = hubspotConnection.id
      }
    } catch (err) {
      console.error('Error getting connection:', err)
      return NextResponse.redirect(
        new URL(`/?error=connection_failed&details=${encodeURIComponent(err instanceof Error ? err.message : 'Failed to get connection')}`, request.url)
      )
    }

    // Check if integration already exists
    const existingIntegration = await getIntegration(cellId, 'hubspot')
    
    if (existingIntegration) {
      // Update existing integration with connection ID
      await updateIntegration(existingIntegration.id, {
        connectionId,
        accessToken: null, // Clear old tokens
        refreshToken: null,
        instanceUrl: null,
      })
    } else {
      // Create new integration with connection ID
      await createIntegrationWithConnectionId(
        cellId,
        'hubspot',
        connectionId
      )
    }

    // Redirect to success page (or back to integrations dialog)
    return NextResponse.redirect(
      new URL(`/?hubspot_connected=true&cellId=${cellId}`, request.url)
    )
  } catch (error) {
    console.error('Error in HubSpot OAuth callback:', error)
    return NextResponse.redirect(
      new URL(`/?error=callback_error&details=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url)
    )
  }
}
