/**
 * Salesforce integration using Composio
 * Handles Salesforce operations through Composio's managed integration
 */

import { executeSalesforceAction, getConnection } from './composio'
import { normalizePhoneNumber } from './utils'

export interface SalesforceContact {
  Id: string
  FirstName?: string
  LastName?: string
  Name?: string
  Phone?: string
  MobilePhone?: string
  Email?: string
  AccountId?: string
  Account?: {
    Name?: string
  }
}

/**
 * Fetch contacts from Salesforce using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of Salesforce contacts
 */
export async function fetchContacts(connectionId: string): Promise<SalesforceContact[]> {
  // Use Composio's SALESFORCE_QUERY tool to fetch contacts with phone numbers
  const query = `
    SELECT Id, FirstName, LastName, Name, Phone, MobilePhone, Email, AccountId, Account.Name
    FROM Contact
    WHERE (Phone != null OR MobilePhone != null)
    ORDER BY LastModifiedDate DESC
    LIMIT 1000
  `

  try {
    const result = await executeSalesforceAction(connectionId, 'SALESFORCE_QUERY', {
      q: query,
    })

    if (!result.successful) {
      throw new Error(result.error || 'Failed to fetch contacts from Salesforce')
    }

    // Composio returns data in result.data
    const data = result.data
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data
    }
    
    // If it's a query result with records property
    if (data && typeof data === 'object' && 'records' in data) {
      return (data as any).records || []
    }
    
    // If it's a direct object response
    if (data && typeof data === 'object' && 'Id' in data) {
      return [data as SalesforceContact]
    }

    return []
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch contacts: ${error}`)
  }
}

/**
 * Extract and normalize phone numbers from a Salesforce contact
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param contact - Salesforce contact object
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(contact: SalesforceContact, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  if (contact.Phone) {
    rawPhones.push(contact.Phone.trim())
  }
  
  if (contact.MobilePhone && contact.MobilePhone.trim() !== contact.Phone?.trim()) {
    rawPhones.push(contact.MobilePhone.trim())
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
      console.warn(`[Salesforce] Could not normalize phone number: ${rawPhone}`, {
        contactId: contact.Id,
        contactName: contact.Name,
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from Salesforce contact
 * @param contact - Salesforce contact object
 * @returns Formatted name string
 */
export function formatContactName(contact: SalesforceContact): string {
  if (contact.Name) {
    return contact.Name
  }
  
  const parts: string[] = []
  if (contact.FirstName) parts.push(contact.FirstName)
  if (contact.LastName) parts.push(contact.LastName)
  
  return parts.length > 0 ? parts.join(' ') : 'Unknown Contact'
}

