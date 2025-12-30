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
    console.log('Applying column_colors table migration...\n')

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../drizzle/0006_add_column_colors_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Execute the migration
    await sql.unsafe(migrationSQL)

    console.log('✓ Successfully applied column_colors table migration')
    console.log('  - Created column_colors table')
    console.log('  - Added indexes for performance\n')

    // Verify the table was created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'column_colors'
    `

    if (tables.length > 0) {
      console.log('✓ Verified: column_colors table exists')
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

