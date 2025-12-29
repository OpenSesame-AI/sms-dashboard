import { NextRequest, NextResponse } from 'next/server'
import {
  getAiColumns,
  createAiColumn,
  updateAiColumn,
  deleteAiColumn,
} from '@/lib/db/queries'

export async function GET() {
  try {
    const columns = await getAiColumns()
    return NextResponse.json(columns)
  } catch (error) {
    console.error('Error fetching AI columns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI columns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { columnKey, name, prompt } = body

    if (!columnKey || !name || !prompt) {
      return NextResponse.json(
        { error: 'columnKey, name, and prompt are required' },
        { status: 400 }
      )
    }

    const column = await createAiColumn(columnKey, name, prompt)
    return NextResponse.json(column)
  } catch (error) {
    console.error('Error creating AI column:', error)
    return NextResponse.json(
      { error: 'Failed to create AI column' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { columnKey, name, prompt } = body

    if (!columnKey || !name || !prompt) {
      return NextResponse.json(
        { error: 'columnKey, name, and prompt are required' },
        { status: 400 }
      )
    }

    const column = await updateAiColumn(columnKey, name, prompt)
    
    if (!column) {
      return NextResponse.json(
        { error: 'Column not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(column)
  } catch (error) {
    console.error('Error updating AI column:', error)
    return NextResponse.json(
      { error: 'Failed to update AI column' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const columnKey = searchParams.get('columnKey')

    if (!columnKey) {
      return NextResponse.json(
        { error: 'columnKey query parameter is required' },
        { status: 400 }
      )
    }

    await deleteAiColumn(columnKey)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting AI column:', error)
    return NextResponse.json(
      { error: 'Failed to delete AI column' },
      { status: 500 }
    )
  }
}




