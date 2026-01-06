import { NextRequest, NextResponse } from 'next/server'
import { configureWebhooksByPhoneNumber } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Missing required field: phoneNumber' },
        { status: 400 }
      )
    }

    const smsWebhookUrl = process.env.TWILIO_SMS_WEBHOOK_URL
    const whatsappWebhookUrl = process.env.TWILIO_WHATSAPP_WEBHOOK_URL
    const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL

    if (!smsWebhookUrl) {
      return NextResponse.json(
        { error: 'TWILIO_SMS_WEBHOOK_URL environment variable is not set' },
        { status: 500 }
      )
    }

    try {
      const updatedNumber = await configureWebhooksByPhoneNumber(
        phoneNumber,
        smsWebhookUrl,
        statusCallbackUrl,
        whatsappWebhookUrl
      )

      return NextResponse.json({
        success: true,
        phoneNumber: updatedNumber.phoneNumber,
        smsUrl: updatedNumber.smsUrl,
        whatsappUrl: (updatedNumber as any).whatsappUrl || null,
        statusCallback: updatedNumber.statusCallback,
      })
    } catch (error) {
      console.error('Error configuring webhooks:', error)
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Failed to configure webhooks',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in configure-webhook route:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process request',
      },
      { status: 500 }
    )
  }
}

