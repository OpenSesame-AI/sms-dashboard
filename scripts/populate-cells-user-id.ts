import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

// Replace with your user ID
const USER_ID = 'user_37HF4zAsghfErDjYXVUyEzROrQV'

async function populateUserIds() {
  try {
    console.log('Populating user_id for existing cells...')

    // Check how many cells need user_id
    const cellsToUpdate = await sql`
      SELECT COUNT(*) as count
      FROM cells
      WHERE user_id IS NULL
    `

    const count = Number(cellsToUpdate[0].count)
    console.log(`Found ${count} cells without user_id`)

    if (count === 0) {
      console.log('✓ All cells already have user_id assigned')
      return
    }

    // Update all cells without user_id
    const result = await sql`
      UPDATE cells
      SET user_id = ${USER_ID}
      WHERE user_id IS NULL
    `

    console.log(`✓ Updated ${count} cells with user_id: ${USER_ID}`)

    // Verify the update
    const remaining = await sql`
      SELECT COUNT(*) as count
      FROM cells
      WHERE user_id IS NULL
    `

    const remainingCount = Number(remaining[0].count)
    if (remainingCount === 0) {
      console.log('✓ All cells now have user_id assigned')
      
      // Optionally make user_id NOT NULL
      console.log('Making user_id NOT NULL...')
      await sql`
        ALTER TABLE cells 
        ALTER COLUMN user_id SET NOT NULL
      `
      console.log('✓ user_id is now NOT NULL')
    } else {
      console.log(`⚠ Warning: ${remainingCount} cells still have NULL user_id`)
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error populating user IDs:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

populateUserIds()


