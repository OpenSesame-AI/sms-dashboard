import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function applyMigration() {
  try {
    console.log('Applying cells table migration...')

    // Create cells table
    await sql`
      CREATE TABLE IF NOT EXISTS cells (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        phone_number varchar NOT NULL,
        name varchar NOT NULL,
        user_id varchar NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT cells_user_id_unique UNIQUE(user_id)
      )
    `
    console.log('✓ Created cells table')

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

applyMigration()




