import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCellById, getIntegration, updateIntegration, getConnectionIdFromIntegration, createIntegrationWithConnectionId, getGlobalIntegration, getAllCells } from '@/lib/db/queries'
import { fetchLeads, extractPhoneNumbers } from '@/lib/dynamics365'
import { composio, isConnectionStatusActive } from '@/lib/composio'
import { db } from '@/lib/db/index'
import { phoneUserMappings, dynamics365Contacts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { normalizePhoneNumber, getCellCountry } from '@/lib/utils'

export async function POST(request: NextRequest) {
  let cellId: string | undefined
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    cellId = body.cellId
    
    console.log(`[Dynamics365 Sync] Starting sync for user: ${userId}, cellId: ${cellId || 'all cells'}`)

    // Get the global integration
    const globalIntegration = await getGlobalIntegration(userId, orgId || null, 'dynamics365')
    let connectionId: string | null = null

    if (!globalIntegration) {
      // No integration in database - check if Dynamics365 connection exists in Composio
      console.log(`[Dynamics365 Sync] No integration found in database, checking Composio for connections...`)
      
      if (!composio) {
        return NextResponse.json(
          { error: 'Composio client not initialized' },
          { status: 500 }
        )
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
          if (conn.toolkit) {
            const toolkit = typeof conn.toolkit === 'string' ? conn.toolkit : conn.toolkit.name || conn.toolkit.id
            if (toolkit && toolkit.toUpperCase().includes('DYNAMICS365')) {
              return true
            }
          }
          
          if (conn.appUniqueId === 'DYNAMICS365' || 
              conn.appName === 'DYNAMICS365' ||
              (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('dynamics365')) ||
              (conn.appName && conn.appName.toLowerCase().includes('dynamics365'))) {
            return true
          }
          
          return false
        })
        
        if (dynamics365Connections.length === 0) {
          return NextResponse.json(
            { error: 'Dynamics365 integration not connected. Please connect Dynamics365 first.' },
            { status: 400 }
          )
        }
        
        // Use the first active Dynamics365 connection
        const firstConnection = dynamics365Connections[0]
        const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
        const isActive = isConnectionStatusActive(connectionStatus)
        
        if (!isActive) {
          return NextResponse.json(
            { error: `Dynamics365 connection found but status is: ${connectionStatus}. Please reconnect.` },
            { status: 400 }
          )
        }
        
        connectionId = firstConnection.id
        if (!connectionId) {
          return NextResponse.json(
            { error: 'Dynamics365 connection found but missing connection ID' },
            { status: 400 }
          )
        }
      } catch (error) {
        console.error('[Dynamics365 Sync] Error checking Composio connections:', error)
        return NextResponse.json(
          { error: 'Failed to check Dynamics365 connection. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      // Global integration exists - get connection ID
      connectionId = getConnectionIdFromIntegration(globalIntegration)
      
      if (!connectionId) {
        return NextResponse.json(
          { error: 'Legacy integration detected. Please reconnect using Composio.' },
          { status: 400 }
        )
      }
    }
    
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Dynamics365 connection ID not found' },
        { status: 400 }
      )
    }

    // Fetch leads from Dynamics365 using Composio
    let leads
    try {
      console.log(`[Dynamics365 Sync] Fetching leads for connectionId: ${connectionId}`)
      leads = await fetchLeads(connectionId)
      console.log(`[Dynamics365 Sync] Fetched ${leads.length} leads from Dynamics365`)
    } catch (error) {
      console.error('[Dynamics365 Sync] Error fetching leads from Dynamics365:', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        connectionId,
      })
      
      // Check if it's an authentication error
      if (error instanceof Error && (
        error.message.includes('Unauthorized') ||
        error.message.includes('expired') ||
        error.message.includes('invalid') ||
        error.message.includes('401') ||
        error.message.includes('403')
      )) {
        return NextResponse.json(
          { error: 'Connection expired. Please reconnect to Dynamics365.' },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch leads from Dynamics365',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      )
    }

    // Get all cells for this user to sync contacts to
    const userCells = await getAllCells(userId, orgId || null)
    
    if (userCells.length === 0) {
      return NextResponse.json(
        { error: 'No cells found. Please create a cell first.' },
        { status: 400 }
      )
    }

    // If specific cellId provided, filter to just that cell
    const cellsToSync = cellId 
      ? userCells.filter(c => c.id === cellId)
      : userCells

    if (cellsToSync.length === 0) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
        { status: 404 }
      )
    }

    let totalSyncedCount = 0
    let totalUpdatedCount = 0

    // Sync to each cell
    for (const cell of cellsToSync) {
      const cellCountry = cell.phoneNumber ? getCellCountry(cell.phoneNumber) : 'US'
      
      let syncedCount = 0
      let updatedCount = 0
      const syncedPhoneNumbers = new Set<string>()

      // Get existing phone mappings for this cell
      const existingMappings = await db
        .select()
        .from(phoneUserMappings)
        .where(eq(phoneUserMappings.cellId, cell.id))

      const normalizedToExisting = new Map<string, typeof existingMappings[0]>()
      for (const mapping of existingMappings) {
        const normalized = normalizePhoneNumber(mapping.phoneNumber, cellCountry || 'US') || mapping.phoneNumber
        if (!normalizedToExisting.has(normalized)) {
          normalizedToExisting.set(normalized, mapping)
        }
      }

      for (const lead of leads) {
        const phoneNumbers = extractPhoneNumbers(lead, cellCountry || 'US')
        
        for (const phoneNumber of phoneNumbers) {
          const normalizedPhone = normalizePhoneNumber(phoneNumber, cellCountry || 'US') || phoneNumber
          
          if (syncedPhoneNumbers.has(normalizedPhone)) {
            continue
          }
          syncedPhoneNumbers.add(normalizedPhone)

          const existing = normalizedToExisting.get(normalizedPhone)

          const firstName = lead.firstname || null
          const lastName = lead.lastname || null
          const email = lead.emailaddress1 || null
          const companyName = lead.companyname || null

          if (!existing) {
            // Create new phone mapping
            await db.insert(phoneUserMappings).values({
              phoneNumber: normalizedPhone,
              userId: cell.userId,
              cellId: cell.id,
            })
            syncedCount++
            
            // Store Dynamics365 contact data
            const existingDynamics365Contact = await db
              .select()
              .from(dynamics365Contacts)
              .where(
                and(
                  eq(dynamics365Contacts.phoneNumber, normalizedPhone),
                  eq(dynamics365Contacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingDynamics365Contact[0]) {
              await db
                .update(dynamics365Contacts)
                .set({
                  dynamics365Id: lead.leadid,
                  firstName,
                  lastName,
                  email,
                  companyName,
                  updatedAt: new Date(),
                })
                .where(eq(dynamics365Contacts.id, existingDynamics365Contact[0].id))
            } else {
              await db.insert(dynamics365Contacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                dynamics365Id: lead.leadid,
                firstName,
                lastName,
                email,
                companyName,
              })
            }
          } else {
            // Update existing - just update Dynamics365 contact data
            const existingDynamics365Contact = await db
              .select()
              .from(dynamics365Contacts)
              .where(
                and(
                  eq(dynamics365Contacts.phoneNumber, normalizedPhone),
                  eq(dynamics365Contacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingDynamics365Contact[0]) {
              await db
                .update(dynamics365Contacts)
                .set({
                  dynamics365Id: lead.leadid,
                  firstName,
                  lastName,
                  email,
                  companyName,
                  updatedAt: new Date(),
                })
                .where(eq(dynamics365Contacts.id, existingDynamics365Contact[0].id))
            } else {
              await db.insert(dynamics365Contacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                dynamics365Id: lead.leadid,
                firstName,
                lastName,
                email,
                companyName,
              })
            }
            updatedCount++
          }
        }
      }

      // Update integration record for this cell if it exists
      const cellIntegration = await getIntegration(cell.id, 'dynamics365')
      if (cellIntegration) {
        await updateIntegration(cellIntegration.id, {
          lastSyncedAt: new Date(),
          syncedContactsCount: syncedCount,
        })
      }

      totalSyncedCount += syncedCount
      totalUpdatedCount += updatedCount
    }

    // Update global integration sync timestamp
    if (globalIntegration) {
      await updateIntegration(globalIntegration.id, {
        lastSyncedAt: new Date(),
        syncedContactsCount: totalSyncedCount,
      })
    }

    return NextResponse.json({
      success: true,
      syncedCount: totalSyncedCount,
      updatedCount: totalUpdatedCount,
      totalLeads: leads.length,
      cellsSynced: cellsToSync.length,
      message: `Synced ${totalSyncedCount} new contacts${totalUpdatedCount > 0 ? ` and updated ${totalUpdatedCount} existing contacts` : ''} from Dynamics365 to ${cellsToSync.length} cell${cellsToSync.length > 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('[Dynamics365 Sync] Error syncing contacts:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      cellId: cellId || 'unknown',
    })
    return NextResponse.json(
      { 
        error: 'Failed to sync contacts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
