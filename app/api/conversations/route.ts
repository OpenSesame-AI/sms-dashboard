import { NextRequest, NextResponse } from 'next/server'
import { getConversationsByPhoneNumber } from '@/lib/data'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const phoneNumber = searchParams.get('phoneNumber')
  const cellId = searchParams.get('cellId') || undefined

  if (!phoneNumber) {
    return NextResponse.json(
      { error: 'phoneNumber query parameter is required' },
      { status: 400 }
    )
  }

  try {
    const conversations = await getConversationsByPhoneNumber(phoneNumber, cellId)
    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

