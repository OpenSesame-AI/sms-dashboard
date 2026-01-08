/**
 * Composio client wrapper
 * Handles Composio SDK initialization and Salesforce integration operations
 */

import { Composio } from '@composio/core'

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY
const COMPOSIO_BASE_URL = process.env.COMPOSIO_BASE_URL

if (!COMPOSIO_API_KEY) {
  console.warn('COMPOSIO_API_KEY is not set. Composio features will not work.')
}

// Initialize Composio client
export const composio = COMPOSIO_API_KEY
  ? new Composio({
      apiKey: COMPOSIO_API_KEY,
      baseURL: COMPOSIO_BASE_URL,
    })
  : null

/**
 * Get or create Salesforce auth config
 * Returns the auth config ID for Salesforce
 */
export async function getOrCreateSalesforceAuthConfig(): Promise<string> {
  if (!composio) {
    throw new Error('Composio client not initialized. Set COMPOSIO_API_KEY environment variable.')
  }

  // Check if we have auth config ID in environment
  const authConfigId = process.env.COMPOSIO_SALESFORCE_AUTH_CONFIG_ID
  
  if (authConfigId) {
    return authConfigId
  }

  // If not in env, we'll need to create it via dashboard
  // For now, throw error asking user to set it up
  throw new Error(
    'COMPOSIO_SALESFORCE_AUTH_CONFIG_ID not set. ' +
    'Please create a Salesforce auth config in Composio dashboard and set the ID in environment variables.'
  )
}

/**
 * Initiate Salesforce connection for a user
 * @param userId - User ID (from Clerk or your system)
 * @param authConfigId - Composio auth config ID for Salesforce
 * @returns Connection request with redirect URL and request ID
 */
export async function initiateSalesforceConnection(
  userId: string,
  authConfigId: string
) {
  if (!composio) {
    throw new Error('Composio client not initialized. Set COMPOSIO_API_KEY environment variable.')
  }

  const connectionRequest = await composio.connectedAccounts.initiate(
    userId,
    authConfigId
  )

  return {
    connectionRequestId: connectionRequest.id,
    redirectUrl: connectionRequest.redirectUrl,
    connectionRequest, // Return the full request object for waiting
  }
}

/**
 * Wait for connection to complete
 * @param connectionRequest - Connection request object from initiateSalesforceConnection
 * @param timeout - Timeout in seconds (default: 60)
 * @returns Connection ID
 */
export async function waitForConnection(
  connectionRequest: any,
  timeout: number = 60
): Promise<string> {
  if (!composio) {
    throw new Error('Composio client not initialized.')
  }

  // Wait for connection to complete
  await connectionRequest.waitForConnection(timeout)
  
  // After waiting, the connectionRequest.id should be the connection ID
  return connectionRequest.id
}

/**
 * Get connection request by ID
 * Note: This may not be available in all Composio SDK versions
 * @param connectionRequestId - Connection request ID
 * @returns Connection request object
 */
export async function getConnectionRequest(connectionRequestId: string) {
  if (!composio) {
    throw new Error('Composio client not initialized.')
  }

  // Try to get connection request - API may vary
  // If this doesn't work, we'll need to store the connectionRequest object
  try {
    // This is a placeholder - actual API may differ
    return await composio.connectedAccounts.get(connectionRequestId)
  } catch {
    // If getting by ID doesn't work, we might need to list and find
    // For now, throw an error indicating we need the connectionRequest object
    throw new Error('Cannot retrieve connection request by ID. Store the connectionRequest object from initiateSalesforceConnection.')
  }
}

/**
 * Get all connections for a user
 * @param userId - User ID
 * @returns List of connections
 */
export async function getUserConnections(userId: string) {
  if (!composio) {
    throw new Error('Composio client not initialized.')
  }

  // Composio SDK expects an object with userIds (plural), not userId
  const connectionsResponse = await composio.connectedAccounts.list({ userIds: [userId] })
  
  // Handle different possible response structures
  if (Array.isArray(connectionsResponse)) {
    return connectionsResponse
  } else if (connectionsResponse && typeof connectionsResponse === 'object') {
    // Try common property names
    return (connectionsResponse as any).data || 
           (connectionsResponse as any).items || 
           (connectionsResponse as any).connections ||
           (connectionsResponse as any).results ||
           []
  }
  
  return []
}

/**
 * Get connection details
 * @param connectionId - Composio connection ID
 * @returns Connection details
 */
export async function getConnection(connectionId: string) {
  if (!composio) {
    throw new Error('Composio client not initialized.')
  }

  try {
    const connection = await composio.connectedAccounts.get(connectionId)
    
    // Log connection details for debugging
    console.log(`[Composio] getConnection result for ${connectionId}:`, {
      connectionType: typeof connection,
      isNull: connection === null,
      isUndefined: connection === undefined,
      hasStatus: connection && 'status' in connection,
      keys: connection ? Object.keys(connection) : [],
      status: connection ? (connection as any).status : undefined,
      fullObject: connection ? JSON.stringify(connection, null, 2) : 'null/undefined',
    })
    
    return connection
  } catch (error) {
    console.error(`[Composio] Error in getConnection for ${connectionId}:`, {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }
}

/**
 * Check if a connection status indicates an active connection
 * @param status - Connection status from Composio
 * @returns True if status indicates an active connection
 */
export function isConnectionStatusActive(status: string | null | undefined): boolean {
  if (!status) return false
  
  // Normalize status to uppercase for comparison
  const normalizedStatus = status.toUpperCase().trim()
  
  // Active statuses that indicate a working connection
  // Based on Composio API docs: ACTIVE, CONNECTED, ENABLED are valid active statuses
  const activeStatuses = ['ACTIVE', 'CONNECTED', 'ENABLED', 'LIVE', 'READY']
  
  // Inactive statuses that explicitly indicate a non-working connection
  const inactiveStatuses = ['INACTIVE', 'DISCONNECTED', 'DISABLED', 'EXPIRED', 'FAILED', 'REVOKED', 'PENDING', 'INITIATED']
  
  // If explicitly inactive, return false
  if (inactiveStatuses.includes(normalizedStatus)) {
    return false
  }
  
  // If explicitly active, return true
  if (activeStatuses.includes(normalizedStatus)) {
    return true
  }
  
  // If status is unknown but exists, log it for debugging
  console.warn(`[Composio] Unknown connection status: "${status}" (normalized: "${normalizedStatus}")`)
  
  // Default to false for unknown statuses
  return false
}

/**
 * Verify connection is valid and active
 * @param connectionId - Composio connection ID
 * @returns True if connection exists and has an active status
 */
export async function verifyConnection(connectionId: string): Promise<boolean> {
  try {
    const connection = await getConnection(connectionId)
    
    // Check if connection exists and has an active status
    if (!connection) {
      return false
    }
    
    return isConnectionStatusActive(connection.status)
  } catch (error) {
    console.error(`[Composio] Error verifying connection ${connectionId}:`, error)
    return false
  }
}

/**
 * Revoke/delete a connection
 * @param connectionId - Composio connection ID
 */
export async function revokeConnection(connectionId: string) {
  if (!composio) {
    throw new Error('Composio client not initialized.')
  }

  await composio.connectedAccounts.delete(connectionId)
}

/**
 * Execute a Salesforce tool/action
 * @param connectionId - Composio connection ID
 * @param actionName - Name of the Salesforce action (e.g., 'SALESFORCE_QUERY')
 * @param params - Action parameters
 * @param userId - User ID (optional, will try to get from connection if not provided)
 * @returns Action result
 */
export async function executeSalesforceAction(
  connectionId: string,
  actionName: string,
  params: Record<string, any>,
  userId?: string
) {
  if (!composio) {
    throw new Error('Composio client not initialized.')
  }

  // Get connection and toolkit info first
  const connection = await composio.connectedAccounts.get(connectionId)
  const toolkitSlug = (connection as any)?.toolkit?.slug || 'salesforce'
  
  // Get userId from connection if not provided
  if (!userId) {
    userId = (connection as any)?.userId || (connection as any)?.user?.id || 'default'
    console.log('[Composio] Using userId from connection or default:', userId)
  }
  
  // Try to get toolkit version - we need a real version, not "latest"
  let toolkitVersion: string | null = null
  let useDangerouslySkipVersionCheck = false
  
  // Try to get version from connection
  const connectionVersion = (connection as any)?.toolkit?.version
  if (connectionVersion && connectionVersion !== 'latest') {
    toolkitVersion = connectionVersion
    console.log('[Composio] Found toolkit version from connection:', toolkitVersion)
  }
  
  // Try to get version from toolkitVersions if available
  if (!toolkitVersion && (composio as any).tools?.toolkitVersions) {
    try {
      const toolkitVersions = (composio as any).tools.toolkitVersions
      // toolkitVersions might be a function or an object with methods
      if (typeof toolkitVersions === 'function') {
        const versions = await toolkitVersions(toolkitSlug)
        if (versions && Array.isArray(versions) && versions.length > 0) {
          // Get the first version (usually latest)
          const firstVersion = versions[0]
          toolkitVersion = typeof firstVersion === 'string' ? firstVersion : (firstVersion.version || firstVersion.id || null)
          if (toolkitVersion && toolkitVersion !== 'latest') {
            console.log('[Composio] Found toolkit version from toolkitVersions():', toolkitVersion)
          }
        }
      } else if (typeof toolkitVersions === 'object' && typeof toolkitVersions.get === 'function') {
        const versions = await toolkitVersions.get(toolkitSlug)
        if (versions && Array.isArray(versions) && versions.length > 0) {
          const firstVersion = versions[0]
          toolkitVersion = typeof firstVersion === 'string' ? firstVersion : (firstVersion.version || firstVersion.id || null)
          if (toolkitVersion && toolkitVersion !== 'latest') {
            console.log('[Composio] Found toolkit version from toolkitVersions.get():', toolkitVersion)
          }
        }
      }
    } catch (err) {
      console.warn('[Composio] Could not get version from toolkitVersions:', err)
    }
  }
  
  // If we still don't have a real version, we'll need to use dangerouslySkipVersionCheck
  if (!toolkitVersion || toolkitVersion === 'latest') {
    console.warn('[Composio] No specific toolkit version found, will use dangerouslySkipVersionCheck')
    useDangerouslySkipVersionCheck = true
  }

  // Try composio.tools.execute() - this is the correct method according to docs
  if ((composio as any).tools && typeof (composio as any).tools.execute === 'function') {
    try {
      // Format: execute(slug, { userId, version, arguments, connectedAccountId }, modifiers?)
      const executeBody: any = {
        userId: userId,
        arguments: params,  // Tool parameters go in 'arguments'
        connectedAccountId: connectionId,
      }
      
      if (toolkitVersion && toolkitVersion !== 'latest') {
        executeBody.version = toolkitVersion
      } else {
        // Use dangerouslySkipVersionCheck if we don't have a real version
        executeBody.dangerouslySkipVersionCheck = true
      }
      
      console.log('[Composio] Using composio.tools.execute() with format:', {
        actionName,
        userId: executeBody.userId,
        hasVersion: !!executeBody.version,
        version: executeBody.version,
        useDangerouslySkipVersionCheck: executeBody.dangerouslySkipVersionCheck,
        connectedAccountId: executeBody.connectedAccountId,
      })
      
      return await (composio as any).tools.execute(actionName, executeBody)
    } catch (err) {
      console.error('[Composio] tools.execute() failed:', err)
      throw err
    }
  }

  // If tools.execute() is not available, throw an error
  throw new Error(
    `Unable to execute Salesforce action ${actionName}. ` +
    `The Composio SDK tools.execute() method is not available. ` +
    `Please check the Composio SDK documentation for the correct way to execute actions.`
  )
}

/**
 * List available Salesforce actions/tools
 * @param connectionId - Composio connection ID (optional, for connection-specific tools)
 * @returns List of available actions
 */
export async function listSalesforceActions(connectionId?: string) {
  if (!composio) {
    throw new Error('Composio client not initialized.')
  }

  // Get all Salesforce actions from the toolkit
  // Note: The toolkit object structure may vary by SDK version
  // For now, return empty array as the exact API is unclear
  try {
    const toolkit = await composio.toolkits.get('SALESFORCE')
    // Try to access actions if available, otherwise return empty array
    return (toolkit as any)?.actions || (toolkit as any)?.tools || []
  } catch (error) {
    console.warn('[Composio] Could not get Salesforce actions:', error)
    return []
  }
}

