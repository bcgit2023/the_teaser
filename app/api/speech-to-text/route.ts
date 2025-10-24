import { NextRequest, NextResponse } from 'next/server';
import { retryOpenAICall } from '@/lib/retry-utils';

// Increase function timeout to handle longer OpenAI API calls
export const maxDuration = 300; // 5 minutes (maximum for Hobby plan)

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

    // Check for empty or very small files
    if (audioFile.size < 100) { // Less than 100 bytes is likely invalid
      console.error('[STT] Audio file too small:', audioFile.size, 'bytes')
      return NextResponse.json(
        { error: 'Audio file is too small or empty. Please record some audio and try again.' },
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

    // Special handling for WebM files - they often have compatibility issues
    if (fileExtension === 'webm') {
      // If it's a very small WebM file, it might be corrupted
      if (audioFile.size < 1000) {
        console.error('[STT] WebM file too small, likely corrupted:', audioFile.size, 'bytes')
        return NextResponse.json(
          { error: 'WebM audio file appears to be corrupted or too short. Please try recording again.' },
          { status: 400 }
        )
      }
    }

    // Convert File to ArrayBuffer for OpenAI API
    const arrayBuffer = await audioFile.arrayBuffer()

    // Basic validation of audio file content
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Check if file has some basic audio file signatures
    const hasValidHeader = (
      // WebM signature
      (uint8Array[0] === 0x1A && uint8Array[1] === 0x45 && uint8Array[2] === 0xDF && uint8Array[3] === 0xA3) ||
      // WAV signature
      (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46) ||
      // MP3 signature
      (uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0) ||
      // MP4/M4A signature
      (uint8Array[4] === 0x66 && uint8Array[5] === 0x74 && uint8Array[6] === 0x79 && uint8Array[7] === 0x70) ||
      // OGG signature
      (uint8Array[0] === 0x4F && uint8Array[1] === 0x67 && uint8Array[2] === 0x67 && uint8Array[3] === 0x53)
    )

    if (!hasValidHeader) {
      console.error('[STT] Invalid audio file header detected')
      return NextResponse.json(
        { error: 'Invalid audio file format. Please ensure you are uploading a valid audio file.' },
        { status: 400 }
      )
    }

    // Create File object for OpenAI API
    const fileForAPI = new File([arrayBuffer], audioFile.name, {
      type: audioFile.type,
    })

    console.log(`[STT] Processing audio file: ${audioFile.name} (${audioFile.size} bytes, ${audioFile.type})`)

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('[STT] OpenAI API key is not configured')
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    // Enhanced logging for debugging
    console.log('[STT] Environment info:', {
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
      apiKeyPresent: !!process.env.OPENAI_API_KEY,
      apiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 7) + '...',
      timestamp: new Date().toISOString()
    })

    // Call OpenAI Whisper API using native fetch with retry logic for better reliability
    console.log('[STT] Calling OpenAI Whisper API with native fetch and retry logic...')
    try {
      const transcription = await retryOpenAICall(async () => {
        const formData = new FormData()
        formData.append('file', fileForAPI)
        formData.append('model', 'whisper-1')
        if (language) formData.append('language', language)
        if (prompt) formData.append('prompt', prompt)
        if (responseFormat) formData.append('response_format', responseFormat)
        if (temperature !== undefined) formData.append('temperature', temperature.toString())

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
          // Increase timeout for better reliability
          signal: AbortSignal.timeout(60000), // 60 second timeout
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[STT] OpenAI API error response:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          })
          
          // Create error with proper status for retry logic
          const error = new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
          ;(error as any).status = response.status
          throw error
        }

        return await response.json()
      }, 'Whisper transcription')

      const transcriptionText = typeof transcription === 'string' ? transcription : transcription.text || 'No text'
      console.log('[STT] Transcription completed successfully:', transcriptionText.substring(0, 100) + '...')

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
    } catch (openaiError: any) {
      console.error('[STT] OpenAI API Error after retries:', openaiError)
      console.error('[STT] OpenAI Error Details:', {
        message: openaiError.message,
        type: openaiError.type,
        code: openaiError.code,
        status: openaiError.status,
        cause: openaiError.cause,
        attempts: openaiError.attempts || 'unknown',
        lastError: openaiError.lastError?.message || 'unknown',
        stack: openaiError.stack,
        fullError: JSON.stringify(openaiError, null, 2)
      })
      
      // Return specific error based on OpenAI error type
      if (openaiError.message?.includes('Invalid file format')) {
        // Special handling for WebM files
        if (fileExtension === 'webm') {
          return NextResponse.json(
            { 
              error: 'WebM audio format is not compatible with OpenAI Whisper. Please try using a different recording format like MP3 or WAV.',
              details: openaiError.message,
              suggestion: 'Try using a different browser or recording app that supports MP3/WAV format.'
            },
            { status: 400 }
          )
        }
        return NextResponse.json(
          { error: `Audio format not supported by OpenAI Whisper: ${openaiError.message}` },
          { status: 400 }
        )
      } else if (openaiError.status === 401) {
        return NextResponse.json(
          { error: 'OpenAI API authentication failed. Please check your API key.' },
          { status: 500 }
        )
      } else if (openaiError.message?.includes('Connection error') || openaiError.code === 'ECONNRESET' || openaiError.code === 'ENOTFOUND') {
        return NextResponse.json(
          { 
            error: 'Network connection error to OpenAI API after multiple retry attempts. This may be a temporary issue with Vercel or OpenAI servers.',
            details: {
              type: openaiError.type,
              code: openaiError.code,
              status: openaiError.status,
              message: openaiError.message,
              attempts: openaiError.attempts || 'multiple',
              suggestion: 'The system automatically retried the request multiple times. Please try again in a few moments. If the issue persists, it may be a temporary network connectivity issue.'
            }
          },
          { status: 503 } // Service Unavailable
        )
      } else {
        return NextResponse.json(
          { 
            error: `OpenAI Whisper API error: ${openaiError.message || 'Unknown error'}`,
            details: {
              type: openaiError.type,
              code: openaiError.code,
              status: openaiError.status,
              cause: openaiError.cause?.message || openaiError.cause
            }
          },
          { status: 500 }
        )
      }
    }

  } catch (error: any) {
    console.error('[STT] OpenAI Whisper API error:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack,
      fullError: error
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
    } else if (error.status === 413) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 413 }
      )
    } else if (error.status === 400) {
      return NextResponse.json(
        { 
          error: 'Bad request to OpenAI API', 
          details: error.message,
          success: false
        },
        { status: 400 }
      )
    } else {
      return NextResponse.json(
        { 
          error: 'Failed to transcribe audio', 
          details: error.message,
          errorType: error.type || 'unknown',
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