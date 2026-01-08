import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function applyMigration() {
  try {
    console.log('Applying AI analysis tables migration...')

    // Create ai_analysis_columns table
    await sql`
      CREATE TABLE IF NOT EXISTS ai_analysis_columns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        column_key varchar NOT NULL,
        name varchar NOT NULL,
        prompt text NOT NULL,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now(),
        CONSTRAINT ai_analysis_columns_column_key_unique UNIQUE(column_key)
      )
    `
    console.log('✓ Created ai_analysis_columns table')

    // Create ai_analysis_results table
    await sql`
      CREATE TABLE IF NOT EXISTS ai_analysis_results (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        column_key varchar NOT NULL,
        phone_number varchar NOT NULL,
        result text,
        created_at timestamp with time zone DEFAULT now(),
        updated_at timestamp with time zone DEFAULT now()
      )
    `
    console.log('✓ Created ai_analysis_results table')

    // Add unique constraint if it doesn't exist
    const constraintExists = await sql`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'ai_analysis_results_column_key_phone_number_unique'
    `

    if (constraintExists.length === 0) {
      await sql`
        ALTER TABLE ai_analysis_results 
        ADD CONSTRAINT ai_analysis_results_column_key_phone_number_unique 
        UNIQUE(column_key, phone_number)
      `
      console.log('✓ Added unique constraint')
    } else {
      console.log('✓ Unique constraint already exists')
    }

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

applyMigration()








