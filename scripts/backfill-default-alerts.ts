import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

const DEFAULT_ALERTS = [
  {
    name: 'Customer Sentiment',
    condition: "Does the customer's message express positive or negative sentiment (not neutral)? Look for emotional indicators, satisfaction or dissatisfaction, praise or complaints, frustration or appreciation. Respond 'yes' if the sentiment is clearly positive or negative, 'no' if it's neutral or factual.",
  },
  {
    name: 'Potential Issues',
    condition: "Does the customer's message indicate a potential issue that requires attention? Look for: complaints, dissatisfaction, requests for escalation or a manager, technical problems, errors, urgent matters, service issues, or any situation that may need immediate attention or follow-up. Respond 'yes' if there's a clear issue, 'no' if it's a normal inquiry or positive interaction.",
  },
]

async function backfillDefaultAlerts() {
  try {
    console.log('Backfilling default alerts for all cells...\n')

    // Check if tables exist
    const alertsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ai_alerts'
      )
    `
    
    if (!alertsTableExists[0].exists) {
      console.log('❌ ai_alerts table does not exist. Please run the migration first.')
      await sql.end()
      return
    }

    const cellsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'cells'
      )
    `
    
    if (!cellsTableExists[0].exists) {
      console.log('❌ cells table does not exist. Please run the migration first.')
      await sql.end()
      return
    }

    // Get all cells
    const cells = await sql`
      SELECT id, name, phone_number
      FROM cells
      ORDER BY created_at ASC
    `

    console.log(`Found ${cells.length} cell(s) to process\n`)

    if (cells.length === 0) {
      console.log('No cells found in database.')
      await sql.end()
      return
    }

    let totalCreated = 0
    let totalSkipped = 0
    let totalErrors = 0

    for (const cell of cells) {
      console.log(`\nProcessing ${cell.name} (${cell.phone_number})...`)
      
      for (const alert of DEFAULT_ALERTS) {
        try {
          // Check if this alert already exists for this cell by name
          const existingByName = await sql`
            SELECT id, name
            FROM ai_alerts
            WHERE cell_id = ${cell.id}
              AND name = ${alert.name}
            LIMIT 1
          `

          if (existingByName.length > 0) {
            console.log(`  ⏭️  Skipped "${alert.name}" - already exists`)
            totalSkipped++
            continue
          }

          // Create the alert
          const newAlert = await sql`
            INSERT INTO ai_alerts (name, type, condition, cell_id, enabled)
            VALUES (${alert.name}, 'ai', ${alert.condition}, ${cell.id}, true)
            RETURNING id, name
          `

          console.log(`  ✓ Created "${alert.name}"`)
          totalCreated++
        } catch (error) {
          console.error(`  ❌ Error creating "${alert.name}" for cell ${cell.name} (${cell.id}):`, error)
          totalErrors++
        }
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('Backfill Summary:')
    console.log(`  Created: ${totalCreated}`)
    console.log(`  Skipped: ${totalSkipped}`)
    console.log(`  Errors: ${totalErrors}`)
    console.log(`  Total cells: ${cells.length}`)
    console.log(`  Total alerts processed: ${cells.length * DEFAULT_ALERTS.length}`)
    console.log('='.repeat(50))
    console.log('\n✓ Backfill complete')
  } catch (error) {
    console.error('Error during backfill:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

backfillDefaultAlerts()
