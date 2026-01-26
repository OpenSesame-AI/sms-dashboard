/**
 * Zoho CRM integration using Composio
 * Handles Zoho operations through Composio's managed integration
 */

import { executeZohoAction } from './composio'
import { normalizePhoneNumber } from './utils'

export interface ZohoContact {
  id: string
  First_Name?: string
  Last_Name?: string
  Full_Name?: string
  Email?: string
  Phone?: string
  Mobile?: string
  Company?: string
  Account_Name?: {
    name?: string
    id?: string
  }
  [key: string]: any
}

/**
 * Fetch contacts from Zoho CRM using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of Zoho contacts
 */
export async function fetchContacts(connectionId: string): Promise<ZohoContact[]> {
  try {
    console.log('[Zoho] Fetching contacts using ZOHO_GET_ZOHO_RECORDS')
    const result = await executeZohoAction(connectionId, 'ZOHO_GET_ZOHO_RECORDS', {
      module_api_name: 'Contacts',
      fields: 'First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Account_Name',
      per_page: 200,
      sort_by: 'Modified_Time',
      sort_order: 'desc',
    })

    console.log('[Zoho] Action result:', {
      successful: result.successful,
      hasData: !!result.data,
      dataType: typeof result.data,
      error: result.error,
    })

    if (!result.successful) {
      const errorMsg = result.error || 'Failed to fetch contacts from Zoho'
      console.error('[Zoho] Action failed:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = result.data
    
    // Handle different response formats
    let contacts: ZohoContact[] = []
    
    if (Array.isArray(data)) {
      contacts = data
      console.log(`[Zoho] Received ${contacts.length} contacts as array`)
    } else if (data && typeof data === 'object' && 'data' in data) {
      // Zoho API typically returns { data: [...] }
      contacts = (data as any).data || []
      console.log(`[Zoho] Received ${contacts.length} contacts from data property`)
    } else if (data && typeof data === 'object' && 'id' in data) {
      // Single contact object
      contacts = [data as ZohoContact]
      console.log('[Zoho] Received single contact object')
    } else {
      console.warn('[Zoho] Unexpected data format:', {
        dataType: typeof data,
        hasData: data && typeof data === 'object' && 'data' in data,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        dataPreview: JSON.stringify(data).substring(0, 500),
      })
    }
    
    // Filter to only include contacts with phone numbers
    const contactsWithPhones = contacts.filter((contact: ZohoContact) => {
      const phone = contact.Phone
      const mobile = contact.Mobile
      return (phone && phone.trim()) || (mobile && mobile.trim())
    })
    
    console.log(`[Zoho] Filtered to ${contactsWithPhones.length} contacts with phone numbers`)
    return contactsWithPhones
  } catch (error) {
    console.error('[Zoho] Error fetching contacts:', {
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
 * Extract and normalize phone numbers from a Zoho contact
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param contact - Zoho contact object
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(contact: ZohoContact, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  // Zoho stores phone numbers in Phone and Mobile fields
  const phone = contact.Phone
  const mobile = contact.Mobile
  
  if (phone) {
    rawPhones.push(phone.trim())
  }
  
  if (mobile && mobile.trim() !== phone?.trim()) {
    rawPhones.push(mobile.trim())
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
      console.warn(`[Zoho] Could not normalize phone number: ${rawPhone}`, {
        contactId: contact.id,
        contactName: formatContactName(contact),
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from Zoho contact
 * @param contact - Zoho contact object
 * @returns Formatted name string
 */
export function formatContactName(contact: ZohoContact): string {
  // Prefer Full_Name if available
  if (contact.Full_Name) {
    return contact.Full_Name
  }
  
  const firstname = contact.First_Name
  const lastname = contact.Last_Name
  
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
  if (contact.Email) {
    return contact.Email
  }
  
  return 'Unknown Contact'
}
