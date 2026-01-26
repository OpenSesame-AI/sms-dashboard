import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createOrUpdateGlobalIntegrationWithConnectionId } from '@/lib/db/queries'
import { getConnection, isConnectionStatusActive } from '@/lib/composio'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      // Redirect to sign in if not authenticated
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }

    const searchParams = request.nextUrl.searchParams
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth error
    if (error) {
      console.error('Dynamics365 OAuth error:', { error, errorDescription })
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      )
    }

    // Parse state to get connection request ID
    if (!state) {
      console.error('Missing state parameter in Dynamics365 callback')
      return NextResponse.redirect(
        new URL('/integrations?error=Missing%20state%20parameter', request.url)
      )
    }

    let stateData: { userId?: string; orgId?: string | null; connectionRequestId?: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'))
    } catch (e) {
      console.error('Failed to parse state:', e)
      return NextResponse.redirect(
        new URL('/integrations?error=Invalid%20state%20parameter', request.url)
      )
    }

    const { connectionRequestId } = stateData

    if (!connectionRequestId) {
      console.error('Missing connectionRequestId in state')
      return NextResponse.redirect(
        new URL('/integrations?error=Missing%20connection%20request%20ID', request.url)
      )
    }

    // Verify the connection is active
    try {
      const connection = await getConnection(connectionRequestId)
      
      if (!connection) {
        console.error('Connection not found:', connectionRequestId)
        return NextResponse.redirect(
          new URL('/integrations?error=Connection%20not%20found', request.url)
        )
      }

      const isActive = isConnectionStatusActive(connection.status)
      
      if (!isActive) {
        console.error('Connection not active:', { connectionRequestId, status: connection.status })
        return NextResponse.redirect(
          new URL(`/integrations?error=Connection%20status%3A%20${connection.status || 'unknown'}`, request.url)
        )
      }

      // Create or update the global integration record
      await createOrUpdateGlobalIntegrationWithConnectionId(
        userId,
        orgId || null,
        'dynamics365',
        connectionRequestId
      )

      console.log('Dynamics365 integration created successfully:', {
        userId,
        orgId,
        connectionRequestId,
      })

      // Redirect to integrations page with success
      return NextResponse.redirect(
        new URL('/integrations?success=Dynamics365%20connected%20successfully', request.url)
      )
    } catch (error) {
      console.error('Error verifying Dynamics365 connection:', error)
      return NextResponse.redirect(
        new URL('/integrations?error=Failed%20to%20verify%20connection', request.url)
      )
    }
  } catch (error) {
    console.error('Error in Dynamics365 callback:', error)
    return NextResponse.redirect(
      new URL('/integrations?error=Callback%20failed', request.url)
    )
  }
}
