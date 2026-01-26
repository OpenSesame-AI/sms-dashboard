/**
 * Zoho Bigin integration using Composio
 * Handles Zoho Bigin operations through Composio's managed integration
 */

import { executeZohoBiginAction } from './composio'
import { normalizePhoneNumber } from './utils'

export interface ZohoBiginContact {
  id: string
  First_Name?: string
  Last_Name?: string
  Full_Name?: string
  Email?: string
  Phone?: string
  Mobile?: string
  Account_Name?: {
    name?: string
    id?: string
  }
  [key: string]: any
}

/**
 * Fetch contacts from Zoho Bigin using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of Zoho Bigin contacts
 */
export async function fetchContacts(connectionId: string): Promise<ZohoBiginContact[]> {
  try {
    console.log('[Zoho Bigin] Fetching contacts using ZOHO_BIGIN_GET_RECORDS')
    const result = await executeZohoBiginAction(connectionId, 'ZOHO_BIGIN_GET_RECORDS', {
      module_api_name: 'Contacts',
      fields: 'First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Account_Name',
      per_page: 200,
    })

    console.log('[Zoho Bigin] Action result:', {
      successful: result.successful,
      hasData: !!result.data,
      dataType: typeof result.data,
      error: result.error,
    })

    if (!result.successful) {
      const errorMsg = result.error || 'Failed to fetch contacts from Zoho Bigin'
      console.error('[Zoho Bigin] Action failed:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = result.data
    
    // Handle different response formats
    let contacts: ZohoBiginContact[] = []
    
    if (Array.isArray(data)) {
      contacts = data
      console.log(`[Zoho Bigin] Received ${contacts.length} contacts as array`)
    } else if (data && typeof data === 'object' && 'data' in data) {
      // Zoho Bigin API typically returns { data: [...] }
      contacts = (data as any).data || []
      console.log(`[Zoho Bigin] Received ${contacts.length} contacts from data property`)
    } else if (data && typeof data === 'object' && 'id' in data) {
      // Single contact object
      contacts = [data as ZohoBiginContact]
      console.log('[Zoho Bigin] Received single contact object')
    } else {
      console.warn('[Zoho Bigin] Unexpected data format:', {
        dataType: typeof data,
        hasData: data && typeof data === 'object' && 'data' in data,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        dataPreview: JSON.stringify(data).substring(0, 500),
      })
    }
    
    // Filter to only include contacts with phone numbers
    const contactsWithPhones = contacts.filter((contact: ZohoBiginContact) => {
      const phone = contact.Phone
      const mobile = contact.Mobile
      return (phone && phone.trim()) || (mobile && mobile.trim())
    })
    
    console.log(`[Zoho Bigin] Filtered to ${contactsWithPhones.length} contacts with phone numbers`)
    return contactsWithPhones
  } catch (error) {
    console.error('[Zoho Bigin] Error fetching contacts:', {
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
 * Extract and normalize phone numbers from a Zoho Bigin contact
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param contact - Zoho Bigin contact object
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(contact: ZohoBiginContact, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  // Zoho Bigin stores phone numbers in Phone and Mobile fields
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
      console.warn(`[Zoho Bigin] Could not normalize phone number: ${rawPhone}`, {
        contactId: contact.id,
        contactName: formatContactName(contact),
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from Zoho Bigin contact
 * @param contact - Zoho Bigin contact object
 * @returns Formatted name string
 */
export function formatContactName(contact: ZohoBiginContact): string {
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
