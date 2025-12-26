import { NextRequest, NextResponse } from 'next/server'
import { getAiResults, saveAiResults } from '@/lib/db/queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const columnKey = searchParams.get('columnKey')

    if (!columnKey) {
      return NextResponse.json(
        { error: 'columnKey query parameter is required' },
        { status: 400 }
      )
    }

    const results = await getAiResults(columnKey)
    
    // Transform to map format for easier consumption
    const resultsMap: Record<string, string | null> = {}
    results.forEach((result) => {
      resultsMap[result.phoneNumber] = result.result
    })

    return NextResponse.json(resultsMap)
  } catch (error) {
    console.error('Error fetching AI results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI results' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { columnKey, results } = body

    if (!columnKey || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'columnKey and results array are required' },
        { status: 400 }
      )
    }

    await saveAiResults(columnKey, results)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving AI results:', error)
    return NextResponse.json(
      { error: 'Failed to save AI results' },
      { status: 500 }
    )
  }
}


