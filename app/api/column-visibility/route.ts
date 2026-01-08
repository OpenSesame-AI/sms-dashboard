import { NextRequest, NextResponse } from 'next/server'
import { getColumnVisibility, saveColumnVisibility } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cellId = searchParams.get('cellId') || undefined
    
    const visibilityState = await getColumnVisibility(cellId)
    
    return NextResponse.json(visibilityState || {})
  } catch (error) {
    console.error('Error fetching column visibility:', error)
    return NextResponse.json(
      { error: 'Failed to fetch column visibility' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { visibilityState, cellId } = body
    
    if (!visibilityState || typeof visibilityState !== 'object') {
      return NextResponse.json(
        { error: 'visibilityState is required and must be an object' },
        { status: 400 }
      )
    }
    
    await saveColumnVisibility(visibilityState, cellId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving column visibility:', error)
    return NextResponse.json(
      { error: 'Failed to save column visibility' },
      { status: 500 }
    )
  }
}

