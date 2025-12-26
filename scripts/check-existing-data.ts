import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function checkExistingData() {
  try {
    console.log('Checking existing data in database...\n')

    // Check sms_conversations
    const conversations = await sql`
      SELECT DISTINCT user_id, phone_number, COUNT(*) as count
      FROM sms_conversations
      GROUP BY user_id, phone_number
      ORDER BY count DESC
      LIMIT 10
    `
    console.log('SMS Conversations (top 10):')
    conversations.forEach((row: any) => {
      console.log(`  User ID: ${row.user_id}, Phone: ${row.phone_number}, Count: ${row.count}`)
    })

    console.log('\n')

    // Check phone_user_mappings
    const mappings = await sql`
      SELECT user_id, phone_number
      FROM phone_user_mappings
      LIMIT 10
    `
    console.log('Phone User Mappings:')
    mappings.forEach((row: any) => {
      console.log(`  User ID: ${row.user_id}, Phone: ${row.phone_number}`)
    })

    console.log('\n')

    // Check for phone number variations
    const phoneVariations = [
      '+16726480576',
      '16726480576',
      '+1 672 648 0576',
      '(672) 648-0576',
    ]

    console.log('Checking for phone number variations:')
    for (const phone of phoneVariations) {
      const found = await sql`
        SELECT DISTINCT user_id 
        FROM sms_conversations 
        WHERE phone_number LIKE ${`%${phone.replace(/\D/g, '')}%`}
        LIMIT 1
      `
      if (found.length > 0) {
        console.log(`  Found: ${phone} -> User ID: ${found[0].user_id}`)
      }
    }

    // Check existing cells
    const cells = await sql`SELECT * FROM cells`
    console.log('\nExisting cells:')
    cells.forEach((cell: any) => {
      console.log(`  ID: ${cell.id}, Name: ${cell.name}, Phone: ${cell.phone_number}, User ID: ${cell.user_id}`)
    })

  } catch (error) {
    console.error('Error checking data:', error)
  } finally {
    await sql.end()
  }
}

checkExistingData()


