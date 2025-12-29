import { NextRequest, NextResponse } from 'next/server'
import { getContacts } from '@/lib/data'

// Timeout wrapper to prevent indefinite hangs
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ])
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cellId = searchParams.get('cellId') || undefined
    
    // Add 30 second timeout to prevent indefinite hangs
    const contacts = await withTimeout(getContacts(cellId || undefined), 30000)
    
    return NextResponse.json(contacts, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[API] Error fetching contacts:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: errorMessage },
      { status: 500 }
    )
  }
}

