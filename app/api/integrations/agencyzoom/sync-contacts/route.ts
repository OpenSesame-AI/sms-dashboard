import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAllCells, getGlobalIntegration, updateIntegration, getConnectionIdFromIntegration, createOrUpdateGlobalIntegrationWithConnectionId } from '@/lib/db/queries'
import { fetchCustomers, fetchLeads, extractPhoneNumbers, getContactId, getSourceType } from '@/lib/agencyzoom'
import { composio, isConnectionStatusActive } from '@/lib/composio'
import { db } from '@/lib/db/index'
import { phoneUserMappings, agencyzoomContacts } from '@/lib/db/schema'
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
    let integration = await getGlobalIntegration(userId, orgId || null, 'agencyzoom')
    let connectionId: string | null = null
    
    if (!integration) {
      // No integration in database - check if AgencyZoom connection exists in Composio
      console.log(`[AgencyZoom Sync] No integration found in database, checking Composio for connections...`)
      
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
        
        // Find AgencyZoom connections
        const agencyzoomConnections = connections.filter((conn: any) => {
          // Check toolkit field (most reliable)
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
        
        if (agencyzoomConnections.length === 0) {
          return NextResponse.json(
            { error: 'AgencyZoom integration not connected. Please connect AgencyZoom first.' },
            { status: 400 }
          )
        }
        
        // Use the first active AgencyZoom connection
        const firstConnection = agencyzoomConnections[0]
        const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
        const isActive = isConnectionStatusActive(connectionStatus)
        
        if (!isActive) {
          return NextResponse.json(
            { error: `AgencyZoom connection found but status is: ${connectionStatus}. Please reconnect.` },
            { status: 400 }
          )
        }
        
        connectionId = firstConnection.id
        if (!connectionId) {
          return NextResponse.json(
            { error: 'AgencyZoom connection found but missing connection ID' },
            { status: 400 }
          )
        }
        console.log(`[AgencyZoom Sync] Auto-linking AgencyZoom connection ${connectionId} to global integration`)
        
        // Auto-create the global integration record
        integration = await createOrUpdateGlobalIntegrationWithConnectionId(
          userId,
          orgId || null,
          'agencyzoom',
          connectionId
        )
        
        console.log(`[AgencyZoom Sync] Created global integration record: ${integration.id}`)
      } catch (error) {
        console.error('[AgencyZoom Sync] Error checking Composio connections:', error)
        return NextResponse.json(
          { error: 'Failed to check AgencyZoom connection. Please try again.' },
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
        { error: 'AgencyZoom connection ID not found' },
        { status: 400 }
      )
    }

    // Fetch both customers and leads from AgencyZoom using Composio
    let allContacts: { contact: any; sourceType: 'customer' | 'lead' }[] = []
    
    try {
      // Fetch customers
      const customers = await fetchCustomers(connectionId)
      for (const customer of customers) {
        allContacts.push({ contact: customer, sourceType: 'customer' })
      }
      console.log(`[AgencyZoom Sync] Fetched ${customers.length} customers`)
    } catch (error) {
      console.error('Error fetching customers from AgencyZoom:', error)
      // Continue with leads even if customers fail
    }
    
    try {
      // Fetch leads
      const leads = await fetchLeads(connectionId)
      for (const lead of leads) {
        allContacts.push({ contact: lead, sourceType: 'lead' })
      }
      console.log(`[AgencyZoom Sync] Fetched ${leads.length} leads`)
    } catch (error) {
      console.error('Error fetching leads from AgencyZoom:', error)
      // Continue even if leads fail
    }
    
    if (allContacts.length === 0) {
      return NextResponse.json({
        success: true,
        syncedCount: 0,
        updatedCount: 0,
        totalContacts: 0,
        cellsSynced: 0,
        message: 'No contacts with phone numbers found in AgencyZoom',
      })
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

      for (const { contact, sourceType } of allContacts) {
        // Extract phone numbers using cell's country as default
        const phoneNumbers = extractPhoneNumbers(contact, cellCountry)
        const contactId = getContactId(contact)
        
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
            
            // Store AgencyZoom contact data
            const existingAgencyzoomContact = await db
              .select()
              .from(agencyzoomContacts)
              .where(
                and(
                  eq(agencyzoomContacts.phoneNumber, normalizedPhone),
                  eq(agencyzoomContacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingAgencyzoomContact[0]) {
              // Update existing AgencyZoom contact
              await db
                .update(agencyzoomContacts)
                .set({
                  agencyzoomId: contactId,
                  firstName: contact.firstname || null,
                  lastName: contact.lastname || null,
                  email: contact.email || null,
                  companyName: contact.name || null, // Business name for leads
                  sourceType: sourceType,
                  updatedAt: new Date(),
                })
                .where(eq(agencyzoomContacts.id, existingAgencyzoomContact[0].id))
            } else {
              // Insert new AgencyZoom contact
              await db.insert(agencyzoomContacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                agencyzoomId: contactId,
                firstName: contact.firstname || null,
                lastName: contact.lastname || null,
                email: contact.email || null,
                companyName: contact.name || null,
                sourceType: sourceType,
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
            
            // Update AgencyZoom contact data
            const existingAgencyzoomContact = await db
              .select()
              .from(agencyzoomContacts)
              .where(
                and(
                  eq(agencyzoomContacts.phoneNumber, normalizedPhone),
                  eq(agencyzoomContacts.cellId, cell.id)
                )
              )
              .limit(1)
            
            if (existingAgencyzoomContact[0]) {
              // Update existing AgencyZoom contact
              await db
                .update(agencyzoomContacts)
                .set({
                  agencyzoomId: contactId,
                  firstName: contact.firstname || null,
                  lastName: contact.lastname || null,
                  email: contact.email || null,
                  companyName: contact.name || null,
                  sourceType: sourceType,
                  updatedAt: new Date(),
                })
                .where(eq(agencyzoomContacts.id, existingAgencyzoomContact[0].id))
            } else {
              // Insert new AgencyZoom contact
              await db.insert(agencyzoomContacts).values({
                phoneNumber: normalizedPhone,
                cellId: cell.id,
                agencyzoomId: contactId,
                firstName: contact.firstname || null,
                lastName: contact.lastname || null,
                email: contact.email || null,
                companyName: contact.name || null,
                sourceType: sourceType,
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
      totalContacts: allContacts.length,
      cellsSynced: allCells.length,
      message: `Synced ${totalSyncedCount} new contacts${totalUpdatedCount > 0 ? ` and updated ${totalUpdatedCount} existing contacts` : ''} from AgencyZoom to ${allCells.length} cell${allCells.length > 1 ? 's' : ''}`,
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
