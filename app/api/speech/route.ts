import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
type TTSModel = 'tts-1' | 'tts-1-hd'

interface TTSRequest {
  text: string
  voice?: TTSVoice
  model?: TTSModel
  speed?: number
}

// This endpoint is maintained for backward compatibility
// New code should use /api/text-to-speech instead
export async function POST(req: Request) {
  // Input validation
  let body: TTSRequest
  try {
    body = await req.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const { text, voice = 'nova', model = 'tts-1', speed = 1.0 } = body

  // Validate required fields
  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  // Validate speed is within acceptable range
  if (speed < 0.25 || speed > 4.0) {
    return NextResponse.json(
      { error: 'Speed must be between 0.25 and 4.0' },
      { status: 400 }
    )
  }

  try {
    // Create TTS request
    const response = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      speed,
    })

    // Convert the raw audio data to a buffer
    const buffer = Buffer.from(await response.arrayBuffer())

    // Return the audio as a response with the correct content type
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    })
  } catch (error: any) {
    console.error('OpenAI TTS API error:', error)
    
    // Handle different types of errors
    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    } else if (error.status === 401 || error.status === 403) {
      return NextResponse.json(
        { error: 'Authentication error with OpenAI API' },
        { status: 500 }
      )
    } else {
      return NextResponse.json(
        { error: 'Failed to generate speech', details: error.message },
        { status: 500 }
      )
    }
  }
}
