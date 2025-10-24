import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { retryOpenAICall } from '@/lib/retry-utils'

// Using Node.js runtime for better OpenAI API compatibility

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000, // 90 seconds timeout for TTS
})

type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
type TTSModel = 'tts-1' | 'tts-1-hd'

interface TTSRequest {
  text: string
  voice?: TTSVoice
  model?: TTSModel
  speed?: number
}

export async function POST(req: Request) {
  // Input validation
  let body: TTSRequest
  try {
    body = await req.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const { text, voice = 'nova', model = 'tts-1-hd', speed = 1.0 } = body

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
    console.log(`[OpenAI TTS] Starting generation for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
    console.log(`[OpenAI TTS] Using model: ${model}, voice: ${voice}, speed: ${speed}`)
    console.log(`[OpenAI TTS] API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`)
    console.log(`[OpenAI TTS] Runtime: Node.js (not Edge)`)
    
    // Create TTS request with retry logic
    const response = await retryOpenAICall(
      () => openai.audio.speech.create({
        model,
        voice,
        input: text,
        speed,
      }),
      'OpenAI Text-to-Speech generation'
    )

    console.log(`[OpenAI TTS] Successfully received response from OpenAI`)
    
    // Convert the raw audio data to a buffer
    const buffer = Buffer.from(await response.arrayBuffer())
    
    console.log(`[OpenAI TTS] Generated audio buffer of ${buffer.length} bytes`)

    // Return the audio as a response with the correct content type
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'X-TTS-Provider': 'OpenAI',
        'X-TTS-Model': model,
      },
    })
  } catch (error: any) {
    console.error('[OpenAI TTS] API error:', error)
    console.error('[OpenAI TTS] Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    })
    
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
    } else if (error.name === 'RetryError') {
      // This is from our retry utility
      return NextResponse.json(
        { error: 'Failed to generate speech', details: error.message },
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
