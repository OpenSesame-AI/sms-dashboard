/**
 * Zendesk integration using Composio
 * Handles Zendesk operations through Composio's managed integration
 */

import { executeZendeskAction } from './composio'
import { normalizePhoneNumber } from './utils'

export interface ZendeskUser {
  id: number | string
  name?: string
  email?: string
  phone?: string
  organization_id?: number | string
  role?: string
  active?: boolean
  [key: string]: any
}

/**
 * Fetch users from Zendesk using Composio
 * @param connectionId - Composio connection ID
 * @returns Array of Zendesk users with phone numbers
 */
export async function fetchUsers(connectionId: string): Promise<ZendeskUser[]> {
  try {
    console.log('[Zendesk] Fetching users using ZENDESK_SEARCH_ZENDESK_USERS')
    
    const allUsers: ZendeskUser[] = []
    let page = 1
    const perPage = 100
    let hasMore = true
    
    while (hasMore) {
      const result = await executeZendeskAction(connectionId, 'ZENDESK_SEARCH_ZENDESK_USERS', {
        page,
        per_page: perPage,
      })

      console.log('[Zendesk] Action result:', {
        successful: result.successful,
        hasData: !!result.data,
        dataType: typeof result.data,
        error: result.error,
        page,
      })

      if (!result.successful) {
        const errorMsg = result.error || 'Failed to fetch users from Zendesk'
        console.error('[Zendesk] Action failed:', errorMsg)
        throw new Error(errorMsg)
      }

      const data = result.data
      
      // Handle different response formats
      let users: ZendeskUser[] = []
      
      if (Array.isArray(data)) {
        users = data
      } else if (data && typeof data === 'object' && 'users' in data) {
        users = (data as any).users || []
      } else if (data && typeof data === 'object' && 'data' in data) {
        users = (data as any).data || []
      } else if (data && typeof data === 'object' && 'id' in data) {
        // Single user object
        users = [data as ZendeskUser]
      }
      
      console.log(`[Zendesk] Received ${users.length} users on page ${page}`)
      allUsers.push(...users)
      
      // Check if there are more pages
      if (users.length < perPage) {
        hasMore = false
      } else {
        page++
        // Safety limit to prevent infinite loops
        if (page > 100) {
          console.warn('[Zendesk] Reached page limit of 100, stopping pagination')
          hasMore = false
        }
      }
    }
    
    // Filter to only include users with phone numbers
    const usersWithPhones = allUsers.filter((user: ZendeskUser) => {
      return user.phone && user.phone.trim().length > 0
    })
    
    console.log(`[Zendesk] Filtered to ${usersWithPhones.length} users with phone numbers out of ${allUsers.length} total`)
    return usersWithPhones
  } catch (error) {
    console.error('[Zendesk] Error fetching users:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to fetch users: ${error}`)
  }
}

/**
 * Extract and normalize phone numbers from a Zendesk user
 * Phone numbers are normalized to E.164 format (e.g., +15149791879)
 * @param user - Zendesk user object
 * @param defaultCountry - Default country code for numbers without country code (default: 'US')
 * @returns Array of normalized phone numbers in E.164 format (non-empty, deduplicated)
 */
export function extractPhoneNumbers(user: ZendeskUser, defaultCountry: string = 'US'): string[] {
  const rawPhones: string[] = []
  
  // Zendesk stores phone number in the phone field
  if (user.phone && user.phone.trim()) {
    rawPhones.push(user.phone.trim())
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
      console.warn(`[Zendesk] Could not normalize phone number: ${rawPhone}`, {
        userId: getUserId(user),
        userName: formatContactName(user),
      })
    }
  }
  
  return Array.from(normalizedPhones)
}

/**
 * Format contact name from Zendesk user
 * @param user - Zendesk user object
 * @returns Formatted name string
 */
export function formatContactName(user: ZendeskUser): string {
  if (user.name) {
    return user.name
  }
  
  // Try email as fallback
  if (user.email) {
    return user.email
  }
  
  // Try phone as last resort
  if (user.phone) {
    return user.phone
  }
  
  return `Zendesk User ${user.id}`
}

/**
 * Get the unique ID for a Zendesk user
 * @param user - Zendesk user object
 * @returns The user ID as string
 */
export function getUserId(user: ZendeskUser): string {
  return String(user.id)
}

/**
 * Get the email from a Zendesk user
 * @param user - Zendesk user object
 * @returns The email or null
 */
export function getUserEmail(user: ZendeskUser): string | null {
  return user.email || null
}

/**
 * Get the organization ID from a Zendesk user
 * @param user - Zendesk user object
 * @returns The organization ID as string or null
 */
export function getOrganizationId(user: ZendeskUser): string | null {
  return user.organization_id ? String(user.organization_id) : null
}
