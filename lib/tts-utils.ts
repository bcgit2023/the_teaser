/**
 * Text-to-Speech utility functions for consistent TTS usage across the application
 * Now supports Browser TTS as primary, with server TTS as fallback
 */

import { BrowserTTS, TTSConfigManager, getBrowserTTS, type BrowserTTSConfig } from './browser-tts'

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
export type TTSModel = 'tts-1' | 'tts-1-hd'

// ElevenLabs voice types
export type ElevenLabsVoice = 'rachel' | 'adam' | 'bella' | 'antoni' | 'elli' | 'josh' | 'arnold' | 'domi' | 'sam'
export type ElevenLabsModel = 'eleven_monolingual_v1' | 'eleven_multilingual_v1' | 'eleven_multilingual_v2' | 'eleven_turbo_v2'

// TTS Provider types
export type TTSProvider = 'browser' | 'openai' | 'elevenlabs'

export interface TTSRequest {
  text: string
  voice?: TTSVoice
  model?: TTSModel
  speed?: number
}

export interface ElevenLabsTTSRequest {
  text: string
  voice?: ElevenLabsVoice
  model?: ElevenLabsModel
  stability?: number
  similarity_boost?: number
  style?: number
  use_speaker_boost?: boolean
}

/**
 * Generate speech from text using ElevenLabs TTS API
 * @param text The text to convert to speech
 * @param voice The ElevenLabs voice to use (default: 'rachel')
 * @param model The ElevenLabs model to use (default: 'eleven_turbo_v2')
 * @param stability Voice stability (default: 0.5)
 * @param similarity_boost Voice similarity boost (default: 0.75)
 * @returns A Promise that resolves to an audio Blob
 */
export async function generateSpeechWithElevenLabs(
  text: string,
  voice: ElevenLabsVoice = 'rachel',
  model: ElevenLabsModel = 'eleven_turbo_v2',
  stability: number = 0.5,
  similarity_boost: number = 0.75
): Promise<Blob> {
  const response = await fetch('/api/elevenlabs-tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, model, stability, similarity_boost }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to generate speech with ElevenLabs: ${response.status}`)
  }

  return await response.blob()
}

/**
 * Generate speech from text using OpenAI TTS API (fallback)
 * @param text The text to convert to speech
 * @param voice The voice to use (default: 'nova')
 * @param model The TTS model to use (default: 'tts-1-hd')
 * @param speed The speaking speed (default: 1.0)
 * @returns A Promise that resolves to an audio Blob
 */
export async function generateSpeechWithOpenAI(
  text: string,
  voice: TTSVoice = 'nova',
  model: TTSModel = 'tts-1',
  speed: number = 1.0
): Promise<Blob> {
  const response = await fetch('/api/text-to-speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, model, speed }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Failed to generate speech with OpenAI: ${response.status}`)
  }

  return await response.blob()
}

/**
 * Generate speech from text using browser TTS (primary) with server TTS fallback
 * @param text The text to convert to speech
 * @param voice The voice to use (will map to appropriate provider voice)
 * @param model The TTS model to use (optional, uses defaults)
 * @param speed The speaking speed (default: 1.0)
 * @returns A Promise that resolves to an audio Blob or void (for browser TTS)
 */
export async function generateSpeech(
  text: string,
  voice?: TTSVoice | ElevenLabsVoice,
  model?: TTSModel | ElevenLabsModel,
  speed: number = 1.0
): Promise<Blob> {
  const settings = TTSConfigManager.getSettings()
  
  console.log(`[TTS] Attempting speech generation for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
  console.log(`[TTS] Provider priority: ${settings.provider} -> ${settings.fallbackProvider}`)

  // Try browser TTS first if supported and configured
  if (settings.provider === 'browser' && BrowserTTS.isSupported()) {
    try {
      console.log(`[TTS] Trying Browser TTS`)
      await generateSpeechWithBrowser(text, voice, speed)
      console.log(`[TTS] ✅ Browser TTS succeeded`)
      // Return empty blob since browser TTS doesn't return audio data
      return new Blob([], { type: 'audio/wav' })
    } catch (browserError) {
      console.warn(`[TTS] ⚠️ Browser TTS failed:`, browserError)
      // Continue to server TTS fallback
    }
  }

  // Map OpenAI voices to ElevenLabs voices for better consistency
  const voiceMapping: Record<TTSVoice, ElevenLabsVoice> = {
    'nova': 'rachel',    // Female, friendly
    'alloy': 'bella',    // Female, warm
    'echo': 'elli',      // Female, emotional
    'fable': 'domi',     // Female, strong
    'onyx': 'adam',      // Male, deep
    'shimmer': 'antoni'  // Male, well-rounded
  }

  // Determine ElevenLabs voice
  let elevenLabsVoice: ElevenLabsVoice = 'rachel' // default
  if (voice) {
    if (voice in voiceMapping) {
      elevenLabsVoice = voiceMapping[voice as TTSVoice]
    } else {
      elevenLabsVoice = voice as ElevenLabsVoice
    }
  }

  // Determine OpenAI voice
  const openAIVoice: TTSVoice = (voice && voice in voiceMapping) ? voice as TTSVoice : 'nova'

  // Try server TTS based on fallback provider
  const fallbackProvider = settings.fallbackProvider || 'openai'
  
  if (fallbackProvider === 'openai') {
    try {
      console.log(`[TTS] Trying OpenAI with voice: ${openAIVoice}`)
      const audioBlob = await generateSpeechWithOpenAI(text, openAIVoice, model as TTSModel, speed)
      console.log(`[TTS] ✅ OpenAI succeeded - Generated ${audioBlob.size} bytes`)
      return audioBlob
    } catch (openAIError) {
      console.warn(`[TTS] ⚠️ OpenAI failed:`, openAIError)
      
      try {
        // Fallback to ElevenLabs
        console.log(`[TTS] Falling back to ElevenLabs with voice: ${elevenLabsVoice}`)
        const audioBlob = await generateSpeechWithElevenLabs(text, elevenLabsVoice)
        console.log(`[TTS] ✅ ElevenLabs fallback succeeded - Generated ${audioBlob.size} bytes`)
        return audioBlob
      } catch (elevenLabsError) {
        console.error(`[TTS] ❌ Both OpenAI and ElevenLabs failed`)
        console.error(`[TTS] OpenAI error:`, openAIError)
        console.error(`[TTS] ElevenLabs error:`, elevenLabsError)
        
        throw new Error(`TTS failed: OpenAI (${(openAIError as Error).message}) and ElevenLabs (${(elevenLabsError as Error).message})`)
      }
    }
  } else {
    // Try ElevenLabs first
    try {
      console.log(`[TTS] Trying ElevenLabs with voice: ${elevenLabsVoice}`)
      const audioBlob = await generateSpeechWithElevenLabs(text, elevenLabsVoice)
      console.log(`[TTS] ✅ ElevenLabs succeeded - Generated ${audioBlob.size} bytes`)
      return audioBlob
    } catch (elevenLabsError) {
      console.warn(`[TTS] ⚠️ ElevenLabs failed:`, elevenLabsError)
      
      try {
        // Fallback to OpenAI
        console.log(`[TTS] Falling back to OpenAI with voice: ${openAIVoice}`)
        const audioBlob = await generateSpeechWithOpenAI(text, openAIVoice, model as TTSModel, speed)
        console.log(`[TTS] ✅ OpenAI fallback succeeded - Generated ${audioBlob.size} bytes`)
        return audioBlob
      } catch (openAIError) {
        console.error(`[TTS] ❌ Both ElevenLabs and OpenAI failed`)
        console.error(`[TTS] ElevenLabs error:`, elevenLabsError)
        console.error(`[TTS] OpenAI error:`, openAIError)
        
        throw new Error(`TTS failed: ElevenLabs (${(elevenLabsError as Error).message}) and OpenAI (${(openAIError as Error).message})`)
      }
    }
  }
}

/**
 * Generate speech using browser TTS
 * @param text The text to convert to speech
 * @param voice The voice preference (will be mapped to browser voice)
 * @param speed The speaking speed (default: 1.0)
 * @returns A Promise that resolves when speech starts
 */
export async function generateSpeechWithBrowser(
  text: string,
  voice?: TTSVoice | ElevenLabsVoice,
  speed: number = 1.0
): Promise<void> {
  const browserTTS = getBrowserTTS()
  
  // Map TTS voices to browser voice characteristics
  const voicePreferences: Record<string, Partial<BrowserTTSConfig>> = {
    'nova': { pitch: 1.1, rate: speed },      // Female, friendly
    'alloy': { pitch: 1.0, rate: speed },     // Female, warm
    'echo': { pitch: 1.2, rate: speed * 0.9 }, // Female, emotional
    'fable': { pitch: 0.9, rate: speed },     // Female, strong
    'onyx': { pitch: 0.7, rate: speed },      // Male, deep
    'shimmer': { pitch: 0.8, rate: speed },   // Male, well-rounded
    'rachel': { pitch: 1.1, rate: speed },    // Female, friendly
    'bella': { pitch: 1.0, rate: speed },     // Female, warm
    'elli': { pitch: 1.2, rate: speed * 0.9 }, // Female, emotional
    'domi': { pitch: 0.9, rate: speed },      // Female, strong
    'adam': { pitch: 0.7, rate: speed },      // Male, deep
    'antoni': { pitch: 0.8, rate: speed }     // Male, well-rounded
  }

  const voiceConfig = voice ? voicePreferences[voice] || {} : {}
  
  return browserTTS.speak(text, voiceConfig)
}

/**
 * Play audio from a text string using TTS (browser or server-based)
 * @param text The text to speak
 * @param audioElement The HTML audio element to use for server TTS playback (optional for browser TTS)
 * @param voice The voice to use (default: 'nova')
 * @param onStart Callback function to run when audio starts playing
 * @param onEnd Callback function to run when audio finishes playing
 * @param onError Callback function to run when an error occurs
 * @param delayMs Optional delay in milliseconds before starting playback (default: 500ms)
 * @returns A Promise that resolves when the audio starts playing
 */
export async function playTextToSpeech(
  text: string,
  audioElement?: HTMLAudioElement,
  voice: TTSVoice | ElevenLabsVoice = 'nova',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (error: any) => void,
  delayMs: number = 500
): Promise<void> {
  try {
    const settings = TTSConfigManager.getSettings()
    
    // If browser TTS is primary and supported, use it directly
    if (settings.provider === 'browser' && BrowserTTS.isSupported()) {
      try {
        console.log('[TTS] Using browser TTS for playback')
        
        // Add delay before playing to avoid conflicts with speech recognition
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
        
        // Set up browser TTS callbacks
        const browserCallbacks = {
          onStart: onStart,
          onEnd: onEnd,
          onError: onError
        }
        
        // Create browser TTS with callbacks
        const browserTTS = new BrowserTTS(settings.browserConfig, browserCallbacks)
        await browserTTS.speak(text)
        return
      } catch (browserError) {
        console.warn('[TTS] Browser TTS failed, falling back to server TTS:', browserError)
        // Continue to server TTS fallback
      }
    }
    
    // Server TTS fallback
    if (!audioElement) {
      throw new Error('Audio element is required for server TTS playback')
    }
    
    console.log('[TTS] Using server TTS for playback')
    
    // Generate speech from text using server TTS
    const audioBlob = await generateSpeech(text, voice)
    
    // Check if we got an empty blob (from browser TTS that already played)
    if (audioBlob.size === 0) {
      console.log('[TTS] Browser TTS already handled playback')
      return
    }
    
    const audioUrl = URL.createObjectURL(audioBlob)
    
    // Stop any currently playing audio
    audioElement.pause()
    audioElement.currentTime = 0
    
    // Set up event handlers
    audioElement.onplay = onStart ? () => onStart() : null
    audioElement.onended = () => {
      if (onEnd) onEnd()
      URL.revokeObjectURL(audioUrl)
    }
    audioElement.onerror = (e) => {
      console.error('Audio playback error:', e)
      URL.revokeObjectURL(audioUrl)
      if (onError) onError(e)
    }
    
    // Set source and play
    audioElement.src = audioUrl
    
    // Add a delay before playing to avoid conflicts with speech recognition
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
    
    await audioElement.play()
  } catch (error) {
    console.error('Error in playTextToSpeech:', error)
    if (onError) onError(error)
    throw error
  }
}

/**
 * Simple text-to-speech function that automatically chooses the best method
 * @param text The text to speak
 * @param voice The voice to use (optional)
 * @param onStart Callback when speech starts (optional)
 * @param onEnd Callback when speech ends (optional)
 * @param onError Callback when error occurs (optional)
 * @returns A Promise that resolves when speech starts
 */
export async function speakText(
  text: string,
  voice?: TTSVoice | ElevenLabsVoice,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (error: any) => void
): Promise<void> {
  const settings = TTSConfigManager.getSettings()
  
  // Use browser TTS if available and configured
  if (settings.provider === 'browser' && BrowserTTS.isSupported()) {
    const browserTTS = new BrowserTTS(settings.browserConfig, {
      onStart,
      onEnd,
      onError
    })
    return browserTTS.speak(text)
  }
  
  // Fallback to server TTS with a temporary audio element
  const audioElement = new Audio()
  return playTextToSpeech(text, audioElement, voice, onStart, onEnd, onError)
}

/**
 * Get an appropriate voice based on the interaction mode
 * @param mode The interaction mode
 * @param provider The TTS provider to get voice for ('auto' uses ElevenLabs mapping)
 * @returns The appropriate voice for the mode
 */
export function getVoiceForMode(
  mode: 'proactive' | 'reactive' | 'assessment',
  provider: 'openai' | 'elevenlabs' | 'auto' = 'auto'
): TTSVoice | ElevenLabsVoice {
  // Define voice mappings for each mode
  const voiceMappings = {
    proactive: {
      openai: 'nova' as TTSVoice,      // Friendly, engaging voice
      elevenlabs: 'rachel' as ElevenLabsVoice  // Young, friendly female
    },
    reactive: {
      openai: 'onyx' as TTSVoice,      // Calm, supportive voice  
      elevenlabs: 'adam' as ElevenLabsVoice    // Deep, confident male
    },
    assessment: {
      openai: 'fable' as TTSVoice,     // Clear, instructional voice
      elevenlabs: 'bella' as ElevenLabsVoice  // Soft, warm female
    }
  }

  const modeVoices = voiceMappings[mode] || voiceMappings.proactive

  switch (provider) {
    case 'openai':
      return modeVoices.openai
    case 'elevenlabs':
      return modeVoices.elevenlabs
    case 'auto':
    default:
      // Return ElevenLabs voice for auto mode (since it's primary)
      return modeVoices.elevenlabs
  }
}
