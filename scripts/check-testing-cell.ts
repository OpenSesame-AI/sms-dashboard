import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function checkTestingCell() {
  try {
    console.log('Checking Testing cell in database...\n')

    // Find the Testing cell
    const testingCell = await sql`
      SELECT id, name, phone_number, created_at, updated_at
      FROM cells
      WHERE name ILIKE '%testing%' OR name ILIKE '%test%'
      ORDER BY created_at DESC
    `

    if (testingCell.length === 0) {
      console.log('⚠ No Testing cell found in database')
      console.log('\nAll cells in database:')
      const allCells = await sql`SELECT id, name, phone_number FROM cells ORDER BY created_at`
      allCells.forEach((cell: any) => {
        console.log(`  - ${cell.name} (ID: ${cell.id}, Phone: ${cell.phone_number})`)
      })
      await sql.end()
      return
    }

    const cell = testingCell[0]
    console.log('✓ Found Testing cell:')
    console.log(`  ID: ${cell.id}`)
    console.log(`  Name: ${cell.name}`)
    console.log(`  Phone Number: ${cell.phone_number}`)
    console.log(`  Created: ${cell.created_at}`)
    console.log(`  Updated: ${cell.updated_at}`)
    console.log('')

    // Count contacts (phone_user_mappings) for this cell
    const contactCount = await sql`
      SELECT COUNT(*)::int as count
      FROM phone_user_mappings
      WHERE cell_id = ${cell.id}
    `
    console.log(`📊 Contact Count (phone_user_mappings): ${contactCount[0].count}`)

    // Count conversations for this cell
    const conversationCount = await sql`
      SELECT COUNT(*)::int as count
      FROM sms_conversations
      WHERE cell_id = ${cell.id}
    `
    console.log(`💬 Conversation Count (sms_conversations): ${conversationCount[0].count}`)

    // Show sample contacts
    console.log('\n📋 Sample contacts (first 10):')
    const sampleContacts = await sql`
      SELECT id, phone_number, user_id, created_at
      FROM phone_user_mappings
      WHERE cell_id = ${cell.id}
      ORDER BY created_at DESC
      LIMIT 10
    `
    sampleContacts.forEach((contact: any, index: number) => {
      console.log(`  ${index + 1}. Phone: ${contact.phone_number}, User ID: ${contact.user_id}`)
    })

    // Check if there are contacts without cell_id that might belong to this cell
    console.log('\n🔍 Checking for orphaned data...')
    const orphanedMappings = await sql`
      SELECT COUNT(*)::int as count
      FROM phone_user_mappings
      WHERE cell_id IS NULL
    `
    console.log(`  Phone mappings without cell_id: ${orphanedMappings[0].count}`)

    const orphanedConversations = await sql`
      SELECT COUNT(*)::int as count
      FROM sms_conversations
      WHERE cell_id IS NULL
    `
    console.log(`  Conversations without cell_id: ${orphanedConversations[0].count}`)

    // Performance check: Test the query that was causing issues
    console.log('\n⚡ Testing optimized query performance...')
    const startTime = Date.now()
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
    console.log(`  ✓ Query executed in ${queryTime}ms`)
    console.log(`  ✓ Returned ${testQuery.length} contacts`)

    if (queryTime > 5000) {
      console.log(`  ⚠ WARNING: Query took longer than 5 seconds!`)
    } else if (queryTime > 1000) {
      console.log(`  ⚠ Query is slow but acceptable`)
    } else {
      console.log(`  ✓ Query performance is good`)
    }

  } catch (error) {
    console.error('Error checking Testing cell:', error)
  } finally {
    await sql.end()
  }
}

checkTestingCell()



