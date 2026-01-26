import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

const SENTIMENT_ALERT_NAME = 'Customer Sentiment'
const SENTIMENT_ALERT_CONDITION = "Does the customer's message express positive or negative sentiment (not neutral)? Look for emotional indicators, satisfaction or dissatisfaction, praise or complaints, frustration or appreciation. Respond 'yes' if the sentiment is clearly positive or negative, 'no' if it's neutral or factual."

async function backfillSentimentAlerts() {
  try {
    console.log('Backfilling sentiment alerts for all cells...\n')

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

    let created = 0
    let skipped = 0
    let errors = 0

    for (const cell of cells) {
      try {
        // Check if a sentiment alert already exists for this cell
        // Check by name first (most reliable)
        const existingByName = await sql`
          SELECT id, name
          FROM ai_alerts
          WHERE cell_id = ${cell.id}
            AND name = ${SENTIMENT_ALERT_NAME}
          LIMIT 1
        `

        if (existingByName.length > 0) {
          console.log(`⏭️  Skipped ${cell.name} (${cell.phone_number}) - sentiment alert already exists`)
          skipped++
          continue
        }

        // Also check by condition to catch variations
        const existingByCondition = await sql`
          SELECT id, name
          FROM ai_alerts
          WHERE cell_id = ${cell.id}
            AND condition LIKE ${'%sentiment%'}
          LIMIT 1
        `

        if (existingByCondition.length > 0) {
          console.log(`⏭️  Skipped ${cell.name} (${cell.phone_number}) - sentiment-like alert already exists`)
          skipped++
          continue
        }

        // Create the sentiment alert
        const newAlert = await sql`
          INSERT INTO ai_alerts (name, type, condition, cell_id, enabled)
          VALUES (${SENTIMENT_ALERT_NAME}, 'ai', ${SENTIMENT_ALERT_CONDITION}, ${cell.id}, true)
          RETURNING id, name
        `

        console.log(`✓ Created sentiment alert for ${cell.name} (${cell.phone_number})`)
        created++
      } catch (error) {
        console.error(`❌ Error processing cell ${cell.name} (${cell.id}):`, error)
        errors++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('Backfill Summary:')
    console.log(`  Created: ${created}`)
    console.log(`  Skipped: ${skipped}`)
    console.log(`  Errors: ${errors}`)
    console.log(`  Total: ${cells.length}`)
    console.log('='.repeat(50))
    console.log('\n✓ Backfill complete')
  } catch (error) {
    console.error('Error during backfill:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

backfillSentimentAlerts()
