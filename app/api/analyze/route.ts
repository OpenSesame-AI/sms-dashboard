import { NextRequest, NextResponse } from 'next/server'
import { getConversationsByPhoneNumber } from '@/lib/data'
import { saveAiResults } from '@/lib/db/queries'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumbers, prompt, columnKey } = body

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'phoneNumbers array is required' },
        { status: 400 }
      )
    }

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 500 }
      )
    }

    // Analyze each contact's conversation
    const results = await Promise.all(
      phoneNumbers.map(async (phoneNumber: string) => {
        try {
          // Fetch conversation history
          const conversations = await getConversationsByPhoneNumber(phoneNumber)

          if (conversations.length === 0) {
            return {
              phoneNumber,
              result: 'No conversation history available',
              error: null,
            }
          }

          // Format conversation for AI
          const conversationText = conversations
            .map((msg) => {
              const direction = msg.isInbound ? 'Customer' : 'Agent'
              return `${direction}: ${msg.text}`
            })
            .join('\n\n')

          // Call OpenAI API
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that analyzes SMS conversations. Provide concise, actionable insights. Use the absolute minimum number of words necessary to answer. Be brief and direct unless the user explicitly requests detailed explanations.',
              },
              {
                role: 'user',
                content: `Task: ${prompt}\n\nIMPORTANT: Respond with the least amount of words possible. Be extremely concise unless you are explicitly asked to provide detailed analysis.\n\nConversation history:\n\n${conversationText}`,
              },
            ],
            max_tokens: 200,
            temperature: 0.7,
          })

          const analysisResult = completion.choices[0]?.message?.content || 'No analysis available'

          return {
            phoneNumber,
            result: analysisResult,
            error: null,
          }
        } catch (error) {
          console.error(`Error analyzing conversation for ${phoneNumber}:`, error)
          return {
            phoneNumber,
            result: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })
    )

    // Save results to database if columnKey is provided
    if (columnKey) {
      try {
        await saveAiResults(
          columnKey,
          results.map((r) => ({
            phoneNumber: r.phoneNumber,
            result: r.result,
          }))
        )
      } catch (error) {
        console.error('Error saving analysis results:', error)
        // Don't fail the request if saving results fails
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error in analyze route:', error)
    return NextResponse.json(
      { error: 'Failed to analyze conversations' },
      { status: 500 }
    )
  }
}

