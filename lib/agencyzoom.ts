/**
 * AgencyZoom integration using Composio
 * Handles AgencyZoom operations through Composio's managed integration
 */

import { executeAgencyzoomAction } from './composio'
import { normalizePhoneNumber } from './utils'

export interface AgencyzoomCustomer {
  customerId?: number
  id?: number
  firstname?: string
  lastname?: string
  email?: string
  phone?: string
  secondaryPhone?: string
  city?: string
  state?: string
  streetAddress?: string
  zip?: string
  country?: string
  bizCustomer?: number
  [key: string]: any
}

export interface AgencyzoomLead {
  leadId?: number
  id?: number
  firstname?: string
  lastname?: string
  middlename?: string
  email?: string
  phone?: string
  secondaryPhone?: string
  name?: string // Business name
  city?: string
  state?: string
  streetAddress?: string
  zip?: string
  country?: string
  isBusiness?: boolean
  [key: string]: any
}

export type AgencyzoomContact = AgencyzoomCustomer | AgencyzoomLead

/**
 * Fetch customers from AgencyZoom using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of AgencyZoom customers
 */
export async function fetchCustomers(connectionId: string): Promise<AgencyzoomCustomer[]> {
  try {
    console.log('[AgencyZoom] Fetching customers using AGENCYZOOM_SEARCH_CUSTOMERS')
    const result = await executeAgencyzoomAction(connectionId, 'AGENCYZOOM_SEARCH_CUSTOMERS', {})

    console.log('[AgencyZoom] Customers result:', {
      successful: result.successful,
      hasData: !!result.data,
      dataType: typeof result.data,
      error: result.error,
    })

    if (!result.successful) {
      const errorMsg = result.error || 'Failed to fetch customers from AgencyZoom'
      console.error('[AgencyZoom] Action failed:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = result.data
    
    // Handle different response formats
    let customers: AgencyzoomCustomer[] = []
    
    if (Array.isArray(data)) {
      customers = data
      console.log(`[AgencyZoom] Received ${customers.length} customers as array`)
    } else if (data && typeof data === 'object') {
      // AgencyZoom API typically returns { items: [...], total: number } or { data: [...] }
      if ('items' in data && Array.isArray((data as any).items)) {
        customers = (data as any).items
        console.log(`[AgencyZoom] Received ${customers.length} customers from items property`)
      } else if ('data' in data && Array.isArray((data as any).data)) {
        customers = (data as any).data
        console.log(`[AgencyZoom] Received ${customers.length} customers from data property`)
      } else if ('customers' in data && Array.isArray((data as any).customers)) {
        customers = (data as any).customers
        console.log(`[AgencyZoom] Received ${customers.length} customers from customers property`)
      } else if ('customerId' in data || 'id' in data) {
        // Single customer object
        customers = [data as AgencyzoomCustomer]
        console.log('[AgencyZoom] Received single customer object')
      } else {
        console.warn('[AgencyZoom] Unexpected data format:', {
          dataType: typeof data,
          keys: Object.keys(data),
          dataPreview: JSON.stringify(data).substring(0, 500),
        })
      }
    }
    
    // Filter to only include customers with phone numbers
    const customersWithPhones = customers.filter((customer: AgencyzoomCustomer) => {
      const phone = customer.phone
      const secondaryPhone = customer.secondaryPhone
      return (phone && phone.trim()) || (secondaryPhone && secondaryPhone.trim())
    })
    
    console.log(`[AgencyZoom] Filtered to ${customersWithPhones.length} customers with phone numbers`)
    return customersWithPhones
  } catch (error) {
    console.error('[AgencyZoom] Error fetching customers:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch customers: ${error}`)
  }
}

/**
 * Fetch leads from AgencyZoom using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of AgencyZoom leads
 */
export async function fetchLeads(connectionId: string): Promise<AgencyzoomLead[]> {
  try {
    console.log('[AgencyZoom] Fetching leads using AGENCYZOOM_SEARCH_LEADS')
    const result = await executeAgencyzoomAction(connectionId, 'AGENCYZOOM_SEARCH_LEADS', {})

    console.log('[AgencyZoom] Leads result:', {
      successful: result.successful,
      hasData: !!result.data,
      dataType: typeof result.data,
      error: result.error,
    })

    if (!result.successful) {
      const errorMsg = result.error || 'Failed to fetch leads from AgencyZoom'
      console.error('[AgencyZoom] Action failed:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = result.data
    
    // Handle different response formats
    let leads: AgencyzoomLead[] = []
    
    if (Array.isArray(data)) {
      leads = data
      console.log(`[AgencyZoom] Received ${leads.length} leads as array`)
    } else if (data && typeof data === 'object') {
      // AgencyZoom API typically returns { items: [...], total: number } or { data: [...] }
      if ('items' in data && Array.isArray((data as any).items)) {
        leads = (data as any).items
        console.log(`[AgencyZoom] Received ${leads.length} leads from items property`)
      } else if ('data' in data && Array.isArray((data as any).data)) {
        leads = (data as any).data
        console.log(`[AgencyZoom] Received ${leads.length} leads from data property`)
      } else if ('leads' in data && Array.isArray((data as any).leads)) {
        leads = (data as any).leads
        console.log(`[AgencyZoom] Received ${leads.length} leads from leads property`)
      } else if ('leadId' in data || 'id' in data) {
        // Single lead object
        leads = [data as AgencyzoomLead]
        console.log('[AgencyZoom] Received single lead object')
      } else {
        console.warn('[AgencyZoom] Unexpected data format:', {
          dataType: typeof data,
          keys: Object.keys(data),
          dataPreview: JSON.stringify(data).substring(0, 500),
        })
      }
    }
    
    // Filter to only include leads with phone numbers
    const leadsWithPhones = leads.filter((lead: AgencyzoomLead) => {
      const phone = lead.phone
      const secondaryPhone = lead.secondaryPhone
      return (phone && phone.trim()) || (secondaryPhone && secondaryPhone.trim())
    })
    
    console.log(`[AgencyZoom] Filtered to ${leadsWithPhones.length} leads with phone numbers`)
    return leadsWithPhones
  } catch (error) {
    console.error('[AgencyZoom] Error fetching leads:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch leads: ${error}`)
  }
}

/**
 * Extract and normalize phone numbers from an AgencyZoom contact (customer or lead)
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param contact - AgencyZoom contact object (customer or lead)
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(contact: AgencyzoomContact, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  // AgencyZoom stores phone numbers in phone and secondaryPhone fields
  const phone = contact.phone
  const secondaryPhone = contact.secondaryPhone
  
  if (phone) {
    rawPhones.push(phone.trim())
  }
  
  if (secondaryPhone && secondaryPhone.trim() !== phone?.trim()) {
    rawPhones.push(secondaryPhone.trim())
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
      console.warn(`[AgencyZoom] Could not normalize phone number: ${rawPhone}`, {
        contactId: (contact as AgencyzoomCustomer).customerId || (contact as AgencyzoomLead).leadId || contact.id,
        contactName: formatContactName(contact),
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from AgencyZoom contact (customer or lead)
 * @param contact - AgencyZoom contact object
 * @returns Formatted name string
 */
export function formatContactName(contact: AgencyzoomContact): string {
  const firstname = contact.firstname
  const lastname = contact.lastname
  
  if (firstname && lastname) {
    return `${firstname} ${lastname}`
  }
  
  if (firstname) {
    return firstname
  }
  
  if (lastname) {
    return lastname
  }
  
  // For leads, try business name
  if ('name' in contact && contact.name) {
    return contact.name
  }
  
  // Try email as fallback
  if (contact.email) {
    return contact.email
  }
  
  return 'Unknown Contact'
}

/**
 * Get the AgencyZoom ID from a contact
 * @param contact - AgencyZoom contact object (customer or lead)
 * @returns The contact ID as a string
 */
export function getContactId(contact: AgencyzoomContact): string {
  const customer = contact as AgencyzoomCustomer
  const lead = contact as AgencyzoomLead
  
  if (customer.customerId) {
    return String(customer.customerId)
  }
  if (lead.leadId) {
    return String(lead.leadId)
  }
  if (contact.id) {
    return String(contact.id)
  }
  return 'unknown'
}

/**
 * Determine if a contact is a lead or customer
 * @param contact - AgencyZoom contact object
 * @returns 'lead' or 'customer'
 */
export function getSourceType(contact: AgencyzoomContact): 'lead' | 'customer' {
  if ('leadId' in contact && contact.leadId) {
    return 'lead'
  }
  if ('isBusiness' in contact) {
    return 'lead'
  }
  return 'customer'
}
