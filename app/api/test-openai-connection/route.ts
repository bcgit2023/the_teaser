import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  try {
    console.log('[OpenAI Health Check] Starting connectivity test...')
    
    // Check if API key is configured
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[OpenAI Health Check] No API key found')
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        hasApiKey: false 
      }, { status: 500 })
    }

    console.log(`[OpenAI Health Check] API key configured: ${apiKey.substring(0, 7)}...`)
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
      timeout: 30000, // 30 seconds
    })

    console.log('[OpenAI Health Check] Testing basic API connectivity...')
    
    // Test with a simple API call (list models)
    const models = await openai.models.list()
    
    console.log('[OpenAI Health Check] Successfully connected to OpenAI API')
    console.log(`[OpenAI Health Check] Found ${models.data.length} models`)
    
    // Check if TTS models are available
    const ttsModels = models.data.filter(model => 
      model.id.includes('tts') || model.id.includes('whisper')
    )
    
    console.log(`[OpenAI Health Check] TTS-related models: ${ttsModels.map(m => m.id).join(', ')}`)
    
    return NextResponse.json({
      success: true,
      hasApiKey: true,
      modelsCount: models.data.length,
      ttsModels: ttsModels.map(m => m.id),
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[OpenAI Health Check] Connection failed:', error)
    console.error('[OpenAI Health Check] Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    })
    
    return NextResponse.json({
      error: 'OpenAI connection failed',
      details: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      hasApiKey: !!process.env.OPENAI_API_KEY
    }, { status: 500 })
  }
}