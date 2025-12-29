import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function updateDefaultCell() {
  try {
    console.log('Updating default cell for phone number +16726480576...\n')

    // Check if cell exists
    const existingCell = await sql`
      SELECT * FROM cells WHERE phone_number = '+16726480576'
    `

    if (existingCell.length === 0) {
      console.log('Cell does not exist. Creating it...')
      
      // Get the most common userId to use as default
      const mostCommonUserId = await sql`
        SELECT user_id, COUNT(*) as count
        FROM sms_conversations
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 1
      `

      const userId = mostCommonUserId.length > 0 
        ? mostCommonUserId[0].user_id 
        : 'default-user-id'

      const newCell = await sql`
        INSERT INTO cells (phone_number, name, user_id)
        VALUES ('+16726480576', 'Default Cell', ${userId})
        RETURNING *
      `

      console.log('✓ Created cell:')
      console.log(`  ID: ${newCell[0].id}`)
      console.log(`  Name: ${newCell[0].name}`)
      console.log(`  Phone Number: ${newCell[0].phone_number}`)
      console.log(`  User ID: ${newCell[0].user_id}`)
    } else {
      const cell = existingCell[0]
      console.log('Current cell:')
      console.log(`  ID: ${cell.id}`)
      console.log(`  Name: ${cell.name}`)
      console.log(`  Phone Number: ${cell.phone_number}`)
      console.log(`  User ID: ${cell.user_id}`)

      // If userId is default, try to update it with the most common userId
      if (cell.user_id === 'default-user-id') {
        const mostCommonUserId = await sql`
          SELECT user_id, COUNT(*) as count
          FROM sms_conversations
          GROUP BY user_id
          ORDER BY count DESC
          LIMIT 1
        `

        if (mostCommonUserId.length > 0) {
          const newUserId = mostCommonUserId[0].user_id
          console.log(`\nUpdating userId from 'default-user-id' to '${newUserId}'...`)
          
          await sql`
            UPDATE cells
            SET user_id = ${newUserId}, updated_at = now()
            WHERE id = ${cell.id}
          `

          console.log('✓ Updated cell userId')
        } else {
          console.log('\n⚠ No userId found in database. Keeping default.')
        }
      }
    }

    // Show final state
    const finalCell = await sql`
      SELECT * FROM cells WHERE phone_number = '+16726480576'
    `
    
    if (finalCell.length > 0) {
      console.log('\nFinal cell state:')
      console.log(`  ID: ${finalCell[0].id}`)
      console.log(`  Name: ${finalCell[0].name}`)
      console.log(`  Phone Number: ${finalCell[0].phone_number}`)
      console.log(`  User ID: ${finalCell[0].user_id}`)
    }

  } catch (error) {
    console.error('Error updating cell:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

updateDefaultCell()




