/**
 * Text-to-Speech utility functions for consistent TTS usage across the application
 */

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
export type TTSModel = 'tts-1' | 'tts-1-hd'

// ElevenLabs voice types
export type ElevenLabsVoice = 'rachel' | 'adam' | 'bella' | 'antoni' | 'elli' | 'josh' | 'arnold' | 'domi' | 'sam'
export type ElevenLabsModel = 'eleven_monolingual_v1' | 'eleven_multilingual_v1' | 'eleven_multilingual_v2' | 'eleven_turbo_v2'

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
 * @param model The TTS model to use (default: 'tts-1')
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
 * Generate speech from text with automatic fallback (ElevenLabs first, then OpenAI)
 * @param text The text to convert to speech
 * @param voice The voice to use (will map to appropriate provider voice)
 * @param model The TTS model to use (optional, uses defaults)
 * @param speed The speaking speed for OpenAI (default: 1.0)
 * @returns A Promise that resolves to an audio Blob
 */
export async function generateSpeech(
  text: string,
  voice?: TTSVoice | ElevenLabsVoice,
  model?: TTSModel | ElevenLabsModel,
  speed: number = 1.0
): Promise<Blob> {
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

  // Determine OpenAI voice (fallback)
  const openAIVoice: TTSVoice = (voice && voice in voiceMapping) ? voice as TTSVoice : 'nova'

  console.log(`[TTS] Attempting speech generation for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
  
  try {
    // Try ElevenLabs first
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
      
      // Throw a combined error message
      throw new Error(`TTS failed: ElevenLabs (${(elevenLabsError as Error).message}) and OpenAI (${(openAIError as Error).message})`)
    }
  }
}

/**
 * Play audio from a text string using the text-to-speech API
 * @param text The text to speak
 * @param audioElement The HTML audio element to use for playback
 * @param voice The voice to use (default: 'nova')
 * @param onStart Callback function to run when audio starts playing
 * @param onEnd Callback function to run when audio finishes playing
 * @param onError Callback function to run when an error occurs
 * @param delayMs Optional delay in milliseconds before starting playback (default: 500ms)
 * @returns A Promise that resolves when the audio starts playing
 */
export async function playTextToSpeech(
  text: string,
  audioElement: HTMLAudioElement,
  voice: TTSVoice = 'nova',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (error: any) => void,
  delayMs: number = 500
): Promise<void> {
  try {
    // Generate speech from text
    const audioBlob = await generateSpeech(text, voice)
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
