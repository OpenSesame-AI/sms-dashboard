import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function applyMigration() {
  try {
    console.log('Adding channel column to sms_conversations table...')

    // Check if channel column exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sms_conversations' AND column_name = 'channel'
    `

    if (columnExists.length === 0) {
      // Add channel column with default value
      await sql`
        ALTER TABLE sms_conversations ADD COLUMN channel varchar NOT NULL DEFAULT 'sms'
      `
      console.log('✓ Added channel column to sms_conversations table')
      console.log('✓ Column defaults to "sms" for backward compatibility')
    } else {
      console.log('✓ channel column already exists')
    }

    // Ensure all existing records have channel = 'sms'
    const updated = await sql`
      UPDATE sms_conversations SET channel = 'sms' WHERE channel IS NULL
    `
    console.log(`✓ Updated ${updated.count} existing records to have channel = 'sms'`)

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

applyMigration()

