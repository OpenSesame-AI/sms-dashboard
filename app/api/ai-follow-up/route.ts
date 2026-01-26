import { NextRequest, NextResponse } from 'next/server'
import { getConversationsByPhoneNumber } from '@/lib/data'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, cellId } = body

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'phoneNumber is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Fetch conversation history
    const conversations = await getConversationsByPhoneNumber(phoneNumber, cellId)

    if (conversations.length === 0) {
      return NextResponse.json(
        { error: 'No conversation history available' },
        { status: 400 }
      )
    }

    // Format conversation for AI
    const conversationText = conversations
      .map((msg) => {
        const direction = msg.isInbound ? 'Customer' : 'Agent'
        return `${direction}: ${msg.text}`
      })
      .join('\n\n')

    // Call OpenAI API to generate follow-up suggestions
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that generates SMS follow-up message suggestions. Generate 3-5 short, contextually relevant follow-up messages based on the conversation history.

Guidelines:
- Keep messages short and concise (1-2 sentences max, SMS-appropriate)
- Make suggestions contextually relevant to the conversation
- Use a professional yet friendly tone
- Provide variety: some friendly, some direct, some question-based
- Each suggestion should be distinct and offer a different approach
- Return ONLY the message text, one per line
- Do not include numbering, prefixes, or explanations`,
        },
        {
          role: 'user',
          content: `Based on this conversation history, suggest 3-5 follow-up messages the agent could send:\n\n${conversationText}\n\nGenerate the suggestions now, one per line:`,
        },
      ],
      max_tokens: 300,
      temperature: 0.8,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    
    // Parse suggestions (split by newlines and filter empty lines)
    const suggestions = responseText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      // Remove any numbering or prefixes (e.g., "1. ", "- ", "* ")
      .map((line) => line.replace(/^[\d\-*\.\)]\s*/, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 5) // Limit to 5 suggestions max

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate suggestions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error generating AI follow-up suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
