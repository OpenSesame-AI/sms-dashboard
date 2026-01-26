/**
 * Dynamics365 integration using Composio
 * Handles Dynamics365 operations through Composio's managed integration
 */

import { executeDynamics365Action } from './composio'
import { normalizePhoneNumber } from './utils'

export interface Dynamics365Lead {
  leadid: string
  firstname?: string
  lastname?: string
  fullname?: string
  emailaddress1?: string
  telephone1?: string
  companyname?: string
  subject?: string
  [key: string]: any
}

/**
 * Fetch leads from Dynamics365 using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of Dynamics365 leads
 */
export async function fetchLeads(connectionId: string): Promise<Dynamics365Lead[]> {
  try {
    console.log('[Dynamics365] Fetching leads using DYNAMICS365_DYNAMICSCRM_GET_ALL_LEADS')
    const result = await executeDynamics365Action(connectionId, 'DYNAMICS365_DYNAMICSCRM_GET_ALL_LEADS', {
      select: 'leadid,firstname,lastname,fullname,emailaddress1,telephone1,companyname',
      top: 1000, // Limit to 1000 leads
    })

    console.log('[Dynamics365] Action result:', {
      successful: result.successful,
      hasData: !!result.data,
      dataType: typeof result.data,
      error: result.error,
    })

    if (!result.successful) {
      const errorMsg = result.error || 'Failed to fetch leads from Dynamics365'
      console.error('[Dynamics365] Action failed:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = result.data
    
    // Handle different response formats
    let leads: Dynamics365Lead[] = []
    
    if (Array.isArray(data)) {
      leads = data
      console.log(`[Dynamics365] Received ${leads.length} leads as array`)
    } else if (data && typeof data === 'object' && 'value' in data) {
      // Dynamics365 OData API typically returns { value: [...] }
      leads = (data as any).value || []
      console.log(`[Dynamics365] Received ${leads.length} leads from value property`)
    } else if (data && typeof data === 'object' && 'results' in data) {
      // Alternative format
      leads = (data as any).results || []
      console.log(`[Dynamics365] Received ${leads.length} leads from results property`)
    } else if (data && typeof data === 'object' && 'leadid' in data) {
      // Single lead object
      leads = [data as Dynamics365Lead]
      console.log('[Dynamics365] Received single lead object')
    } else {
      console.warn('[Dynamics365] Unexpected data format:', {
        dataType: typeof data,
        hasValue: data && typeof data === 'object' && 'value' in data,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        dataPreview: JSON.stringify(data).substring(0, 500),
      })
    }
    
    // Filter to only include leads with phone numbers
    const leadsWithPhones = leads.filter((lead: Dynamics365Lead) => {
      const phone = lead.telephone1
      return phone && phone.trim()
    })
    
    console.log(`[Dynamics365] Filtered to ${leadsWithPhones.length} leads with phone numbers`)
    return leadsWithPhones
  } catch (error) {
    console.error('[Dynamics365] Error fetching leads:', {
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
 * Extract and normalize phone numbers from a Dynamics365 lead
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param lead - Dynamics365 lead object
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(lead: Dynamics365Lead, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  // Dynamics365 stores phone number in telephone1
  const phone = lead.telephone1
  
  if (phone) {
    rawPhones.push(phone.trim())
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
      console.warn(`[Dynamics365] Could not normalize phone number: ${rawPhone}`, {
        leadId: lead.leadid,
        leadName: formatContactName(lead),
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from Dynamics365 lead
 * @param lead - Dynamics365 lead object
 * @returns Formatted name string
 */
export function formatContactName(lead: Dynamics365Lead): string {
  // Prefer fullname if available
  if (lead.fullname) {
    return lead.fullname
  }
  
  const firstname = lead.firstname
  const lastname = lead.lastname
  
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
  if (lead.emailaddress1) {
    return lead.emailaddress1
  }
  
  return 'Unknown Contact'
}
