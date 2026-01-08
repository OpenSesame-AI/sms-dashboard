import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  createApiKey,
  getApiKeysByCell,
  deleteApiKey,
  getCellById,
  getApiKeyById,
  getAllCells,
} from '@/lib/db/queries'

/**
 * POST /api/api-keys
 * Create a new API key for a cell
 * Requires Clerk authentication and cell ownership
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { cellId, name } = body

    if (!cellId || typeof cellId !== 'string') {
      return NextResponse.json(
        { error: 'cellId is required' },
        { status: 400 }
      )
    }

    // Verify user has access to the cell
    const cell = await getCellById(cellId, userId, orgId)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
        { status: 404 }
      )
    }

    // Create the API key
    const result = await createApiKey(cellId, name || null, userId)

    // Return the key (only shown once)
    return NextResponse.json({
      id: result.id,
      key: result.key,
      name: result.name,
      createdAt: result.createdAt,
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to create API key',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/api-keys?cellId=<uuid>
 * List API keys for user's cells
 * Requires Clerk authentication
 * Optional cellId query parameter to filter by cell
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const cellId = searchParams.get('cellId')

    // If cellId is provided, verify ownership and return keys for that cell
    if (cellId) {
      const cell = await getCellById(cellId, userId, orgId)
      if (!cell) {
        return NextResponse.json(
          { error: 'Cell not found or access denied' },
          { status: 404 }
        )
      }

      const keys = await getApiKeysByCell(cellId)
      return NextResponse.json(keys)
    }

    // Otherwise, get all cells for the user and return all their keys
    const cells = await getAllCells(userId, orgId)
    
    const allKeys = []
    for (const cell of cells) {
      const keys = await getApiKeysByCell(cell.id)
      allKeys.push(...keys)
    }

    return NextResponse.json(allKeys)
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/api-keys
 * Revoke an API key
 * Requires Clerk authentication and cell ownership
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { keyId } = body

    if (!keyId || typeof keyId !== 'string') {
      return NextResponse.json(
        { error: 'keyId is required' },
        { status: 400 }
      )
    }

    // Get the API key to find its cell
    const keyRecord = await getApiKeyById(keyId)
    
    if (!keyRecord) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      )
    }

    // Verify cell ownership
    const cell = await getCellById(keyRecord.cellId, userId, orgId)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the API key
    const deleted = await deleteApiKey(keyId, keyRecord.cellId)
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}

