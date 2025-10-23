/**
 * Text-to-Speech utility functions for consistent TTS usage across the application
 */

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
export type TTSModel = 'tts-1' | 'tts-1-hd'

export interface TTSRequest {
  text: string
  voice?: TTSVoice
  model?: TTSModel
  speed?: number
}

/**
 * Generate speech from text using the text-to-speech API
 * @param text The text to convert to speech
 * @param voice The voice to use (default: 'nova')
 * @param model The TTS model to use (default: 'tts-1')
 * @param speed The speaking speed (default: 1.0)
 * @returns A Promise that resolves to an audio Blob
 */
export async function generateSpeech(
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
    throw new Error(errorData.error || `Failed to generate speech: ${response.status}`)
  }

  return await response.blob()
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
 * @returns The appropriate voice for the mode
 */
export function getVoiceForMode(mode: 'proactive' | 'reactive' | 'assessment'): TTSVoice {
  switch (mode) {
    case 'proactive':
      return 'nova' // Friendly, engaging voice
    case 'reactive':
      return 'onyx' // Calm, supportive voice
    case 'assessment':
      return 'fable' // Clear, instructional voice
    default:
      return 'nova' // Default voice
  }
}
