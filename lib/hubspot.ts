/**
 * HubSpot integration using Composio
 * Handles HubSpot operations through Composio's managed integration
 */

import { executeHubspotAction, getConnection } from './composio'
import { normalizePhoneNumber } from './utils'

export interface HubspotContact {
  id: string
  properties?: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    mobilephone?: string
    company?: string
    associatedcompanyid?: string
    [key: string]: any
  }
  createdAt?: string
  updatedAt?: string
  archived?: boolean
  associations?: any
}

/**
 * Fetch contacts from HubSpot using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of HubSpot contacts
 */
export async function fetchContacts(connectionId: string): Promise<HubspotContact[]> {
  // Use HUBSPOT_LIST_CONTACTS to fetch contacts
  // We'll filter for contacts with phone numbers after fetching
  return await fetchContactsByList(connectionId)
}

/**
 * Fetch contacts by listing (more reliable than search)
 * @param connectionId - Composio connection ID
 * @returns Array of HubSpot contacts with phone numbers
 */
async function fetchContactsByList(connectionId: string): Promise<HubspotContact[]> {
  try {
    console.log('[HubSpot] Fetching contacts using HUBSPOT_LIST_CONTACTS')
    const result = await executeHubspotAction(connectionId, 'HUBSPOT_LIST_CONTACTS', {
      properties: ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'company', 'associatedcompanyid'],
      limit: 100, // HubSpot API maximum limit is 100
    })

    console.log('[HubSpot] Action result:', {
      successful: result.successful,
      hasData: !!result.data,
      dataType: typeof result.data,
      error: result.error,
    })

    if (!result.successful) {
      const errorMsg = result.error || 'Failed to fetch contacts from HubSpot'
      console.error('[HubSpot] Action failed:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = result.data
    
    // Handle different response formats
    let contacts: HubspotContact[] = []
    
    if (Array.isArray(data)) {
      contacts = data
      console.log(`[HubSpot] Received ${contacts.length} contacts as array`)
    } else if (data && typeof data === 'object' && 'results' in data) {
      // HubSpot API typically returns { results: [...] }
      contacts = (data as any).results || []
      console.log(`[HubSpot] Received ${contacts.length} contacts from results property`)
    } else if (data && typeof data === 'object' && 'id' in data) {
      // Single contact object
      contacts = [data as HubspotContact]
      console.log('[HubSpot] Received single contact object')
    } else {
      console.warn('[HubSpot] Unexpected data format:', {
        dataType: typeof data,
        hasResults: data && typeof data === 'object' && 'results' in data,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        dataPreview: JSON.stringify(data).substring(0, 500),
      })
    }
    
    // Filter to only include contacts with phone numbers
    const contactsWithPhones = contacts.filter((contact: HubspotContact) => {
      const phone = contact.properties?.phone
      const mobilephone = contact.properties?.mobilephone
      return (phone && phone.trim()) || (mobilephone && mobilephone.trim())
    })
    
    console.log(`[HubSpot] Filtered to ${contactsWithPhones.length} contacts with phone numbers`)
    return contactsWithPhones
  } catch (error) {
    console.error('[HubSpot] Error fetching contacts:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch contacts: ${error}`)
  }
}

/**
 * Extract and normalize phone numbers from a HubSpot contact
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param contact - HubSpot contact object
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(contact: HubspotContact, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  // HubSpot stores phone numbers in properties object
  const phone = contact.properties?.phone
  const mobilephone = contact.properties?.mobilephone
  
  if (phone) {
    rawPhones.push(phone.trim())
  }
  
  if (mobilephone && mobilephone.trim() !== phone?.trim()) {
    rawPhones.push(mobilephone.trim())
  }
  
  // Normalize phone numbers to E.164 format
  const normalizedPhones = new Set<string>()
  
  for (const rawPhone of rawPhones) {
    if (!rawPhone || rawPhone.length === 0) {
      continue
    }
    
    const normalized = normalizePhoneNumber(rawPhone, defaultCountry)
    if (normalized) {
      normalizedPhones.add(normalized)
    } else {
      // Log phone numbers that couldn't be normalized for debugging
      console.warn(`[HubSpot] Could not normalize phone number: ${rawPhone}`, {
        contactId: contact.id,
        contactName: formatContactName(contact),
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from HubSpot contact
 * @param contact - HubSpot contact object
 * @returns Formatted name string
 */
export function formatContactName(contact: HubspotContact): string {
  const firstname = contact.properties?.firstname
  const lastname = contact.properties?.lastname
  
  if (firstname && lastname) {
    return `${firstname} ${lastname}`
  }
  
  if (firstname) {
    return firstname
  }
  
  if (lastname) {
    return lastname
  }
  
  // Try email as fallback
  if (contact.properties?.email) {
    return contact.properties.email
  }
  
  return 'Unknown Contact'
}
