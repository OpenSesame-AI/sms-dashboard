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
    console.log('Applying CASCADE delete migration for sms_conversations and phone_user_mappings...\n')

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../drizzle/0010_add_cascade_delete_to_conversations.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Execute the migration
    await sql.unsafe(migrationSQL)

    console.log('✓ Successfully applied CASCADE delete migration')
    console.log('  - Updated sms_conversations.cell_id foreign key to CASCADE')
    console.log('  - Updated phone_user_mappings.cell_id foreign key to CASCADE\n')

    // Verify the constraints were updated
    const constraints = await sql`
      SELECT 
        tc.table_name, 
        tc.constraint_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.table_name IN ('sms_conversations', 'phone_user_mappings')
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name LIKE '%cell_id%'
    `

    if (constraints.length > 0) {
      console.log('✓ Verified constraints:')
      constraints.forEach((constraint: any) => {
        console.log(`  - ${constraint.table_name}.${constraint.constraint_name}: ${constraint.delete_rule}`)
      })
    } else {
      console.log('⚠ Warning: Could not verify constraint updates')
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





