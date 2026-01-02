import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function applyMigration() {
  try {
    console.log('Applying available_phone_numbers table migration...\n')

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../drizzle/0009_add_available_phone_numbers.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Execute the migration
    await sql.unsafe(migrationSQL)

    console.log('✓ Successfully applied available_phone_numbers table migration')
    console.log('  - Created available_phone_numbers table\n')

    // Verify the table was created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'available_phone_numbers'
    `

    if (tables.length > 0) {
      console.log('✓ Verified: available_phone_numbers table exists')
    } else {
      console.log('⚠ Warning: Could not verify table creation')
    }

  } catch (error) {
    console.error('Error applying migration:', error)
    throw error
  } finally {
    await sql.end()
  }
}

applyMigration()
  .then(() => {
    console.log('\nMigration completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nMigration failed:', error)
    process.exit(1)
  })

