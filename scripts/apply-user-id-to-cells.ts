import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function applyMigration() {
  try {
    console.log('Adding user_id column to cells table...')

    // Check if user_id column exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cells' AND column_name = 'user_id'
    `

    if (columnExists.length === 0) {
      // Add user_id column - start as nullable to allow existing rows
      await sql`
        ALTER TABLE cells ADD COLUMN user_id varchar
      `
      console.log('✓ Added user_id column to cells table')
      console.log('⚠ Warning: Existing cells have NULL user_id. You will need to populate them manually.')
    } else {
      console.log('✓ user_id column already exists')
    }

    // Check if unique constraint exists and remove it
    const constraintExists = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'cells' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%user_id%'
    `

    if (constraintExists.length > 0) {
      for (const constraint of constraintExists) {
        const constraintName = constraint.constraint_name
        await sql.unsafe(`ALTER TABLE cells DROP CONSTRAINT IF EXISTS "${constraintName}"`)
        console.log(`✓ Removed unique constraint: ${constraintName}`)
      }
    } else {
      console.log('✓ No unique constraint on user_id found')
    }

    // Note: We're leaving user_id as nullable to allow existing rows
    // The application will enforce NOT NULL for new rows via the schema
    // You should manually populate existing rows with user IDs before making it NOT NULL

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

applyMigration()

