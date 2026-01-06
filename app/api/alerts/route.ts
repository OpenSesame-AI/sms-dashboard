import { NextRequest, NextResponse } from 'next/server'
import { getAiAlerts, createAiAlert, updateAiAlert, deleteAiAlert, getAiAlertById } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cellId = searchParams.get('cellId') || undefined
    
    const alerts = await getAiAlerts(cellId)
    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, condition, cellId } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!type || (type !== 'ai' && type !== 'keyword')) {
      return NextResponse.json(
        { error: 'type must be either "ai" or "keyword"' },
        { status: 400 }
      )
    }

    if (!condition || typeof condition !== 'string' || !condition.trim()) {
      return NextResponse.json(
        { error: 'condition is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const alert = await createAiAlert(name.trim(), type, condition.trim(), cellId)
    return NextResponse.json(alert)
  } catch (error) {
    console.error('Error creating alert:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create alert', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type, condition, enabled } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    if (type && type !== 'ai' && type !== 'keyword') {
      return NextResponse.json(
        { error: 'type must be either "ai" or "keyword"' },
        { status: 400 }
      )
    }

    const alert = await updateAiAlert(
      id,
      name?.trim(),
      type,
      condition?.trim(),
      enabled
    )

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(alert)
  } catch (error) {
    console.error('Error updating alert:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to update alert', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      )
    }

    const alert = await getAiAlertById(id)
    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    await deleteAiAlert(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting alert:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to delete alert', details: errorMessage },
      { status: 500 }
    )
  }
}


