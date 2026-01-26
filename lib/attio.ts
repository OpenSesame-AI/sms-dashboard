/**
 * Attio CRM integration using Composio
 * Handles Attio operations through Composio's managed integration
 */

import { executeAttioAction } from './composio'
import { normalizePhoneNumber } from './utils'

export interface AttioPerson {
  id: {
    object_id?: string
    record_id?: string
  }
  values?: {
    name?: Array<{
      first_name?: string
      last_name?: string
      full_name?: string
    }>
    email_addresses?: Array<{
      email_address?: string
    }>
    phone_numbers?: Array<{
      phone_number?: string
    }>
    job_title?: Array<{
      value?: string
    }>
    company?: Array<{
      target_object?: string
      target_record_id?: string
    }>
    primary_location?: Array<{
      locality?: string
      region?: string
      country_code?: string
    }>
  }
  [key: string]: any
}

/**
 * Fetch people from Attio using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of Attio people
 */
export async function fetchPeople(connectionId: string): Promise<AttioPerson[]> {
  try {
    console.log('[Attio] Fetching people using ATTIO_PEOPLE_LIST_PERSONS')
    const result = await executeAttioAction(connectionId, 'ATTIO_PEOPLE_LIST_PERSONS', {
      limit: 500,
    })

    console.log('[Attio] Action result:', {
      successful: result.successful,
      hasData: !!result.data,
      dataType: typeof result.data,
      error: result.error,
    })

    if (!result.successful) {
      const errorMsg = result.error || 'Failed to fetch people from Attio'
      console.error('[Attio] Action failed:', errorMsg)
      throw new Error(errorMsg)
    }

    const data = result.data
    
    // Handle different response formats
    let people: AttioPerson[] = []
    
    if (Array.isArray(data)) {
      people = data
      console.log(`[Attio] Received ${people.length} people as array`)
    } else if (data && typeof data === 'object' && 'data' in data) {
      // Attio API typically returns { data: [...] }
      people = (data as any).data || []
      console.log(`[Attio] Received ${people.length} people from data property`)
    } else if (data && typeof data === 'object' && 'id' in data) {
      // Single person object
      people = [data as AttioPerson]
      console.log('[Attio] Received single person object')
    } else {
      console.warn('[Attio] Unexpected data format:', {
        dataType: typeof data,
        hasData: data && typeof data === 'object' && 'data' in data,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        dataPreview: JSON.stringify(data).substring(0, 500),
      })
    }
    
    // Filter to only include people with phone numbers
    const peopleWithPhones = people.filter((person: AttioPerson) => {
      const phoneNumbers = person.values?.phone_numbers
      return phoneNumbers && phoneNumbers.length > 0 && phoneNumbers.some(p => p.phone_number?.trim())
    })
    
    console.log(`[Attio] Filtered to ${peopleWithPhones.length} people with phone numbers`)
    return peopleWithPhones
  } catch (error) {
    console.error('[Attio] Error fetching people:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch people: ${error}`)
  }
}

/**
 * Extract and normalize phone numbers from an Attio person
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param person - Attio person object
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(person: AttioPerson, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  // Attio stores phone numbers in phone_numbers array
  const phoneNumbers = person.values?.phone_numbers
  
  if (phoneNumbers && Array.isArray(phoneNumbers)) {
    for (const phoneObj of phoneNumbers) {
      if (phoneObj.phone_number?.trim()) {
        rawPhones.push(phoneObj.phone_number.trim())
      }
    }
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
      console.warn(`[Attio] Could not normalize phone number: ${rawPhone}`, {
        personId: getPersonId(person),
        personName: formatContactName(person),
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from Attio person
 * @param person - Attio person object
 * @returns Formatted name string
 */
export function formatContactName(person: AttioPerson): string {
  const nameValues = person.values?.name
  
  if (nameValues && nameValues.length > 0) {
    const name = nameValues[0]
    
    // Prefer full_name if available
    if (name.full_name) {
      return name.full_name
    }
    
    const firstname = name.first_name
    const lastname = name.last_name
    
    if (firstname && lastname) {
      return `${firstname} ${lastname}`
    }
    
    if (firstname) {
      return firstname
    }
    
    if (lastname) {
      return lastname
    }
  }
  
  // Try email as fallback
  const emails = person.values?.email_addresses
  if (emails && emails.length > 0 && emails[0].email_address) {
    return emails[0].email_address
  }
  
  return 'Unknown Contact'
}

/**
 * Get the unique ID for an Attio person
 * @param person - Attio person object
 * @returns The record ID
 */
export function getPersonId(person: AttioPerson): string {
  return person.id?.record_id || person.id?.object_id || 'unknown'
}

/**
 * Get the first and last name from an Attio person
 * @param person - Attio person object
 * @returns Object with firstName and lastName
 */
export function getPersonName(person: AttioPerson): { firstName: string | null, lastName: string | null } {
  const nameValues = person.values?.name
  
  if (nameValues && nameValues.length > 0) {
    const name = nameValues[0]
    return {
      firstName: name.first_name || null,
      lastName: name.last_name || null,
    }
  }
  
  return { firstName: null, lastName: null }
}

/**
 * Get the primary email from an Attio person
 * @param person - Attio person object
 * @returns The primary email or null
 */
export function getPersonEmail(person: AttioPerson): string | null {
  const emails = person.values?.email_addresses
  if (emails && emails.length > 0 && emails[0].email_address) {
    return emails[0].email_address
  }
  return null
}

/**
 * Get the job title from an Attio person
 * @param person - Attio person object
 * @returns The job title or null
 */
export function getJobTitle(person: AttioPerson): string | null {
  const jobTitles = person.values?.job_title
  if (jobTitles && jobTitles.length > 0 && jobTitles[0].value) {
    return jobTitles[0].value
  }
  return null
}
