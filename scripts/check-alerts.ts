import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function checkAlerts() {
  try {
    console.log('Checking alerts in database...\n')

    // Check if tables exist
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ai_alerts'
      )
    `
    
    if (!tableExists[0].exists) {
      console.log('❌ ai_alerts table does not exist. Please run the migration first.')
      await sql.end()
      return
    }

    // Get all alerts
    const alerts = await sql`
      SELECT id, name, type, condition, cell_id, enabled, created_at, updated_at
      FROM ai_alerts
      ORDER BY created_at DESC
    `

    console.log(`Found ${alerts.length} alert(s):\n`)

    if (alerts.length === 0) {
      console.log('No alerts found in database.')
    } else {
      alerts.forEach((alert: any) => {
        console.log(`📢 Alert: ${alert.name}`)
        console.log(`   ID: ${alert.id}`)
        console.log(`   Type: ${alert.type}`)
        console.log(`   Condition: ${alert.condition.substring(0, 50)}${alert.condition.length > 50 ? '...' : ''}`)
        console.log(`   Cell ID: ${alert.cell_id || 'None'}`)
        console.log(`   Enabled: ${alert.enabled}`)
        console.log(`   Created: ${alert.created_at}`)
        console.log('')
      })
    }

    // Check alert triggers
    const triggerTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ai_alert_triggers'
      )
    `
    
    if (triggerTableExists[0].exists) {
      const triggers = await sql`
        SELECT COUNT(*)::int as count
        FROM ai_alert_triggers
        WHERE dismissed = false
      `
      console.log(`🔔 Active alert triggers: ${triggers[0].count}`)
    }

    console.log('\n✓ Check complete')
  } catch (error) {
    console.error('Error checking alerts:', error)
  } finally {
    await sql.end()
  }
}

checkAlerts()

