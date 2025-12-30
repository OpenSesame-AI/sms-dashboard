import { NextRequest, NextResponse } from 'next/server'
import { getEnabledAiAlerts, createAiAlertTrigger, getConversationsByPhoneNumber } from '@/lib/db/queries'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, messageId, messageBody, cellId } = body

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'phoneNumber is required' },
        { status: 400 }
      )
    }

    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      )
    }

    if (!messageBody || typeof messageBody !== 'string') {
      return NextResponse.json(
        { error: 'messageBody is required' },
        { status: 400 }
      )
    }

    // Get all enabled alerts for this cell
    const alerts = await getEnabledAiAlerts(cellId)
    
    if (alerts.length === 0) {
      return NextResponse.json({ triggered: [] })
    }

    // Get conversation history for AI alerts
    const conversations = await getConversationsByPhoneNumber(phoneNumber, cellId)
    const conversationText = conversations
      .map((msg) => {
        const direction = msg.isInbound ? 'Customer' : 'Agent'
        return `${direction}: ${msg.text}`
      })
      .join('\n\n')

    const triggeredAlerts = []

    // Evaluate each alert
    for (const alert of alerts) {
      let shouldTrigger = false

      if (alert.type === 'keyword') {
        // Simple keyword matching
        const keywords = alert.condition.split(',').map(k => k.trim().toLowerCase())
        const messageLower = messageBody.toLowerCase()
        shouldTrigger = keywords.some(keyword => messageLower.includes(keyword))
      } else if (alert.type === 'ai') {
        // AI evaluation
        if (!process.env.OPENAI_API_KEY) {
          console.warn('OPENAI_API_KEY not configured, skipping AI alert evaluation')
          continue
        }

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant that evaluates SMS messages against conditions. Respond with ONLY "yes" or "no" - nothing else.',
              },
              {
                role: 'user',
                content: `Condition: ${alert.condition}\n\nLatest message: ${messageBody}\n\nConversation history:\n${conversationText}\n\nDoes the latest message meet the condition? Respond with only "yes" or "no".`,
              },
            ],
            max_tokens: 10,
            temperature: 0.3,
          })

          const response = completion.choices[0]?.message?.content?.toLowerCase().trim()
          shouldTrigger = response === 'yes' || response?.startsWith('yes')
        } catch (error) {
          console.error(`Error evaluating AI alert ${alert.id}:`, error)
          continue
        }
      }

      if (shouldTrigger) {
        const trigger = await createAiAlertTrigger(alert.id, phoneNumber, messageId, cellId)
        triggeredAlerts.push({
          alertId: alert.id,
          alertName: alert.name,
          triggerId: trigger.id,
        })
      }
    }

    return NextResponse.json({ triggered: triggeredAlerts })
  } catch (error) {
    console.error('Error evaluating alerts:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to evaluate alerts', details: errorMessage },
      { status: 500 }
    )
  }
}

