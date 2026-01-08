import { NextRequest, NextResponse } from 'next/server'
import { getColumnColors, saveColumnColor, deleteColumnColor } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cellId = searchParams.get('cellId') || undefined
    
    const colors = await getColumnColors(cellId)
    
    // Convert to a map for easier lookup
    const colorMap: Record<string, string> = {}
    colors.forEach((color) => {
      colorMap[color.columnId] = color.color
    })
    
    return NextResponse.json(colorMap)
  } catch (error) {
    console.error('Error fetching column colors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch column colors' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { columnId, color, cellId } = body
    
    if (!columnId) {
      return NextResponse.json(
        { error: 'columnId is required' },
        { status: 400 }
      )
    }
    
    if (color === '' || color === null || color === undefined) {
      // Delete the color if it's empty
      await deleteColumnColor(columnId, cellId)
      return NextResponse.json({ success: true })
    }
    
    await saveColumnColor(columnId, color, cellId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving column color:', error)
    return NextResponse.json(
      { error: 'Failed to save column color' },
      { status: 500 }
    )
  }
}





