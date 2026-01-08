import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function checkAllCells() {
  try {
    console.log('Checking all cells in database...\n')

    // Get all cells
    const allCells = await sql`
      SELECT id, name, phone_number, created_at, updated_at
      FROM cells
      ORDER BY created_at
    `

    console.log(`Found ${allCells.length} cell(s):\n`)

    for (const cell of allCells) {
      console.log(`📱 Cell: ${cell.name}`)
      console.log(`   ID: ${cell.id}`)
      console.log(`   Phone: ${cell.phone_number}`)
      console.log(`   Created: ${cell.created_at}`)
      
      // Count contacts for this cell
      const contactCount = await sql`
        SELECT COUNT(*)::int as count
        FROM phone_user_mappings
        WHERE cell_id = ${cell.id}
      `
      console.log(`   📊 Contacts: ${contactCount[0].count}`)

      // Count conversations for this cell
      const conversationCount = await sql`
        SELECT COUNT(*)::int as count
        FROM sms_conversations
        WHERE cell_id = ${cell.id}
      `
      console.log(`   💬 Conversations: ${conversationCount[0].count}`)

      // Check for any data issues
      const contactsWithoutCellId = await sql`
        SELECT COUNT(*)::int as count
        FROM phone_user_mappings
        WHERE cell_id IS NULL
      `
      
      const conversationsWithoutCellId = await sql`
        SELECT COUNT(*)::int as count
        FROM sms_conversations
        WHERE cell_id IS NULL
      `

      // Test the actual query that's being used
      console.log(`   ⚡ Testing query performance...`)
      const startTime = Date.now()
      try {
        const testQuery = await sql`
          SELECT 
            p.id,
            p.phone_number as "phoneNumber",
            p.user_id as "userId",
            p.created_at as "createdAt",
            COUNT(s.id)::int as "numberOfMessages",
            MAX(s.message_body) as "lastMessage",
            MAX(s.timestamp) as "lastActivity",
            (
              SELECT s2.status
              FROM sms_conversations s2
              WHERE s2.phone_number = p.phone_number
                AND s2.cell_id = ${cell.id}
              ORDER BY s2.timestamp DESC
              LIMIT 1
            ) as "lastStatus"
          FROM phone_user_mappings p
          LEFT JOIN sms_conversations s ON s.phone_number = p.phone_number
            AND s.cell_id = ${cell.id}
          WHERE p.cell_id = ${cell.id}
          GROUP BY p.id, p.phone_number, p.user_id, p.created_at
          ORDER BY MAX(s.timestamp) DESC NULLS LAST
        `
        const endTime = Date.now()
        const queryTime = endTime - startTime
        console.log(`      ✓ Query executed in ${queryTime}ms`)
        console.log(`      ✓ Returned ${testQuery.length} contacts`)
        
        // Check if any contacts have problematic data
        if (testQuery.length > 0) {
          const problematicContacts = testQuery.filter((row: any) => {
            // Check for invalid dates
            try {
              if (row.createdAt && !(row.createdAt instanceof Date)) {
                const d = new Date(row.createdAt)
                if (isNaN(d.getTime())) return true
              }
              if (row.lastActivity && !(row.lastActivity instanceof Date)) {
                const d = new Date(row.lastActivity)
                if (isNaN(d.getTime())) return true
              }
            } catch (e) {
              return true
            }
            return false
          })
          
          if (problematicContacts.length > 0) {
            console.log(`      ⚠ Found ${problematicContacts.length} contacts with problematic date data`)
            problematicContacts.slice(0, 3).forEach((contact: any, idx: number) => {
              console.log(`         ${idx + 1}. Phone: ${contact.phoneNumber}, createdAt: ${contact.createdAt}, lastActivity: ${contact.lastActivity}`)
            })
          }
        }
      } catch (error: any) {
        console.log(`      ❌ Query failed: ${error.message}`)
      }
      
      console.log('')
    }

    // Check for orphaned data
    console.log('🔍 Checking for orphaned data...')
    const orphanedMappings = await sql`
      SELECT COUNT(*)::int as count
      FROM phone_user_mappings
      WHERE cell_id IS NULL
    `
    console.log(`   Phone mappings without cell_id: ${orphanedMappings[0].count}`)

    const orphanedConversations = await sql`
      SELECT COUNT(*)::int as count
      FROM sms_conversations
      WHERE cell_id IS NULL
    `
    console.log(`   Conversations without cell_id: ${orphanedConversations[0].count}`)

    // Check for any data type issues in phone_user_mappings
    console.log('\n🔍 Checking for data type issues...')
    const sampleMapping = await sql`
      SELECT id, phone_number, user_id, cell_id, created_at, updated_at
      FROM phone_user_mappings
      LIMIT 1
    `
    if (sampleMapping.length > 0) {
      console.log('   Sample phone_user_mapping:')
      const mapping = sampleMapping[0]
      console.log(`     id type: ${typeof mapping.id}, value: ${mapping.id}`)
      console.log(`     phone_number type: ${typeof mapping.phone_number}, value: ${mapping.phone_number}`)
      console.log(`     user_id type: ${typeof mapping.user_id}, value: ${mapping.user_id}`)
      console.log(`     cell_id type: ${typeof mapping.cell_id}, value: ${mapping.cell_id}`)
      console.log(`     created_at type: ${typeof mapping.created_at}, value: ${mapping.created_at}`)
      console.log(`     created_at instanceof Date: ${mapping.created_at instanceof Date}`)
    }

  } catch (error) {
    console.error('Error checking cells:', error)
  } finally {
    await sql.end()
  }
}

checkAllCells()







