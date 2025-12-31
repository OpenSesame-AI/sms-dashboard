import * as dotenv from 'dotenv'
import * as path from 'path'
import { configureWebhooksByPhoneNumber } from '../lib/twilio'

const envPath = path.resolve(process.cwd(), '.env.local')
console.log(`Loading environment from: ${envPath}`)
const result = dotenv.config({ path: envPath })

if (result.error) {
  console.warn(`Warning: Could not load .env.local: ${result.error.message}`)
} else {
  console.log(`✓ Loaded .env.local file`)
}

async function configureWebhook() {
  const phoneNumber = '+14846002057'
  const smsWebhookUrl = process.env.TWILIO_SMS_WEBHOOK_URL
  const statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK_URL

  console.log(`TWILIO_SMS_WEBHOOK_URL: ${smsWebhookUrl || '(not set)'}`)
  console.log(`TWILIO_STATUS_CALLBACK_URL: ${statusCallbackUrl || '(not set)'}`)

  if (!smsWebhookUrl) {
    console.error('❌ TWILIO_SMS_WEBHOOK_URL environment variable is not set')
    process.exit(1)
  }

  try {
    console.log(`Configuring webhooks for phone number: ${phoneNumber}`)
    console.log(`SMS Webhook URL: ${smsWebhookUrl}`)
    if (statusCallbackUrl) {
      console.log(`Status Callback URL: ${statusCallbackUrl}`)
    } else {
      console.log('Status Callback URL: (not set)')
    }

    const updatedNumber = await configureWebhooksByPhoneNumber(
      phoneNumber,
      smsWebhookUrl,
      statusCallbackUrl
    )

    console.log('✓ Successfully configured webhook URLs')
    console.log(`  Phone Number: ${updatedNumber.phoneNumber}`)
    console.log(`  SMS URL: ${updatedNumber.smsUrl || '(not set)'}`)
    console.log(`  Status Callback URL: ${updatedNumber.statusCallback || '(not set)'}`)
  } catch (error) {
    console.error('❌ Error configuring webhooks:', error)
    process.exit(1)
  }
}

configureWebhook()

