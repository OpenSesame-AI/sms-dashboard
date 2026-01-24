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
    console.log('Applying user_id to integrations table migration...')

    // Read and execute the migration SQL
    const migrationSQL = readFileSync(
      join(__dirname, '../drizzle/0018_add_user_id_to_integrations.sql'),
      'utf-8'
    )

    await sql.unsafe(migrationSQL)
    console.log('✓ Applied schema changes')

    // Check if there are any existing integrations without user_id
    const existingIntegrations = await sql`
      SELECT id, cell_id FROM integrations WHERE user_id IS NULL
    `

    if (existingIntegrations.length > 0) {
      console.log(`Found ${existingIntegrations.length} integrations without user_id`)
      
      // For each integration, try to get user_id from the associated cell
      for (const integration of existingIntegrations) {
        if (integration.cell_id) {
          const cell = await sql`
            SELECT user_id FROM cells WHERE id = ${integration.cell_id}
          `
          if (cell.length > 0 && cell[0].user_id) {
            await sql`
              UPDATE integrations 
              SET user_id = ${cell[0].user_id}
              WHERE id = ${integration.id}
            `
            console.log(`✓ Updated integration ${integration.id} with user_id from cell`)
          } else {
            console.log(`⚠ Integration ${integration.id} has cell_id ${integration.cell_id} but cell not found - will need manual update`)
          }
        } else {
          console.log(`⚠ Integration ${integration.id} has no cell_id - will need manual update`)
        }
      }
      
      // Check if there are still integrations without user_id
      const remainingIntegrations = await sql`
        SELECT id FROM integrations WHERE user_id IS NULL
      `
      
      if (remainingIntegrations.length > 0) {
        console.log(`⚠ Warning: ${remainingIntegrations.length} integrations still without user_id`)
        console.log('These will need to be manually updated or deleted')
      } else {
        // All integrations have user_id, make it NOT NULL
        await sql`
          ALTER TABLE integrations 
          ALTER COLUMN user_id SET NOT NULL
        `
        console.log('✓ Made user_id NOT NULL')
      }
    } else {
      // No existing integrations, make user_id NOT NULL directly
      await sql`
        ALTER TABLE integrations 
        ALTER COLUMN user_id SET NOT NULL
      `
      console.log('✓ Made user_id NOT NULL')
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
