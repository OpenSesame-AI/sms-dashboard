import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function checkPhoneMapping() {
  try {
    const phoneNumber = '+15149791879'
    console.log(`Checking phone number: ${phoneNumber}\n`)

    // Check phone_user_mappings
    const mappings = await sql`
      SELECT 
        id,
        phone_number,
        user_id,
        cell_id,
        created_at,
        updated_at
      FROM phone_user_mappings
      WHERE phone_number = ${phoneNumber}
      ORDER BY created_at DESC
    `

    console.log(`Found ${mappings.length} phone_user_mapping(s):\n`)
    mappings.forEach((mapping: any, index: number) => {
      console.log(`Mapping ${index + 1}:`)
      console.log(`  ID: ${mapping.id}`)
      console.log(`  Phone Number: ${mapping.phone_number}`)
      console.log(`  User ID: ${mapping.user_id}`)
      console.log(`  Cell ID: ${mapping.cell_id || 'NULL'}`)
      console.log(`  Created: ${mapping.created_at}`)
      console.log(`  Updated: ${mapping.updated_at}`)
      console.log('')
    })

    // Check all messages for this phone number
    const allMessages = await sql`
      SELECT 
        id,
        cell_id,
        direction,
        message_body,
        timestamp,
        status
      FROM sms_conversations
      WHERE phone_number = ${phoneNumber}
      ORDER BY timestamp DESC
      LIMIT 10
    `

    console.log(`\nLast 10 messages for this phone number:\n`)
    allMessages.forEach((msg: any, index: number) => {
      console.log(`Message ${index + 1}:`)
      console.log(`  ID: ${msg.id}`)
      console.log(`  Cell ID: ${msg.cell_id || 'NULL'}`)
      console.log(`  Direction: ${msg.direction}`)
      console.log(`  Message: ${msg.message_body.substring(0, 50)}${msg.message_body.length > 50 ? '...' : ''}`)
      console.log(`  Timestamp: ${msg.timestamp}`)
      console.log(`  Status: ${msg.status || 'NULL'}`)
      console.log('')
    })

    // Check if there are messages with NULL cell_id
    const nullCellMessages = await sql`
      SELECT COUNT(*)::int as count
      FROM sms_conversations
      WHERE phone_number = ${phoneNumber}
        AND cell_id IS NULL
    `
    console.log(`\nMessages with NULL cell_id: ${nullCellMessages[0].count}`)

    // Check if there are messages with a cell_id
    const withCellMessages = await sql`
      SELECT COUNT(*)::int as count
      FROM sms_conversations
      WHERE phone_number = ${phoneNumber}
        AND cell_id IS NOT NULL
    `
    console.log(`Messages with a cell_id: ${withCellMessages[0].count}`)

  } catch (error) {
    console.error('Error checking phone mapping:', error)
  } finally {
    await sql.end()
  }
}

checkPhoneMapping()

