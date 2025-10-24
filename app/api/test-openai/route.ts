import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { retryOpenAICall } from '@/lib/retry-utils'

// Increase function timeout to handle longer OpenAI API calls
export const maxDuration = 300; // 5 minutes (maximum for Hobby plan)

export async function GET() {
  console.log('[TEST-OPENAI] Starting OpenAI connection test...')
  
  try {
    // Check if API key is present
    const apiKey = process.env.OPENAI_API_KEY
    console.log('[TEST-OPENAI] API Key present:', !!apiKey)
    console.log('[TEST-OPENAI] API Key starts with:', apiKey?.substring(0, 7) + '...')
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'OPENAI_API_KEY environment variable is not set',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
      timeout: 60000, // 60 seconds timeout
      maxRetries: 3, // Retry failed requests up to 3 times
      baseURL: 'https://api.openai.com/v1', // Explicitly set base URL
    })

    console.log('[TEST-OPENAI] OpenAI client initialized')

    // Test 1: Simple chat completion with retry logic
    console.log('[TEST-OPENAI] Testing chat completion with retry logic...')
    let chatResult = 'Failed'
    try {
      const chatResponse = await retryOpenAICall(async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "Hello from Vercel"' }],
          max_tokens: 10
        })
      }, 'Chat completion test')
      
      chatResult = chatResponse.choices[0].message.content || 'No content'
      console.log('[TEST-OPENAI] Chat completion successful:', chatResult)
    } catch (chatError: any) {
      console.error('[TEST-OPENAI] Chat completion failed after retries:', chatError.message)
      throw new Error(`Chat completion failed after retries: ${chatError.message}`)
    }

    // Test 2: List models to verify API access
    console.log('[TEST-OPENAI] Testing model access...')
    const models = await openai.models.list()
    const whisperModel = models.data.find(model => model.id === 'whisper-1')
    console.log('[TEST-OPENAI] Models accessible, Whisper-1 available:', !!whisperModel)

    // Test 3: Test Whisper API access using native fetch
    console.log('[TEST-OPENAI] Testing Whisper API access with fetch...')
    let whisperStatus = 'unknown'
    let whisperDetails = ''
    try {
      const formData = new FormData()
      const testBuffer = Buffer.from('test')
      const testBlob = new Blob([testBuffer], { type: 'audio/mpeg' })
      formData.append('file', testBlob, 'test.mp3')
      formData.append('model', 'whisper-1')
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      })
      
      const result = await response.text()
      console.log('[TEST-OPENAI] Whisper fetch response status:', response.status)
      console.log('[TEST-OPENAI] Whisper fetch response:', result)
      
      whisperStatus = response.status === 400 ? 'accessible_400_expected' : `error_${response.status}`
      whisperDetails = `Status: ${response.status}, Response: ${result}`
    } catch (whisperError: any) {
      console.log('[TEST-OPENAI] Whisper fetch error:', whisperError.message)
      whisperStatus = 'error'
      whisperDetails = whisperError.message
    }

    console.log('[TEST-OPENAI] All tests completed successfully')

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'local',
      tests: {
        apiKeyPresent: !!apiKey,
        apiKeyPrefix: apiKey?.substring(0, 7) + '...',
        chatCompletion: {
          success: true,
          response: chatResult
        },
        modelAccess: {
          success: true,
          whisperAvailable: !!whisperModel,
          totalModels: models.data.length
        },
        whisperApiAccess: {
          status: whisperStatus,
          accessible: whisperStatus === 'accessible_400_expected',
          details: whisperDetails
        }
      }
    })

  } catch (error: any) {
    console.error('[TEST-OPENAI] Test failed:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    })

    // Provide more specific error messages
    let errorMessage = error.message || 'Unknown error'
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'DNS resolution failed - cannot reach OpenAI API'
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused by OpenAI API'
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout to OpenAI API'
    } else if (error.status === 401) {
      errorMessage = 'Invalid OpenAI API key'
    } else if (error.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded'
    } else if (error.status === 500) {
      errorMessage = 'OpenAI API server error'
    } else if (error.message.includes('fetch')) {
      errorMessage = `Network error: ${error.message}`
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorDetails: {
        originalMessage: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
        name: error.name
      },
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'local'
    }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to test OpenAI connection'
  }, { status: 405 })
}