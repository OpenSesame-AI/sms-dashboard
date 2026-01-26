import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { updateMessageTemplate, deleteMessageTemplate } from '@/lib/db/queries'

export async function PUT(
  request: Request,
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
        { error: 'Missing template ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, content } = body

    const updateData: { name?: string; content?: string } = {}
    
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Invalid field: name must be a non-empty string' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        return NextResponse.json(
          { error: 'Invalid field: content must be a non-empty string' },
          { status: 400 }
        )
      }
      updateData.content = content.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const template = await updateMessageTemplate(id, updateData)
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error updating message template:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update message template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
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
        { error: 'Missing template ID' },
        { status: 400 }
      )
    }

    const deleted = await deleteMessageTemplate(id)
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting message template:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete message template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
