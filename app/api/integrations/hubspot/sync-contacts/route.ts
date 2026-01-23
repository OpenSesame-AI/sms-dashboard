import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCellById, getIntegration, updateIntegration, getConnectionIdFromIntegration, createIntegrationWithConnectionId } from '@/lib/db/queries'
import { fetchContacts, extractPhoneNumbers } from '@/lib/hubspot'
import { composio, isConnectionStatusActive } from '@/lib/composio'
import { db } from '@/lib/db/index'
import { phoneUserMappings, hubspotContacts } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
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
    
    console.log(`[HubSpot Sync] Starting sync for cellId: ${cellId}`)

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

    // Get integration
    let integration = await getIntegration(cellId, 'hubspot')
    let connectionId: string | null = null
    
    if (!integration) {
      // No integration in database - check if HubSpot connection exists in Composio
      console.log(`[HubSpot Sync] No integration found in database, checking Composio for connections...`)
      
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
        
        // Find HubSpot connections
        const hubspotConnections = connections.filter((conn: any) => {
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
        
        if (hubspotConnections.length === 0) {
          return NextResponse.json(
            { error: 'HubSpot integration not connected. Please connect HubSpot first.' },
            { status: 400 }
          )
        }
        
        // Use the first active HubSpot connection
        const firstConnection = hubspotConnections[0]
        const connectionStatus = firstConnection.data?.status || firstConnection.status || 'unknown'
        const isActive = isConnectionStatusActive(connectionStatus)
        
        if (!isActive) {
          return NextResponse.json(
            { error: `HubSpot connection found but status is: ${connectionStatus}. Please reconnect.` },
            { status: 400 }
          )
        }
        
        connectionId = firstConnection.id
        if (!connectionId) {
          return NextResponse.json(
            { error: 'HubSpot connection found but missing connection ID' },
            { status: 400 }
          )
        }
        console.log(`[HubSpot Sync] Auto-linking HubSpot connection ${connectionId} to cell ${cellId}`)
        
        // Auto-create the integration record
        integration = await createIntegrationWithConnectionId(
          userId,
          cellId,
          'hubspot',
          connectionId,
          orgId || null
        )
        
        console.log(`[HubSpot Sync] Created integration record: ${integration.id}`)
      } catch (error) {
        console.error('[HubSpot Sync] Error checking Composio connections:', error)
        return NextResponse.json(
          { error: 'Failed to check HubSpot connection. Please try again.' },
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
        { error: 'HubSpot connection ID not found' },
        { status: 400 }
      )
    }

    // Fetch contacts from HubSpot using Composio
    let contacts
    try {
      console.log(`[HubSpot Sync] Fetching contacts for connectionId: ${connectionId}`)
      contacts = await fetchContacts(connectionId)
      console.log(`[HubSpot Sync] Fetched ${contacts.length} contacts from HubSpot`)
    } catch (error) {
      console.error('[HubSpot Sync] Error fetching contacts from HubSpot:', {
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
          { error: 'Connection expired. Please reconnect to HubSpot.' },
          { status: 401 }
        )
      }
      
      // Return more detailed error for debugging
      return NextResponse.json(
        { 
          error: 'Failed to fetch contacts from HubSpot',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      )
    }

    // Get cell's country for phone number normalization
    const cellCountry = cell.phoneNumber ? getCellCountry(cell.phoneNumber) : 'US'
    
    // Sync contacts to database
    let syncedCount = 0
    let updatedCount = 0
    const syncedPhoneNumbers = new Set<string>()

    // First, get all existing phone numbers for this cell to check for duplicates
    const existingMappings = await db
      .select()
      .from(phoneUserMappings)
      .where(eq(phoneUserMappings.cellId, cellId))

    // Create a map of normalized phone numbers to existing records
    // Also track all mappings that normalize to the same number (for duplicate cleanup)
    const normalizedToExisting = new Map<string, typeof existingMappings[0]>()
    const normalizedToAllMappings = new Map<string, typeof existingMappings>()
    for (const mapping of existingMappings) {
      // Normalize existing phone numbers to find duplicates
      const normalized = normalizePhoneNumber(mapping.phoneNumber, cellCountry || 'US') || mapping.phoneNumber
      if (!normalizedToExisting.has(normalized)) {
        normalizedToExisting.set(normalized, mapping)
      }
      // Track all mappings for this normalized number
      if (!normalizedToAllMappings.has(normalized)) {
        normalizedToAllMappings.set(normalized, [])
      }
      normalizedToAllMappings.get(normalized)!.push(mapping)
    }

    for (const contact of contacts) {
      // Extract phone numbers using cell's country as default
      const phoneNumbers = extractPhoneNumbers(contact, cellCountry || 'US')
      
      for (const phoneNumber of phoneNumbers) {
        // Ensure phone number is normalized to E.164 format
        const normalizedPhone = normalizePhoneNumber(phoneNumber, cellCountry || 'US') || phoneNumber
        
        // Skip if we've already processed this phone number
        if (syncedPhoneNumbers.has(normalizedPhone)) {
          continue
        }
        syncedPhoneNumbers.add(normalizedPhone)

        // Check if a normalized version already exists
        const existing = normalizedToExisting.get(normalizedPhone)

        // Extract HubSpot contact properties
        const properties = contact.properties || {}
        const firstName = properties.firstname || null
        const lastName = properties.lastname || null
        const email = properties.email || null
        const companyId = properties.associatedcompanyid || null
        const companyName = properties.company || null

        if (!existing) {
          // No existing mapping with this normalized phone number - create new one
          await db.insert(phoneUserMappings).values({
            phoneNumber: normalizedPhone,
            userId: cell.userId,
            cellId: cellId,
          })
          syncedCount++
          // Add to map so we don't create duplicates
          const newMapping = await db
            .select()
            .from(phoneUserMappings)
            .where(
              and(
                eq(phoneUserMappings.phoneNumber, normalizedPhone),
                eq(phoneUserMappings.cellId, cellId)
              )
            )
            .limit(1)
          if (newMapping[0]) {
            normalizedToExisting.set(normalizedPhone, newMapping[0])
          }
          
          // Store HubSpot contact data
          const existingHubspotContact = await db
            .select()
            .from(hubspotContacts)
            .where(
              and(
                eq(hubspotContacts.phoneNumber, normalizedPhone),
                eq(hubspotContacts.cellId, cellId)
              )
            )
            .limit(1)
          
          if (existingHubspotContact[0]) {
            // Update existing HubSpot contact
            await db
              .update(hubspotContacts)
              .set({
                hubspotId: contact.id,
                firstName,
                lastName,
                email,
                companyId,
                companyName,
                updatedAt: new Date(),
              })
              .where(eq(hubspotContacts.id, existingHubspotContact[0].id))
          } else {
            // Insert new HubSpot contact
            await db.insert(hubspotContacts).values({
              phoneNumber: normalizedPhone,
              cellId: cellId,
              hubspotId: contact.id,
              firstName,
              lastName,
              email,
              companyId,
              companyName,
            })
          }
        } else {
          // Existing mapping found - check if we need to update or merge duplicates
          const allMappings = normalizedToAllMappings.get(normalizedPhone) || []
          
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
              updatedCount++
            }
            
            // Delete duplicates
            for (const duplicate of toDelete) {
              await db
                .delete(phoneUserMappings)
                .where(eq(phoneUserMappings.id, duplicate.id))
              updatedCount++
            }
          } else if (existing.phoneNumber !== normalizedPhone) {
            // Single mapping, just update to normalized format
            await db
              .update(phoneUserMappings)
              .set({ phoneNumber: normalizedPhone })
              .where(eq(phoneUserMappings.id, existing.id))
            updatedCount++
            // Update the map
            normalizedToExisting.set(normalizedPhone, { ...existing, phoneNumber: normalizedPhone })
          }
          
          // Update HubSpot contact data
          const existingHubspotContact = await db
            .select()
            .from(hubspotContacts)
            .where(
              and(
                eq(hubspotContacts.phoneNumber, normalizedPhone),
                eq(hubspotContacts.cellId, cellId)
              )
            )
            .limit(1)
          
          if (existingHubspotContact[0]) {
            // Update existing HubSpot contact
            await db
              .update(hubspotContacts)
              .set({
                hubspotId: contact.id,
                firstName,
                lastName,
                email,
                companyId,
                companyName,
                updatedAt: new Date(),
              })
              .where(eq(hubspotContacts.id, existingHubspotContact[0].id))
          } else {
            // Insert new HubSpot contact
            await db.insert(hubspotContacts).values({
              phoneNumber: normalizedPhone,
              cellId: cellId,
              hubspotId: contact.id,
              firstName,
              lastName,
              email,
              companyId,
              companyName,
            })
          }
        }
      }
    }

    // Update integration with sync timestamp and count
    await updateIntegration(integration.id, {
      lastSyncedAt: new Date(),
      syncedContactsCount: syncedCount,
    })

    return NextResponse.json({
      success: true,
      syncedCount,
      updatedCount,
      totalContacts: contacts.length,
      message: `Synced ${syncedCount} new contacts${updatedCount > 0 ? ` and updated ${updatedCount} existing contacts` : ''} from HubSpot`,
    })
  } catch (error) {
    console.error('[HubSpot Sync] Error syncing contacts:', {
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
