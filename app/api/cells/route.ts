import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getAllCells,
  createCell,
  updateCell,
  deleteCell,
  getCellById,
} from '@/lib/db/queries'
import { searchAndPurchaseNumber, configurePhoneNumberWebhooks } from '@/lib/twilio'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const cells = await getAllCells(userId)
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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    // Configure webhook URLs for the purchased phone number
    const smsWebhookUrl = process.env.TWILIO_SMS_WEBHOOK_URL
    const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL

    if (smsWebhookUrl && purchasedNumber.sid) {
      try {
        await configurePhoneNumberWebhooks(
          purchasedNumber.sid,
          smsWebhookUrl,
          statusCallbackUrl
        )
      } catch (error) {
        // Log the error but don't fail cell creation
        console.warn(
          `Failed to configure webhook URLs for phone number ${purchasedNumber.phoneNumber}:`,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    } else if (!smsWebhookUrl) {
      console.warn(
        `TWILIO_SMS_WEBHOOK_URL not set. Webhook URLs not configured for phone number ${purchasedNumber.phoneNumber}`
      )
    }

    // Create the cell with the purchased phone number
    const cell = await createCell(purchasedNumber.phoneNumber, name, userId)
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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, name, phoneNumber, systemPrompt } = body

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: id, name' },
        { status: 400 }
      )
    }

    const cell = await updateCell(id, name, userId, phoneNumber, systemPrompt)
    if (!cell) {
      return NextResponse.json(
        { error: 'Cell not found or access denied' },
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
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      )
    }

    await deleteCell(id, userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cell:', error)
    return NextResponse.json(
      { error: 'Failed to delete cell' },
      { status: 500 }
    )
  }
}

