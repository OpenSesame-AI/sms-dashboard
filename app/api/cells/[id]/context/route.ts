import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getCellContext,
  addCellContext,
  deleteCellContext,
  getCellById,
} from '@/lib/db/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Cell ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const cell = await getCellById(id, userId)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
        { status: 404 }
      )
    }

    const contextItems = await getCellContext(id)
    return NextResponse.json(contextItems)
  } catch (error) {
    console.error('Error fetching cell context:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cell context' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { type, name, content, mimeType, fileSize } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Cell ID is required' },
        { status: 400 }
      )
    }

    // Verify ownership
    const cell = await getCellById(id, userId)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
        { status: 404 }
      )
    }

    if (!type || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: type, name' },
        { status: 400 }
      )
    }

    if (type !== 'text' && type !== 'file') {
      return NextResponse.json(
        { error: 'Type must be either "text" or "file"' },
        { status: 400 }
      )
    }

    if (type === 'file' && !mimeType) {
      return NextResponse.json(
        { error: 'mimeType is required for file type' },
        { status: 400 }
      )
    }

    // Validate file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    if (type === 'file' && fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    const contextItem = await addCellContext(
      id,
      type,
      name,
      content || null,
      mimeType || null,
      fileSize || null
    )

    return NextResponse.json(contextItem, { status: 201 })
  } catch (error) {
    console.error('Error adding cell context:', error)
    return NextResponse.json(
      { error: 'Failed to add cell context' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const contextId = searchParams.get('contextId')

    if (!contextId) {
      return NextResponse.json(
        { error: 'Missing required parameter: contextId' },
        { status: 400 }
      )
    }

    // Verify ownership
    const cell = await getCellById(id, userId)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
        { status: 404 }
      )
    }

    await deleteCellContext(contextId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cell context:', error)
    return NextResponse.json(
      { error: 'Failed to delete cell context' },
      { status: 500 }
    )
  }
}

