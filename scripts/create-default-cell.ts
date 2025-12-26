import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function createDefaultCell() {
  try {
    console.log('Checking for existing data with phone number +16726480576...')

    // Check if cell already exists
    const existingCell = await sql`
      SELECT * FROM cells WHERE phone_number = '+16726480576'
    `

    if (existingCell.length > 0) {
      console.log('✓ Cell with phone number +16726480576 already exists')
      console.log(`  ID: ${existingCell[0].id}`)
      console.log(`  Name: ${existingCell[0].name}`)
      console.log(`  User ID: ${existingCell[0].user_id}`)
      await sql.end()
      return
    }

    // Find the userId associated with this phone number in smsConversations
    const userIdFromConversations = await sql`
      SELECT DISTINCT user_id 
      FROM sms_conversations 
      WHERE phone_number = '+16726480576'
      LIMIT 1
    `

    // If not found in conversations, check phone_user_mappings
    let userId: string | null = null
    if (userIdFromConversations.length > 0) {
      userId = userIdFromConversations[0].user_id
      console.log(`Found userId from sms_conversations: ${userId}`)
    } else {
      const userIdFromMappings = await sql`
        SELECT DISTINCT user_id 
        FROM phone_user_mappings 
        WHERE phone_number = '+16726480576'
        LIMIT 1
      `
      if (userIdFromMappings.length > 0) {
        userId = userIdFromMappings[0].user_id
        console.log(`Found userId from phone_user_mappings: ${userId}`)
      }
    }

    if (!userId) {
      console.log('⚠ No userId found for phone number +16726480576')
      console.log('Creating cell with a default userId...')
      // Create with a default userId - you may need to update this
      userId = 'default-user-id'
    }

    // Create the cell
    const newCell = await sql`
      INSERT INTO cells (phone_number, name, user_id)
      VALUES ('+16726480576', 'Default Cell', ${userId})
      RETURNING *
    `

    console.log('✓ Created default cell:')
    console.log(`  ID: ${newCell[0].id}`)
    console.log(`  Name: ${newCell[0].name}`)
    console.log(`  Phone Number: ${newCell[0].phone_number}`)
    console.log(`  User ID: ${newCell[0].user_id}`)
  } catch (error) {
    console.error('Error creating default cell:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

createDefaultCell()


