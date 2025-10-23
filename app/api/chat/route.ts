import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a friendly and helpful AI tutor. Keep your responses clear, concise, and engaging.
          
Guidelines:
1. Keep responses under 3 sentences per point
2. Use simple language
3. Be encouraging and supportive
4. Focus on helping the student learn`
        },
        ...messages.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return NextResponse.json({ text: response.choices[0].message.content })
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
