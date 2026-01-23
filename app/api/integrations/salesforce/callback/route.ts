import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createOrUpdateGlobalIntegrationWithConnectionId, getGlobalIntegration } from '@/lib/db/queries'
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
        new URL(`/?error=salesforce_oauth_error&error_description=${encodeURIComponent(error)}`, request.url)
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
      // Fallback to old format for backward compatibility (legacy per-cell integrations)
      return NextResponse.redirect(
        new URL('/?error=invalid_state_format', request.url)
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
        // If that doesn't work, list user's connections and find the Salesforce one
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
        
        const salesforceConnection = connections.find((conn: any) => 
          conn.appUniqueId === 'SALESFORCE' || conn.appName === 'SALESFORCE'
        )
        
        if (!salesforceConnection) {
          throw new Error('Salesforce connection not found. Please try connecting again.')
        }
        
        connectionId = salesforceConnection.id
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
      'salesforce',
      connectionId
    )

    // Redirect to success page (or back to integrations page)
    return NextResponse.redirect(
      new URL('/?salesforce_connected=true', request.url)
    )
  } catch (error) {
    console.error('Error in Salesforce OAuth callback:', error)
    return NextResponse.redirect(
      new URL(`/?error=callback_error&details=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`, request.url)
    )
  }
}
