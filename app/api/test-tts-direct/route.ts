import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Simple TTS test without retry logic to isolate the issue

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 seconds timeout
})

export async function POST(req: Request) {
  try {
    const { text = "Hello world test" } = await req.json()
    
    console.log(`[Direct TTS Test] Starting generation for: "${text}"`)
    console.log(`[Direct TTS Test] API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Missing'}`)
    console.log(`[Direct TTS Test] Environment: ${process.env.NODE_ENV}`)
    console.log(`[Direct TTS Test] Timestamp: ${new Date().toISOString()}`)
    
    // Direct call without retry logic
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      speed: 1.0,
    })

    console.log(`[Direct TTS Test] ✅ TTS generation successful`)
    
    // Convert to buffer
    const buffer = Buffer.from(await response.arrayBuffer())
    console.log(`[Direct TTS Test] Generated ${buffer.length} bytes`)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Test': 'Direct-TTS',
      },
    })
    
  } catch (error: any) {
    console.error(`[Direct TTS Test] ❌ Error:`, error)
    console.error(`[Direct TTS Test] Error details:`, {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    })
    
    return NextResponse.json({
      error: 'Direct TTS test failed',
      details: error.message,
      status: error.status,
      code: error.code,
      type: error.type
    }, { status: 500 })
  }
}