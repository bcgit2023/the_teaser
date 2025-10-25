/**
 * TTS Configuration Management
 * Handles storing and retrieving TTS settings for the application
 */

export interface TTSConfig {
  primaryProvider: 'browser' | 'openai' | 'elevenlabs'
  fallbackProvider: 'openai' | 'elevenlabs'
  browserTTS: {
    voice: string
    rate: number
    pitch: number
    volume: number
  }
  openaiTTS: {
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    model: 'tts-1' | 'tts-1-hd'
    speed: number
  }
  elevenlabsTTS: {
    voiceId: string
    stability: number
    similarityBoost: number
    style: number
    useSpeakerBoost: boolean
  }
}

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  primaryProvider: 'browser',
  fallbackProvider: 'openai',
  browserTTS: {
    voice: 'default',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
  },
  openaiTTS: {
    voice: 'alloy',
    model: 'tts-1',
    speed: 1.0
  },
  elevenlabsTTS: {
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Default Bella voice
    stability: 0.5,
    similarityBoost: 0.5,
    style: 0.0,
    useSpeakerBoost: true
  }
}

export class TTSConfigManager {
  private static readonly STORAGE_KEY = 'tts_config'
  private static config: TTSConfig | null = null

  /**
   * Get the current TTS configuration
   */
  static getConfig(): TTSConfig {
    if (this.config) {
      return this.config
    }

    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          this.config = { ...DEFAULT_TTS_CONFIG, ...parsed } as TTSConfig
          return this.config
        }
      } catch (error) {
        console.warn('Failed to load TTS config from localStorage:', error)
      }
    }

    // Return default config
    this.config = { ...DEFAULT_TTS_CONFIG } as TTSConfig
    return this.config
  }

  /**
   * Update TTS configuration
   */
  static updateConfig(updates: Partial<TTSConfig>): void {
    const currentConfig = this.getConfig()
    this.config = { ...currentConfig, ...updates }

    // Save to localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config))
      } catch (error) {
        console.warn('Failed to save TTS config to localStorage:', error)
      }
    }
  }

  /**
   * Update primary TTS provider
   */
  static setPrimaryProvider(provider: TTSConfig['primaryProvider']): void {
    this.updateConfig({ primaryProvider: provider })
  }

  /**
   * Update fallback TTS provider
   */
  static setFallbackProvider(provider: TTSConfig['fallbackProvider']): void {
    this.updateConfig({ fallbackProvider: provider })
  }

  /**
   * Update browser TTS settings
   */
  static updateBrowserTTS(settings: Partial<TTSConfig['browserTTS']>): void {
    const config = this.getConfig()
    this.updateConfig({
      browserTTS: { ...config.browserTTS, ...settings }
    })
  }

  /**
   * Update OpenAI TTS settings
   */
  static updateOpenAITTS(settings: Partial<TTSConfig['openaiTTS']>): void {
    const config = this.getConfig()
    this.updateConfig({
      openaiTTS: { ...config.openaiTTS, ...settings }
    })
  }

  /**
   * Update ElevenLabs TTS settings
   */
  static updateElevenLabsTTS(settings: Partial<TTSConfig['elevenlabsTTS']>): void {
    const config = this.getConfig()
    this.updateConfig({
      elevenlabsTTS: { ...config.elevenlabsTTS, ...settings }
    })
  }

  /**
   * Reset configuration to defaults
   */
  static resetConfig(): void {
    this.config = { ...DEFAULT_TTS_CONFIG } as TTSConfig
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.STORAGE_KEY)
      } catch (error) {
        console.warn('Failed to remove TTS config from localStorage:', error)
      }
    }
  }

  /**
   * Get available browser voices
   */
  static async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return []
    }

    return new Promise((resolve) => {
      const voices = speechSynthesis.getVoices()
      if (voices.length > 0) {
        resolve(voices)
      } else {
        // Wait for voices to load
        speechSynthesis.onvoiceschanged = () => {
          resolve(speechSynthesis.getVoices())
        }
      }
    })
  }

  /**
   * Test TTS provider connectivity
   */
  static async testProvider(provider: TTSConfig['primaryProvider']): Promise<{
    success: boolean
    error?: string
    latency?: number
  }> {
    const startTime = Date.now()

    try {
      switch (provider) {
        case 'browser':
          if (typeof window === 'undefined' || !window.speechSynthesis) {
            return { success: false, error: 'Browser TTS not supported' }
          }
          
          // Test browser TTS with a simple utterance
          return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance('Test')
            utterance.volume = 0 // Silent test
            utterance.onend = () => {
              resolve({ 
                success: true, 
                latency: Date.now() - startTime 
              })
            }
            utterance.onerror = (error) => {
              resolve({ 
                success: false, 
                error: error.error || 'Browser TTS error' 
              })
            }
            speechSynthesis.speak(utterance)
          })

        case 'openai':
          // Test OpenAI TTS endpoint
          const openaiResponse = await fetch('/api/text-to-speech/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'openai', text: 'Test' })
          })
          
          if (!openaiResponse.ok) {
            return { 
              success: false, 
              error: `OpenAI TTS error: ${openaiResponse.status}` 
            }
          }
          
          return { 
            success: true, 
            latency: Date.now() - startTime 
          }

        case 'elevenlabs':
          // Test ElevenLabs TTS endpoint
          const elevenlabsResponse = await fetch('/api/text-to-speech/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'elevenlabs', text: 'Test' })
          })
          
          if (!elevenlabsResponse.ok) {
            return { 
              success: false, 
              error: `ElevenLabs TTS error: ${elevenlabsResponse.status}` 
            }
          }
          
          return { 
            success: true, 
            latency: Date.now() - startTime 
          }

        default:
          return { success: false, error: 'Unknown provider' }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get TTS provider status
   */
  static async getProviderStatus(): Promise<{
    browser: { available: boolean; error?: string }
    openai: { available: boolean; error?: string }
    elevenlabs: { available: boolean; error?: string }
  }> {
    const [browserTest, openaiTest, elevenlabsTest] = await Promise.all([
      this.testProvider('browser'),
      this.testProvider('openai'),
      this.testProvider('elevenlabs')
    ])

    return {
      browser: { 
        available: browserTest.success, 
        error: browserTest.error 
      },
      openai: { 
        available: openaiTest.success, 
        error: openaiTest.error 
      },
      elevenlabs: { 
        available: elevenlabsTest.success, 
        error: elevenlabsTest.error 
      }
    }
  }
}

// Export singleton instance
export const ttsConfig = TTSConfigManager