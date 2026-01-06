import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function applyMigration() {
  try {
    console.log('Adding organization_id column to cells table...')

    // Check if organization_id column exists
    const columnExists = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cells' AND column_name = 'organization_id'
    `

    if (columnExists.length === 0) {
      // Add organization_id column - nullable for backward compatibility
      await sql`
        ALTER TABLE cells ADD COLUMN organization_id varchar
      `
      console.log('✓ Added organization_id column to cells table')
      console.log('✓ Column is nullable - existing cells remain personal (null = personal cell)')
    } else {
      console.log('✓ organization_id column already exists')
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


