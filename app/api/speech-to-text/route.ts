import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Supported audio formats for Whisper API
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB limit for Whisper API

export async function POST(req: NextRequest) {
  try {
    // Parse the form data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const language = formData.get('language') as string || 'en'
    const prompt = formData.get('prompt') as string || ''
    const responseFormat = formData.get('response_format') as string || 'json'
    const temperature = parseFloat(formData.get('temperature') as string || '0')

    // Validate audio file
    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Check file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` },
        { status: 400 }
      )
    }

    // Check file format
    const fileExtension = audioFile.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !SUPPORTED_FORMATS.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Unsupported file format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}` },
        { status: 400 }
      )
    }

    // Convert File to ArrayBuffer for OpenAI API
    const arrayBuffer = await audioFile.arrayBuffer()

    // Create a File-like object for OpenAI API
    const fileForAPI = new File([arrayBuffer], audioFile.name, {
      type: audioFile.type,
    })

    console.log(`[STT] Processing audio file: ${audioFile.name} (${audioFile.size} bytes)`)

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fileForAPI,
      model: 'whisper-1',
      language: language || undefined,
      prompt: prompt || undefined,
      response_format: responseFormat as any || 'json',
      temperature: temperature || 0,
    })

    console.log('[STT] Transcription completed successfully')

    // Return the transcription result
    if (responseFormat === 'json' || responseFormat === 'verbose_json') {
      return NextResponse.json({
        success: true,
        text: typeof transcription === 'string' ? transcription : transcription.text,
        transcription: transcription
      })
    } else {
      // For text, srt, vtt formats, return as plain text
      const textResult = typeof transcription === 'string' ? transcription : transcription.text
      return new NextResponse(textResult, {
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

  } catch (error: any) {
    console.error('[STT] OpenAI Whisper API error:', error)
    
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
    } else if (error.status === 413) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 413 }
      )
    } else {
      return NextResponse.json(
        { 
          error: 'Failed to transcribe audio', 
          details: error.message,
          success: false
        },
        { status: 500 }
      )
    }
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'speech-to-text',
    supported_formats: SUPPORTED_FORMATS,
    max_file_size_mb: MAX_FILE_SIZE / (1024 * 1024)
  })
}