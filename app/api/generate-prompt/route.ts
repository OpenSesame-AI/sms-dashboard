import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { description } = body

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are an expert at creating SMS assistant system prompts. Generate a complete system prompt based on the user's description.

The prompt should follow this structure:
1. Start with a role definition (e.g., "You are a helpful [type] assistant.")
2. Include the {domain_knowledge} placeholder on its own line
3. Add a "## SMS Communication Guidelines" section with:
   - Tone: How the assistant should communicate
   - Conversation Flow: How to handle different scenarios
   - Memory Isolation: Note that each phone number is a separate conversation
   - Response Format: Keep responses short (1-2 sentences max for SMS)

Keep the prompt concise, practical, and SMS-appropriate. Focus on being helpful, brief, and clear.`

    const userPrompt = `Generate a system prompt for an SMS assistant that: ${description}

Make sure to include:
- A clear role definition based on the description
- The {domain_knowledge} placeholder
- SMS-appropriate communication guidelines
- Instructions for short, concise responses (1-2 sentences max)
- Memory isolation rules (each phone number is a separate conversation)

Generate the complete system prompt now:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const generatedPrompt = completion.choices[0]?.message?.content || ''

    if (!generatedPrompt) {
      return NextResponse.json(
        { error: 'Failed to generate prompt' },
        { status: 500 }
      )
    }

    return NextResponse.json({ prompt: generatedPrompt })
  } catch (error) {
    console.error('Error generating prompt:', error)
    return NextResponse.json(
      { error: 'Failed to generate prompt' },
      { status: 500 }
    )
  }
}




