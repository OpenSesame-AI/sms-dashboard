import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function migrateCellId() {
  try {
    console.log('Starting cell_id migration...\n')

    // Step 1: Remove user_id column from cells table (if it exists)
    console.log('Step 1: Updating cells table...')
    try {
      await sql`ALTER TABLE cells DROP COLUMN IF EXISTS user_id`
      console.log('✓ Removed user_id column from cells table')
    } catch (error: any) {
      if (!error.message.includes('does not exist')) {
        throw error
      }
      console.log('✓ user_id column does not exist (already removed)')
    }

    // Step 2: Get the cell ID for phone number +16726480576
    console.log('\nStep 2: Finding cell with phone number +16726480576...')
    const cell = await sql`
      SELECT id FROM cells WHERE phone_number = '+16726480576' LIMIT 1
    `

    if (cell.length === 0) {
      throw new Error('Cell with phone number +16726480576 not found. Please create it first.')
    }

    const cellId = cell[0].id
    console.log(`✓ Found cell ID: ${cellId}`)

    // Step 3: Add cell_id column to sms_conversations
    console.log('\nStep 3: Adding cell_id to sms_conversations...')
    try {
      await sql`
        ALTER TABLE sms_conversations 
        ADD COLUMN IF NOT EXISTS cell_id uuid REFERENCES cells(id)
      `
      console.log('✓ Added cell_id column to sms_conversations')
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error
      }
      console.log('✓ cell_id column already exists in sms_conversations')
    }

    // Step 4: Add cell_id column to phone_user_mappings
    console.log('\nStep 4: Adding cell_id to phone_user_mappings...')
    try {
      await sql`
        ALTER TABLE phone_user_mappings 
        ADD COLUMN IF NOT EXISTS cell_id uuid REFERENCES cells(id)
      `
      console.log('✓ Added cell_id column to phone_user_mappings')
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error
      }
      console.log('✓ cell_id column already exists in phone_user_mappings')
    }

    // Step 5: Update existing sms_conversations records
    console.log('\nStep 5: Updating existing sms_conversations records...')
    const conversationsUpdated = await sql`
      UPDATE sms_conversations 
      SET cell_id = ${cellId}
      WHERE cell_id IS NULL
    `
    console.log(`✓ Updated ${conversationsUpdated.count} conversation records`)

    // Step 6: Update existing phone_user_mappings records
    console.log('\nStep 6: Updating existing phone_user_mappings records...')
    const mappingsUpdated = await sql`
      UPDATE phone_user_mappings 
      SET cell_id = ${cellId}
      WHERE cell_id IS NULL
    `
    console.log(`✓ Updated ${mappingsUpdated.count} phone_user_mapping records`)

    console.log('\n✓ Migration completed successfully!')
  } catch (error) {
    console.error('Error during migration:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

migrateCellId()








