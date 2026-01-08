import postgres from 'postgres'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function applyMigration() {
  try {
    console.log('Applying api_keys table migration...')

    // Read and execute the migration SQL
    const migrationSQL = readFileSync(
      join(__dirname, '../drizzle/0016_add_api_keys_table.sql'),
      'utf-8'
    )

    await sql.unsafe(migrationSQL)
    console.log('✓ Created api_keys table')

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

applyMigration()

