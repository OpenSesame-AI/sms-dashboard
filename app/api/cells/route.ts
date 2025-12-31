import { NextResponse } from 'next/server'
import {
  getAllCells,
  createCell,
  updateCell,
  deleteCell,
  getCellById,
} from '@/lib/db/queries'
import { searchAndPurchaseNumber } from '@/lib/twilio'

export async function GET() {
  try {
    const cells = await getAllCells()
    return NextResponse.json(cells)
  } catch (error) {
    console.error('Error fetching cells:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cells' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, country = 'US' } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    // Auto-purchase a phone number from Twilio
    let purchasedNumber
    try {
      purchasedNumber = await searchAndPurchaseNumber(country, {
        smsEnabled: true,
        voiceEnabled: true,
      })
    } catch (error) {
      console.error('Error purchasing phone number:', error)
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Failed to purchase phone number',
          details: 'Please ensure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set correctly'
        },
        { status: 500 }
      )
    }

    if (!purchasedNumber.phoneNumber) {
      return NextResponse.json(
        { error: 'Failed to purchase phone number: No phone number returned' },
        { status: 500 }
      )
    }

    // Create the cell with the purchased phone number
    const cell = await createCell(purchasedNumber.phoneNumber, name)
    return NextResponse.json(cell, { status: 201 })
  } catch (error) {
    console.error('Error creating cell:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create cell'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, name, phoneNumber, systemPrompt } = body

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name' },
        { status: 400 }
      )
    }

    const cell = await updateCell(id, name, phoneNumber, systemPrompt)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(cell)
  } catch (error) {
    console.error('Error updating cell:', error)
    return NextResponse.json(
      { error: 'Failed to update cell' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      )
    }

    await deleteCell(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cell:', error)
    return NextResponse.json(
      { error: 'Failed to delete cell' },
      { status: 500 }
    )
  }
}

