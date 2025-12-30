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
    console.log('Applying AI alerts tables migration...')

    // Read and execute the migration SQL
    const migrationSQL = readFileSync(
      join(__dirname, '../drizzle/0005_add_ai_alerts_tables.sql'),
      'utf-8'
    )

    await sql.unsafe(migrationSQL)
    console.log('✓ Created ai_alerts and ai_alert_triggers tables')

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

applyMigration()

