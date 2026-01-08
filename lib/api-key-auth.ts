import { NextRequest } from 'next/server'
import { getApiKeyByKey, updateApiKeyLastUsed, getCellById } from '@/lib/db/queries'

export interface ApiKeyAuthResult {
  cellId: string
  cell: {
    id: string
    phoneNumber: string
    name: string
  }
}

/**
 * Extract API key from request headers
 * Supports both Authorization: Bearer <key> and X-API-Key: <key>
 */
function extractApiKey(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7).trim()
  }
  
  // Try X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key')
  if (apiKeyHeader) {
    return apiKeyHeader.trim()
  }
  
  return null
}

/**
 * Validate API key from request and return cell information
 * Throws an error if the key is invalid
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyAuthResult> {
  const apiKey = extractApiKey(request)
  
  if (!apiKey) {
    throw new Error('API key is required. Provide it via Authorization: Bearer <key> or X-API-Key: <key> header')
  }
  
  // Validate key format
  if (!apiKey.startsWith('sk_live_')) {
    throw new Error('Invalid API key format')
  }
  
  // Look up the key in the database
  const keyRecord = await getApiKeyByKey(apiKey)
  
  if (!keyRecord) {
    throw new Error('Invalid API key')
  }
  
  // Get cell information
  const cell = await getCellById(keyRecord.cellId)
  
  if (!cell) {
    throw new Error('Cell associated with API key not found')
  }
  
  // Update last used timestamp (fire and forget)
  updateApiKeyLastUsed(keyRecord.id).catch((err) => {
    console.error('Failed to update API key last used timestamp:', err)
  })
  
  return {
    cellId: keyRecord.cellId,
    cell: {
      id: cell.id,
      phoneNumber: cell.phoneNumber,
      name: cell.name,
    },
  }
}

