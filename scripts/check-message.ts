import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

async function checkMessage() {
  try {
    const searchMessage = "I'm testing a new feature!"
    console.log(`Searching for message: "${searchMessage}"\n`)

    // Search for the exact message
    const exactMatches = await sql`
      SELECT 
        id,
        phone_number,
        user_id,
        cell_id,
        direction,
        message_body,
        message_sid,
        timestamp,
        status
      FROM sms_conversations
      WHERE message_body = ${searchMessage}
      ORDER BY timestamp DESC
    `

    console.log(`Found ${exactMatches.length} exact match(es):\n`)

    let allMatchesForCells: any[] = exactMatches

    if (exactMatches.length === 0) {
      // Try case-insensitive search
      const caseInsensitiveMatches = await sql`
        SELECT 
          id,
          phone_number,
          user_id,
          cell_id,
          direction,
          message_body,
          message_sid,
          timestamp,
          status
        FROM sms_conversations
        WHERE LOWER(message_body) = LOWER(${searchMessage})
        ORDER BY timestamp DESC
      `

      if (caseInsensitiveMatches.length > 0) {
        console.log(`Found ${caseInsensitiveMatches.length} case-insensitive match(es):\n`)
        allMatchesForCells = caseInsensitiveMatches
        caseInsensitiveMatches.forEach((msg: any, index: number) => {
          console.log(`Match ${index + 1}:`)
          console.log(`  ID: ${msg.id}`)
          console.log(`  Phone Number: ${msg.phone_number}`)
          console.log(`  User ID: ${msg.user_id}`)
          console.log(`  Cell ID: ${msg.cell_id || 'NULL'}`)
          console.log(`  Direction: ${msg.direction}`)
          console.log(`  Message Body: ${msg.message_body}`)
          console.log(`  Message SID: ${msg.message_sid || 'NULL'}`)
          console.log(`  Timestamp: ${msg.timestamp}`)
          console.log(`  Status: ${msg.status || 'NULL'}`)
          console.log('')
        })
      } else {
        // Try partial match
        const partialMatches = await sql`
          SELECT 
            id,
            phone_number,
            user_id,
            cell_id,
            direction,
            message_body,
            message_sid,
            timestamp,
            status
          FROM sms_conversations
          WHERE message_body ILIKE ${'%' + searchMessage + '%'}
          ORDER BY timestamp DESC
          LIMIT 20
        `

        if (partialMatches.length > 0) {
          console.log(`Found ${partialMatches.length} partial match(es) (showing first 20):\n`)
          allMatchesForCells = partialMatches
          partialMatches.forEach((msg: any, index: number) => {
            console.log(`Match ${index + 1}:`)
            console.log(`  ID: ${msg.id}`)
            console.log(`  Phone Number: ${msg.phone_number}`)
            console.log(`  User ID: ${msg.user_id}`)
            console.log(`  Cell ID: ${msg.cell_id || 'NULL'}`)
            console.log(`  Direction: ${msg.direction}`)
            console.log(`  Message Body: ${msg.message_body}`)
            console.log(`  Message SID: ${msg.message_sid || 'NULL'}`)
            console.log(`  Timestamp: ${msg.timestamp}`)
            console.log(`  Status: ${msg.status || 'NULL'}`)
            console.log('')
          })
        } else {
          console.log('❌ No matches found (exact, case-insensitive, or partial)')
        }
      }
    } else {
      exactMatches.forEach((msg: any, index: number) => {
        console.log(`Match ${index + 1}:`)
        console.log(`  ID: ${msg.id}`)
        console.log(`  Phone Number: ${msg.phone_number}`)
        console.log(`  User ID: ${msg.user_id}`)
        console.log(`  Cell ID: ${msg.cell_id || 'NULL'}`)
        console.log(`  Direction: ${msg.direction}`)
        console.log(`  Message Body: ${msg.message_body}`)
        console.log(`  Message SID: ${msg.message_sid || 'NULL'}`)
        console.log(`  Timestamp: ${msg.timestamp}`)
        console.log(`  Status: ${msg.status || 'NULL'}`)
        console.log('')
      })
    }

    // Get cell information if cell_id is present
    const cellIds = [...new Set(allMatchesForCells.map((m: any) => m.cell_id).filter(Boolean))]
    
    if (cellIds.length > 0) {
      console.log('\n📋 Cell Information:')
      for (const cellId of cellIds) {
        const cell = await sql`
          SELECT id, name, phone_number, created_at, updated_at
          FROM cells
          WHERE id = ${cellId}
        `
        if (cell.length > 0) {
          console.log(`  Cell ID: ${cell[0].id}`)
          console.log(`  Name: ${cell[0].name}`)
          console.log(`  Phone: ${cell[0].phone_number}`)
          console.log('')
        }
      }
    }

  } catch (error) {
    console.error('Error checking message:', error)
  } finally {
    await sql.end()
  }
}

checkMessage()
