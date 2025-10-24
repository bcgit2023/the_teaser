import { NextResponse } from 'next/server'
import { ElevenLabsClient } from 'elevenlabs'
import { retryWithBackoff } from '@/lib/retry-utils'

// Note: ElevenLabs client requires Node.js runtime, cannot use Edge Runtime
// Using Node.js runtime with extended timeout configuration

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
})

// ElevenLabs voice IDs for popular voices
const ELEVENLABS_VOICES = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',    // Rachel - Young, friendly female
  'adam': 'pNInz6obpgDQGcFmaJgB',      // Adam - Deep, confident male
  'bella': 'EXAVITQu4vr4xnSDxMaL',     // Bella - Soft, warm female
  'antoni': 'ErXwobaYiN019PkySvjV',    // Antoni - Well-rounded male
  'elli': 'MF3mGyEYCl7XYWbV9V6O',     // Elli - Emotional, young female
  'josh': 'TxGEqnHWrfWFTfGW9XjX',     // Josh - Deep, serious male
  'arnold': 'VR6AewLTigWG4xSOukaG',   // Arnold - Crisp, authoritative male
  'domi': 'AZnzlk1XvdvUeBnXmlld',     // Domi - Strong, confident female
  'sam': 'yoZ06aMxZJJ28mfd3POQ',      // Sam - Raspy, casual male
} as const

type ElevenLabsVoice = keyof typeof ELEVENLABS_VOICES
type ElevenLabsModel = 'eleven_monolingual_v1' | 'eleven_multilingual_v1' | 'eleven_multilingual_v2' | 'eleven_turbo_v2'

interface ElevenLabsTTSRequest {
  text: string
  voice?: ElevenLabsVoice
  model?: ElevenLabsModel
  stability?: number
  similarity_boost?: number
  style?: number
  use_speaker_boost?: boolean
}

export async function POST(req: Request) {
  // Input validation
  let body: ElevenLabsTTSRequest
  try {
    body = await req.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const { 
    text, 
    voice = 'rachel', 
    model = 'eleven_turbo_v2',
    stability = 0.5,
    similarity_boost = 0.75,
    style = 0.0,
    use_speaker_boost = true
  } = body

  // Validate required fields
  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  // Validate text length (ElevenLabs has limits)
  if (text.length > 5000) {
    return NextResponse.json(
      { error: 'Text too long. Maximum 5000 characters allowed.' },
      { status: 400 }
    )
  }

  // Validate voice
  if (!ELEVENLABS_VOICES[voice]) {
    return NextResponse.json(
      { error: `Invalid voice. Available voices: ${Object.keys(ELEVENLABS_VOICES).join(', ')}` },
      { status: 400 }
    )
  }

  // Validate stability and similarity_boost ranges
  if (stability < 0 || stability > 1) {
    return NextResponse.json(
      { error: 'Stability must be between 0 and 1' },
      { status: 400 }
    )
  }

  if (similarity_boost < 0 || similarity_boost > 1) {
    return NextResponse.json(
      { error: 'Similarity boost must be between 0 and 1' },
      { status: 400 }
    )
  }

  try {
    console.log(`[ElevenLabs TTS] Starting generation for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
    console.log(`[ElevenLabs TTS] Using voice: ${voice} (${ELEVENLABS_VOICES[voice]})`)
    console.log(`[ElevenLabs TTS] Using model: ${model}`)

    // Generate speech using ElevenLabs API with retry logic
    const buffer = await retryWithBackoff(
      async () => {
        console.log(`[ElevenLabs TTS] Attempting API call...`)
        
        const audioStream = await elevenlabs.generate({
          voice: ELEVENLABS_VOICES[voice],
          text: text,
          model_id: model,
          voice_settings: {
            stability: stability,
            similarity_boost: similarity_boost,
            style: style,
            use_speaker_boost: use_speaker_boost,
          },
        })

        // Convert the stream to a buffer
         const chunks: Uint8Array[] = []
         for await (const chunk of audioStream) {
           chunks.push(chunk)
         }
         const generatedBuffer = Buffer.concat(chunks)
        
        console.log(`[ElevenLabs TTS] Successfully generated audio buffer of ${generatedBuffer.length} bytes`)
        return generatedBuffer
      },
      {
        maxRetries: 3,
        baseDelay: 2000,  // Start with 2 seconds
        maxDelay: 15000,  // Max 15 seconds
        backoffFactor: 2,
        retryCondition: (error) => {
          // Retry on network errors and certain HTTP status codes
          const isRetryable = 
            error.code === 'ECONNRESET' || 
            error.code === 'ENOTFOUND' || 
            error.code === 'ETIMEDOUT' ||
            error.status === 429 ||
            error.status === 500 ||
            error.status === 502 ||
            error.status === 503 ||
            error.status === 504
          
          console.log(`[ElevenLabs TTS] Error ${error.message} is ${isRetryable ? 'retryable' : 'not retryable'}`)
          return isRetryable
        }
      }
    )

    // Return the audio as a response with the correct content type
    return new NextResponse(buffer.buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'X-TTS-Provider': 'ElevenLabs',
        'X-TTS-Model': model,
      },
    })
  } catch (error: any) {
    console.error('[ElevenLabs TTS] API error:', error)
    console.error('[ElevenLabs TTS] Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    })
    
    // Handle ElevenLabs specific errors
    if (error.status) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      } else if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          { error: 'Authentication error with ElevenLabs API' },
          { status: 500 }
        )
      } else if (error.status === 422) {
        return NextResponse.json(
          { error: 'Invalid request parameters for ElevenLabs API' },
          { status: 400 }
        )
      }
    }

    // Handle retry errors
    if (error.name === 'RetryError') {
      return NextResponse.json(
        { error: 'Failed to generate speech with ElevenLabs', details: error.message },
        { status: 500 }
      )
    }

    // Handle network and other errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'Connection error with ElevenLabs API. Please try again.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate speech with ElevenLabs', details: error.message },
      { status: 500 }
    )
  }
}