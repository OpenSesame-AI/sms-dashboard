import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createOrUpdateGlobalIntegrationWithConnectionId } from '@/lib/db/queries'
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
        new URL(`/?error=zoho_bigin_oauth_error&error_description=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!state) {
      return NextResponse.redirect(
        new URL('/?error=missing_state', request.url)
      )
    }

    // Decode state to get userId, orgId, and connectionRequestId
    let connectionRequestId: string
    let stateUserId: string
    let stateOrgId: string | null
    try {
      const decodedState = Buffer.from(state, 'base64').toString('utf-8')
      const stateData = JSON.parse(decodedState)
      stateUserId = stateData.userId
      stateOrgId = stateData.orgId || null
      connectionRequestId = stateData.connectionRequestId
      
      // Verify state matches current user
      if (stateUserId !== userId || stateOrgId !== (orgId || null)) {
        return NextResponse.redirect(
          new URL('/?error=state_mismatch', request.url)
        )
      }
    } catch (err) {
      return NextResponse.redirect(
        new URL('/?error=invalid_state_format', request.url)
      )
    }

    // Wait for Composio connection to complete
    let connectionId: string
    try {
      if (!composio) {
        throw new Error('Composio client not initialized')
      }
      
      // Try to get the connection by ID first
      try {
        const connection = await composio.connectedAccounts.get(connectionRequestId)
        if (connection && connection.status === 'ACTIVE') {
          connectionId = connection.id
        } else {
          throw new Error('Connection not active yet')
        }
      } catch {
        // If that doesn't work, list user's connections and find the Zoho Bigin one
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
        
        const zohoBiginConnection = connections.find((conn: any) => {
          // Check toolkit field
          if (conn.toolkit) {
            const toolkit = typeof conn.toolkit === 'string' ? conn.toolkit : conn.toolkit.name || conn.toolkit.id
            if (toolkit && (toolkit.toUpperCase().includes('ZOHO_BIGIN') || toolkit.toUpperCase() === 'ZOHO-BIGIN')) {
              return true
            }
          }
          // Check direct properties
          return conn.appUniqueId === 'ZOHO_BIGIN' || 
                 conn.appName === 'ZOHO_BIGIN' ||
                 (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('zoho_bigin')) ||
                 (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('zoho-bigin')) ||
                 (conn.appName && conn.appName.toLowerCase().includes('zoho_bigin')) ||
                 (conn.appName && conn.appName.toLowerCase().includes('zoho-bigin'))
        })
        
        if (!zohoBiginConnection) {
          throw new Error('Zoho Bigin connection not found. Please try connecting again.')
        }
        
        connectionId = zohoBiginConnection.id
      }
    } catch (err) {
      console.error('Error getting connection:', err)
      return NextResponse.redirect(
        new URL(`/?error=connection_failed&details=${encodeURIComponent(err instanceof Error ? err.message : 'Failed to get connection')}`, request.url)
      )
    }

    // Create or update global integration with connection ID
    await createOrUpdateGlobalIntegrationWithConnectionId(
      userId,
      orgId || null,
      'zoho_bigin',
      connectionId
    )

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/?zoho_bigin_connected=true', request.url)
    )
  } catch (error) {
    console.error('Error in Zoho Bigin OAuth callback:', error)
    return NextResponse.redirect(
      new URL(`/?error=callback_error&details=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url)
    )
  }
}
