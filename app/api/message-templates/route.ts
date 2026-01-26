import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getMessageTemplates, createMessageTemplate } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only fetch global templates (cellId is null)
    const templates = await getMessageTemplates()
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Error fetching message templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch message templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, content } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid required field: name' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Missing or invalid required field: content' },
        { status: 400 }
      )
    }

    // Always create global templates (cellId = null)
    const template = await createMessageTemplate({
      name: name.trim(),
      content: content.trim(),
      cellId: null,
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Error creating message template:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create message template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
