import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const sql = postgres(process.env.DATABASE_URL)

const DEFAULT_SYSTEM_PROMPT = `You are a helpful SMS assistant.

{domain_knowledge}

## SMS Communication Guidelines

Tone:
- Friendly, curious, confident
- Simple sentences
- Short, concise responses (1-2 sentences max, only expand if they ask for more)
- No emojis
- No jargon
- Keep answers brief and to the point
- Be direct and avoid long explanations

Conversation Flow:
- If they greet you, greet them back warmly and offer to help
- Answer questions directly based on your knowledge
- If you don't know something, say so honestly
- Stay focused on topics you're knowledgeable about

Memory Isolation:
- Each phone number is a completely separate conversation
- Never reference information from other conversations
- If you don't remember something from THIS conversation, that's normal - don't make things up

Response Format:
- Keep responses SHORT - 1-2 sentences max unless they explicitly ask for more detail
- This is SMS - people want quick, helpful answers
- If a topic requires a longer explanation, offer to break it into parts
`

async function updateAllCells() {
  try {
    console.log('Updating all cells with default system prompt...')
    
    const result = await sql`
      UPDATE cells 
      SET system_prompt = ${DEFAULT_SYSTEM_PROMPT}
      WHERE system_prompt IS NULL OR system_prompt = ''
      RETURNING id, name
    `
    
    console.log(`✓ Updated ${result.length} cells with the default system prompt`)
    result.forEach(cell => console.log(`  - ${cell.name} (${cell.id})`))
    
    if (result.length === 0) {
      console.log('All cells already have a system prompt set.')
    }
  } catch (error) {
    console.error('Error updating cells:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

updateAllCells()


