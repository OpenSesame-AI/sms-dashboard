import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  getAllCells,
  createCell,
  updateCell,
  deleteCell,
  getCellById,
  getAvailablePhoneNumber,
  removeAvailablePhoneNumber,
} from '@/lib/db/queries'
import { searchAndPurchaseNumber, configurePhoneNumberWebhooks, getPhoneNumberByNumber } from '@/lib/twilio'

export async function GET() {
  try {
    const { userId, orgId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // orgId is null for personal mode, string for org mode
    const cells = await getAllCells(userId, orgId)
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
    const { userId, orgId } = await auth()
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

    // Validate webhook URL is set before purchasing a number (fail fast)
    const smsWebhookUrl = process.env.TWILIO_SMS_WEBHOOK_URL
    const whatsappWebhookUrl = process.env.TWILIO_WHATSAPP_WEBHOOK_URL
    const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL

    if (!smsWebhookUrl) {
      return NextResponse.json(
        { 
          error: 'TWILIO_SMS_WEBHOOK_URL environment variable is not set',
          details: 'Webhook URL is required for cell functionality'
        },
        { status: 500 }
      )
    }

    // Check for available phone numbers first (from deleted cells)
    let phoneNumber: string | undefined
    let phoneNumberSid: string | undefined
    let purchasedNumber: any = null

    const availablePhoneNumber = await getAvailablePhoneNumber()
    
    if (availablePhoneNumber) {
      // Get the phone number's SID from Twilio
      try {
        const twilioNumber = await getPhoneNumberByNumber(availablePhoneNumber)
        if (!twilioNumber || !twilioNumber.sid) {
          // If number doesn't exist in Twilio, remove from available and purchase new
          await removeAvailablePhoneNumber(availablePhoneNumber)
          throw new Error(`Phone number ${availablePhoneNumber} not found in Twilio account`)
        }
        phoneNumber = availablePhoneNumber
        phoneNumberSid = twilioNumber.sid
      } catch (error) {
        console.warn(`Failed to get Twilio info for available number ${availablePhoneNumber}, purchasing new number:`, error)
        // Remove invalid number from available list and fall through to purchase
        await removeAvailablePhoneNumber(availablePhoneNumber).catch(() => {})
        // Fall through to purchase new number
        phoneNumber = undefined
        phoneNumberSid = undefined
      }
    }

    // If no available number or available number failed, purchase new one
    if (!phoneNumber || !phoneNumberSid) {
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

      if (!purchasedNumber.sid) {
        return NextResponse.json(
          { error: 'Failed to purchase phone number: No SID returned' },
          { status: 500 }
        )
      }

      phoneNumber = purchasedNumber.phoneNumber
      phoneNumberSid = purchasedNumber.sid
    }

    // Configure webhook URLs for the phone number
    // This is required for the cell to function, so failures should abort cell creation
    if (!phoneNumberSid) {
      return NextResponse.json(
        { error: 'Failed to get phone number SID' },
        { status: 500 }
      )
    }
    
    let updatedNumber
    try {
      updatedNumber = await configurePhoneNumberWebhooks(
        phoneNumberSid,
        smsWebhookUrl,
        statusCallbackUrl,
        whatsappWebhookUrl
      )
    } catch (error) {
      console.error('Error configuring webhook URLs:', error)
      // If we used an available number, put it back in the available list
      if (availablePhoneNumber && phoneNumber === availablePhoneNumber) {
        // Don't re-add if it was invalid, it's already removed
      }
      return NextResponse.json(
        { 
          error: 'Failed to configure webhook URLs',
          details: error instanceof Error ? error.message : 'Unknown error',
          phoneNumber: phoneNumber
        },
        { status: 500 }
      )
    }

    // Remove from available numbers if we used one
    if (availablePhoneNumber && phoneNumber === availablePhoneNumber) {
      await removeAvailablePhoneNumber(phoneNumber).catch((error) => {
        console.warn(`Failed to remove ${phoneNumber} from available numbers:`, error)
        // Don't fail cell creation if this fails
      })
    }

    // Create the cell with the phone number
    // orgId is null for personal mode, string for org mode
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Failed to get phone number' },
        { status: 500 }
      )
    }
    
    const cell = await createCell(phoneNumber, name, userId, undefined, orgId)
    
    // Return cell with webhook configuration status
    return NextResponse.json({
      ...cell,
      webhook: {
        smsUrl: updatedNumber.smsUrl,
        whatsappUrl: (updatedNumber as any).whatsappUrl || null,
        statusCallback: updatedNumber.statusCallback || null,
      }
    }, { status: 201 })
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
    const { userId, orgId } = await auth()
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

    // orgId is null for personal mode, string for org mode
    const cell = await updateCell(id, name, userId, phoneNumber, systemPrompt, orgId)
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
    const { userId, orgId } = await auth()
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

    // orgId is null for personal mode, string for org mode
    await deleteCell(id, userId, orgId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cell:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete cell',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

