import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllCells, getGlobalIntegration, updateIntegration, getConnectionIdFromIntegration, createOrUpdateGlobalIntegrationWithConnectionId } from '@/lib/db/queries'
import { fetchContacts, extractPhoneNumbers } from '@/lib/salesforce'
import { composio, isConnectionStatusActive } from '@/lib/composio'
import { db } from '@/lib/db/index'
import { phoneUserMappings, salesforceContacts } from '@/lib/db/schema'
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
    let integration = await getGlobalIntegration(userId, orgId || null, 'salesforce')
    let connectionId: string | null = null
    
    if (!integration) {
      // No integration in database - check if Salesforce connection exists in Composio
      console.log(`[Salesforce Sync] No integration found in database, checking Composio for connections...`)
      
      if (!composio) {
        return NextResponse.json(
          { error: 'Composio client not initialized' },
          { status: 500 }
        )
      }
      
      try {
        // List user's connections from Composio
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
        
        // Find Salesforce connections
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
          
          // Check authConfig
          if (conn.authConfig) {
            const authConfig = conn.authConfig
            if (authConfig.appUniqueId === 'SALESFORCE' ||
                authConfig.appName === 'SALESFORCE' ||
                (authConfig.appUniqueId && authConfig.appUniqueId.toLowerCase().includes('salesforce'))) {
              return true
            }
          }
          
          // Check data.status for ACTIVE Salesforce connections
          if (conn.data && conn.data.status === 'ACTIVE' && conn.data.subdomain) {
            if (conn.data.subdomain === 'login' || conn.data.subdomain.includes('salesforce')) {
              return true
            }
          }
          
          return false
        })
        
        if (salesforceConnections.length === 0) {
          return NextResponse.json(
            { error: 'Salesforce integration not connected. Please connect Salesforce first.' },
            { status: 400 }
          )
        }
        
        // Use the first active Salesforce connection
        const firstConnection = salesforceConnections[0]
        const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
        const isActive = isConnectionStatusActive(connectionStatus)
        
        if (!isActive) {
          return NextResponse.json(
            { error: `Salesforce connection found but status is: ${connectionStatus}. Please reconnect.` },
            { status: 400 }
          )
        }
        
        connectionId = firstConnection.id
        if (!connectionId) {
          return NextResponse.json(
            { error: 'Salesforce connection found but missing connection ID' },
            { status: 400 }
          )
        }
        console.log(`[Salesforce Sync] Auto-linking Salesforce connection ${connectionId} to global integration`)
        
        // Auto-create the global integration record
        integration = await createOrUpdateGlobalIntegrationWithConnectionId(
          userId,
          orgId || null,
          'salesforce',
          connectionId
        )
        
        console.log(`[Salesforce Sync] Created global integration record: ${integration.id}`)
      } catch (error) {
        console.error('[Salesforce Sync] Error checking Composio connections:', error)
        return NextResponse.json(
          { error: 'Failed to check Salesforce connection. Please try again.' },
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
        { error: 'Salesforce connection ID not found' },
        { status: 400 }
      )
    }

    // Fetch contacts from Salesforce using Composio
    let contacts
    try {
      contacts = await fetchContacts(connectionId)
    } catch (error) {
      console.error('Error fetching contacts from Salesforce:', error)
      
      // Check if it's an authentication error
      if (error instanceof Error && (
        error.message.includes('Unauthorized') ||
        error.message.includes('expired') ||
        error.message.includes('invalid')
      )) {
        return NextResponse.json(
          { error: 'Connection expired. Please reconnect to Salesforce.' },
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
    // Also track all mappings that normalize to the same number (for duplicate cleanup)
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

      for (const contact of contacts) {
        // Extract phone numbers using cell's country as default
        const phoneNumbers = extractPhoneNumbers(contact, cellCountry)
        
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
            
            // Store Salesforce contact data
            const existingSalesforceContact = await db
              .select()
              .from(salesforceContacts)
              .where(
                and(
                  eq(salesforceContacts.phoneNumber, normalizedPhone),
                  eq(salesforceContacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingSalesforceContact[0]) {
              // Update existing Salesforce contact
              await db
                .update(salesforceContacts)
                .set({
                  salesforceId: contact.Id,
                  firstName: contact.FirstName || null,
                  lastName: contact.LastName || null,
                  email: contact.Email || null,
                  accountId: contact.AccountId || null,
                  accountName: contact.Account?.Name || null,
                  updatedAt: new Date(),
                })
                .where(eq(salesforceContacts.id, existingSalesforceContact[0].id))
            } else {
              // Insert new Salesforce contact
              await db.insert(salesforceContacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                salesforceId: contact.Id,
                firstName: contact.FirstName || null,
                lastName: contact.LastName || null,
                email: contact.Email || null,
                accountId: contact.AccountId || null,
                accountName: contact.Account?.Name || null,
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
            
            // Update Salesforce contact data
            const existingSalesforceContact = await db
              .select()
              .from(salesforceContacts)
              .where(
                and(
                  eq(salesforceContacts.phoneNumber, normalizedPhone),
                  eq(salesforceContacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingSalesforceContact[0]) {
              // Update existing Salesforce contact
              await db
                .update(salesforceContacts)
                .set({
                  salesforceId: contact.Id,
                  firstName: contact.FirstName || null,
                  lastName: contact.LastName || null,
                  email: contact.Email || null,
                  accountId: contact.AccountId || null,
                  accountName: contact.Account?.Name || null,
                  updatedAt: new Date(),
                })
                .where(eq(salesforceContacts.id, existingSalesforceContact[0].id))
            } else {
              // Insert new Salesforce contact
              await db.insert(salesforceContacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                salesforceId: contact.Id,
                firstName: contact.FirstName || null,
                lastName: contact.LastName || null,
                email: contact.Email || null,
                accountId: contact.AccountId || null,
                accountName: contact.Account?.Name || null,
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
      totalContacts: contacts.length,
      cellsSynced: allCells.length,
      message: `Synced ${totalSyncedCount} new contacts${totalUpdatedCount > 0 ? ` and updated ${totalUpdatedCount} existing contacts` : ''} from Salesforce to ${allCells.length} cell${allCells.length > 1 ? 's' : ''}`,
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
