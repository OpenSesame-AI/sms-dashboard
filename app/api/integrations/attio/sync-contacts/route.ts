import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllCells, getGlobalIntegration, updateIntegration, getConnectionIdFromIntegration, createOrUpdateGlobalIntegrationWithConnectionId } from '@/lib/db/queries'
import { fetchPeople, extractPhoneNumbers, getPersonId, getPersonName, getPersonEmail, getJobTitle } from '@/lib/attio'
import { composio, isConnectionStatusActive } from '@/lib/composio'
import { db } from '@/lib/db/index'
import { phoneUserMappings, attioContacts } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { normalizePhoneNumber, getCellCountry } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get global integration (no cellId required - syncs to all cells)
    let integration = await getGlobalIntegration(userId, orgId || null, 'attio')
    let connectionId: string | null = null
    
    if (!integration) {
      // No integration in database - check if Attio connection exists in Composio
      console.log(`[Attio Sync] No integration found in database, checking Composio for connections...`)
      
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
        
        // Find Attio connections
        const attioConnections = connections.filter((conn: any) => {
          // Check toolkit field (most reliable)
          if (conn.toolkit) {
            const toolkit = typeof conn.toolkit === 'string' ? conn.toolkit : conn.toolkit.name || conn.toolkit.id
            if (toolkit && toolkit.toUpperCase().includes('ATTIO')) {
              return true
            }
          }
          
          // Check direct properties
          if (conn.appUniqueId === 'ATTIO' || 
              conn.appName === 'ATTIO' ||
              (conn.appUniqueId && conn.appUniqueId.toLowerCase().includes('attio')) ||
              (conn.appName && conn.appName.toLowerCase().includes('attio'))) {
            return true
          }
          
          // Check authConfig
          if (conn.authConfig) {
            const authConfig = conn.authConfig
            if (authConfig.appUniqueId === 'ATTIO' ||
                authConfig.appName === 'ATTIO' ||
                (authConfig.appUniqueId && authConfig.appUniqueId.toLowerCase().includes('attio'))) {
              return true
            }
          }
          
          return false
        })
        
        if (attioConnections.length === 0) {
          return NextResponse.json(
            { error: 'Attio integration not connected. Please connect Attio first.' },
            { status: 400 }
          )
        }
        
        // Use the first active Attio connection
        const firstConnection = attioConnections[0]
        const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
        const isActive = isConnectionStatusActive(connectionStatus)
        
        if (!isActive) {
          return NextResponse.json(
            { error: `Attio connection found but status is: ${connectionStatus}. Please reconnect.` },
            { status: 400 }
          )
        }
        
        connectionId = firstConnection.id
        if (!connectionId) {
          return NextResponse.json(
            { error: 'Attio connection found but missing connection ID' },
            { status: 400 }
          )
        }
        console.log(`[Attio Sync] Auto-linking Attio connection ${connectionId} to global integration`)
        
        // Auto-create the global integration record
        integration = await createOrUpdateGlobalIntegrationWithConnectionId(
          userId,
          orgId || null,
          'attio',
          connectionId
        )
        
        console.log(`[Attio Sync] Created global integration record: ${integration.id}`)
      } catch (error) {
        console.error('[Attio Sync] Error checking Composio connections:', error)
        return NextResponse.json(
          { error: 'Failed to check Attio connection. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      // Integration exists - get connection ID
      connectionId = getConnectionIdFromIntegration(integration)
      
      if (!connectionId) {
        // Legacy token-based integration - not supported anymore
        return NextResponse.json(
          { error: 'Legacy integration detected. Please reconnect using Composio.' },
          { status: 400 }
        )
      }
    }
    
    // At this point, we should have both integration and connectionId
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Attio connection ID not found' },
        { status: 400 }
      )
    }

    // Fetch people from Attio using Composio
    let people
    try {
      people = await fetchPeople(connectionId)
    } catch (error) {
      console.error('Error fetching people from Attio:', error)
      
      // Check if it's an authentication error
      if (error instanceof Error && (
        error.message.includes('Unauthorized') ||
        error.message.includes('expired') ||
        error.message.includes('invalid')
      )) {
        return NextResponse.json(
          { error: 'Connection expired. Please reconnect to Attio.' },
          { status: 401 }
        )
      }
      
      throw error
    }

    // Get all cells for this user/org to sync contacts to all of them
    const allCells = await getAllCells(userId, orgId || null)
    
    if (allCells.length === 0) {
      return NextResponse.json(
        { error: 'No cells found. Please create a cell first.' },
        { status: 400 }
      )
    }

    // Sync contacts to database for all cells
    let totalSyncedCount = 0
    let totalUpdatedCount = 0
    const syncedPhoneNumbers = new Set<string>()

    // Get all existing phone numbers for all cells to check for duplicates
    const allCellIds = allCells.map(c => c.id)
    const existingMappings = await db
      .select()
      .from(phoneUserMappings)
      .where(inArray(phoneUserMappings.cellId, allCellIds))

    // Create a map of normalized phone numbers to existing records per cell
    const normalizedToExistingByCell = new Map<string, Map<string, typeof existingMappings[0]>>()
    const normalizedToAllMappingsByCell = new Map<string, Map<string, typeof existingMappings>>()
    
    for (const mapping of existingMappings) {
      const cellId = mapping.cellId!
      const cell = allCells.find(c => c.id === cellId)
      const cellCountry = cell?.phoneNumber ? (getCellCountry(cell.phoneNumber) ?? undefined) : 'US'
      const normalized = normalizePhoneNumber(mapping.phoneNumber, cellCountry) || mapping.phoneNumber
      
      if (!normalizedToExistingByCell.has(cellId)) {
        normalizedToExistingByCell.set(cellId, new Map())
      }
      if (!normalizedToAllMappingsByCell.has(cellId)) {
        normalizedToAllMappingsByCell.set(cellId, new Map())
      }
      
      const cellMap = normalizedToExistingByCell.get(cellId)!
      const cellMappingsMap = normalizedToAllMappingsByCell.get(cellId)!
      
      if (!cellMap.has(normalized)) {
        cellMap.set(normalized, mapping)
      }
      if (!cellMappingsMap.has(normalized)) {
        cellMappingsMap.set(normalized, [])
      }
      cellMappingsMap.get(normalized)!.push(mapping)
    }

    // Sync contacts to each cell
    for (const cell of allCells) {
      const cellCountry = cell.phoneNumber ? (getCellCountry(cell.phoneNumber) ?? undefined) : 'US'
      const cellMap = normalizedToExistingByCell.get(cell.id) || new Map()
      const cellMappingsMap = normalizedToAllMappingsByCell.get(cell.id) || new Map()
      let cellSyncedCount = 0
      let cellUpdatedCount = 0

      for (const person of people) {
        // Extract phone numbers using cell's country as default
        const phoneNumbers = extractPhoneNumbers(person, cellCountry)
        const attioId = getPersonId(person)
        const { firstName, lastName } = getPersonName(person)
        const email = getPersonEmail(person)
        const jobTitle = getJobTitle(person)
        
        for (const phoneNumber of phoneNumbers) {
          // Ensure phone number is normalized to E.164 format
          const normalizedPhone = normalizePhoneNumber(phoneNumber, cellCountry) || phoneNumber
          
          // Skip if we've already processed this phone number for this cell
          const cellKey = `${cell.id}:${normalizedPhone}`
          if (syncedPhoneNumbers.has(cellKey)) {
            continue
          }
          syncedPhoneNumbers.add(cellKey)

          // Check if a normalized version already exists for this cell
          const existing = cellMap.get(normalizedPhone)

          if (!existing) {
            // No existing mapping with this normalized phone number - create new one
            await db.insert(phoneUserMappings).values({
              phoneNumber: normalizedPhone,
              userId: cell.userId,
              cellId: cell.id,
            })
            cellSyncedCount++
            
            // Store Attio contact data
            const existingAttioContact = await db
              .select()
              .from(attioContacts)
              .where(
                and(
                  eq(attioContacts.phoneNumber, normalizedPhone),
                  eq(attioContacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingAttioContact[0]) {
              // Update existing Attio contact
              await db
                .update(attioContacts)
                .set({
                  attioId: attioId,
                  firstName: firstName,
                  lastName: lastName,
                  email: email,
                  jobTitle: jobTitle,
                  updatedAt: new Date(),
                })
                .where(eq(attioContacts.id, existingAttioContact[0].id))
            } else {
              // Insert new Attio contact
              await db.insert(attioContacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                attioId: attioId,
                firstName: firstName,
                lastName: lastName,
                email: email,
                jobTitle: jobTitle,
              })
            }
          } else {
            // Existing mapping found - check if we need to update or merge duplicates
            const allMappings = cellMappingsMap.get(normalizedPhone) || []
            
            // If there are multiple mappings with different formats that normalize to the same number
            if (allMappings.length > 1) {
              // Keep the first one (oldest), delete the rest
              const toKeep = allMappings[0]
              const toDelete = allMappings.slice(1)
              
              // Update the one we're keeping to normalized format if needed
              if (toKeep.phoneNumber !== normalizedPhone) {
                await db
                  .update(phoneUserMappings)
                  .set({ phoneNumber: normalizedPhone })
                  .where(eq(phoneUserMappings.id, toKeep.id))
                cellUpdatedCount++
              }
              
              // Delete duplicates
              for (const duplicate of toDelete) {
                await db
                  .delete(phoneUserMappings)
                  .where(eq(phoneUserMappings.id, duplicate.id))
                cellUpdatedCount++
              }
            } else if (existing.phoneNumber !== normalizedPhone) {
              // Single mapping, just update to normalized format
              await db
                .update(phoneUserMappings)
                .set({ phoneNumber: normalizedPhone })
                .where(eq(phoneUserMappings.id, existing.id))
              cellUpdatedCount++
            }
            
            // Update Attio contact data
            const existingAttioContact = await db
              .select()
              .from(attioContacts)
              .where(
                and(
                  eq(attioContacts.phoneNumber, normalizedPhone),
                  eq(attioContacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingAttioContact[0]) {
              // Update existing Attio contact
              await db
                .update(attioContacts)
                .set({
                  attioId: attioId,
                  firstName: firstName,
                  lastName: lastName,
                  email: email,
                  jobTitle: jobTitle,
                  updatedAt: new Date(),
                })
                .where(eq(attioContacts.id, existingAttioContact[0].id))
            } else {
              // Insert new Attio contact
              await db.insert(attioContacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                attioId: attioId,
                firstName: firstName,
                lastName: lastName,
                email: email,
                jobTitle: jobTitle,
              })
            }
          }
        }
      }
      
      totalSyncedCount += cellSyncedCount
      totalUpdatedCount += cellUpdatedCount
    }

    // Update integration with sync timestamp and count
    await updateIntegration(integration.id, {
      lastSyncedAt: new Date(),
      syncedContactsCount: totalSyncedCount,
    })

    return NextResponse.json({
      success: true,
      syncedCount: totalSyncedCount,
      updatedCount: totalUpdatedCount,
      totalContacts: people.length,
      cellsSynced: allCells.length,
      message: `Synced ${totalSyncedCount} new contacts${totalUpdatedCount > 0 ? ` and updated ${totalUpdatedCount} existing contacts` : ''} from Attio to ${allCells.length} cell${allCells.length > 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('Error syncing contacts:', error)
    return NextResponse.json(
      { 
        error: 'Failed to sync contacts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
