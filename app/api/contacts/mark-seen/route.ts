import { NextRequest, NextResponse } from 'next/server'
import { markContactAsSeen } from '@/lib/db/queries'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, lastSeenActivity, cellId } = body

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'phoneNumber is required and must be a string' },
        { status: 400 }
      )
    }

    if (!lastSeenActivity || typeof lastSeenActivity !== 'string') {
      return NextResponse.json(
        { error: 'lastSeenActivity is required and must be a string' },
        { status: 400 }
      )
    }

    // Parse the formatted datetime string (format: "YYYY-MM-DD HH:MM")
    // Convert to ISO string for storage
    let timestampToStore: string = lastSeenActivity
    try {
      // Try parsing the formatted string "YYYY-MM-DD HH:MM"
      const [datePart, timePart] = lastSeenActivity.split(' ')
      if (datePart && timePart) {
        const [year, month, day] = datePart.split('-')
        const [hour, minute] = timePart.split(':')
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1, // Month is 0-indexed
          parseInt(day),
          parseInt(hour),
          parseInt(minute)
        )
        if (!isNaN(date.getTime())) {
          timestampToStore = date.toISOString()
        }
      }
    } catch (parseError) {
      // If parsing fails, try using the string as-is (might already be ISO format)
      console.warn('Could not parse lastSeenActivity, using as-is:', parseError)
    }

    const result = await markContactAsSeen(phoneNumber, timestampToStore, cellId)

    return NextResponse.json({ 
      success: true,
      seenState: result
    })
  } catch (error) {
    console.error('Error marking contact as seen:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to mark contact as seen', details: errorMessage },
      { status: 500 }
    )
  }
}

