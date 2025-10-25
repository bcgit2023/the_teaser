/**
 * Browser TTS Utilities using Web Speech API
 * Provides text-to-speech functionality using browser's built-in capabilities
 */

export interface BrowserTTSConfig {
  voice?: SpeechSynthesisVoice | null
  rate?: number // 0.1 to 10
  pitch?: number // 0 to 2
  volume?: number // 0 to 1
  lang?: string
}

export interface BrowserTTSCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: Error) => void
  onPause?: () => void
  onResume?: () => void
  onBoundary?: (event: SpeechSynthesisEvent) => void
}

export class BrowserTTS {
  private synthesis: SpeechSynthesis
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private config: Required<BrowserTTSConfig>
  private callbacks: BrowserTTSCallbacks
  private isInitialized = false

  constructor(config: BrowserTTSConfig = {}, callbacks: BrowserTTSCallbacks = {}) {
    this.synthesis = window.speechSynthesis
    this.config = {
      voice: null,
      rate: 1,
      pitch: 1,
      volume: 1,
      lang: 'en-US',
      ...config
    }
    this.callbacks = callbacks
  }

  /**
   * Check if browser TTS is supported
   */
  static isSupported(): boolean {
    return !!(typeof window !== 'undefined' && 
              window.speechSynthesis && 
              typeof window.speechSynthesis.speak === 'function')
  }

  /**
   * Initialize the TTS system and load voices
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    return new Promise((resolve) => {
      // Wait for voices to be loaded
      const loadVoices = () => {
        const voices = this.synthesis.getVoices()
        if (voices.length > 0) {
          this.isInitialized = true
          console.log(`[BrowserTTS] Initialized with ${voices.length} voices`)
          resolve()
        } else {
          // Some browsers load voices asynchronously
          setTimeout(loadVoices, 100)
        }
      }

      // Listen for voice changes
      this.synthesis.onvoiceschanged = loadVoices
      loadVoices()
    })
  }

  /**
   * Get available voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices()
  }

  /**
   * Get voices filtered by language
   */
  getVoicesByLanguage(lang: string): SpeechSynthesisVoice[] {
    return this.getVoices().filter(voice => 
      voice.lang.toLowerCase().startsWith(lang.toLowerCase())
    )
  }

  /**
   * Get the best voice for the current language
   */
  getBestVoice(lang?: string): SpeechSynthesisVoice | null {
    const targetLang = lang || this.config.lang
    const voices = this.getVoices()
    
    if (voices.length === 0) return null

    // Try to find a voice that matches the language exactly
    let bestVoice = voices.find(voice => 
      voice.lang.toLowerCase() === targetLang.toLowerCase()
    )

    // If no exact match, try to find one that starts with the language code
    if (!bestVoice) {
      const langCode = targetLang.split('-')[0]
      bestVoice = voices.find(voice => 
        voice.lang.toLowerCase().startsWith(langCode.toLowerCase())
      )
    }

    // If still no match, prefer default or local voices
    if (!bestVoice) {
      bestVoice = voices.find(voice => voice.default) || 
                  voices.find(voice => voice.localService) ||
                  voices[0]
    }

    return bestVoice
  }

  /**
   * Speak the given text
   */
  async speak(text: string, config?: Partial<BrowserTTSConfig>): Promise<void> {
    if (!BrowserTTS.isSupported()) {
      throw new Error('Browser TTS is not supported')
    }

    if (!this.isInitialized) {
      await this.initialize()
    }

    // Stop any current speech
    this.stop()

    const mergedConfig = { ...this.config, ...config }
    
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)
      
      // Set voice
      const voice = mergedConfig.voice || this.getBestVoice(mergedConfig.lang)
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      } else {
        utterance.lang = mergedConfig.lang
      }

      // Set speech parameters
      utterance.rate = Math.max(0.1, Math.min(10, mergedConfig.rate))
      utterance.pitch = Math.max(0, Math.min(2, mergedConfig.pitch))
      utterance.volume = Math.max(0, Math.min(1, mergedConfig.volume))

      // Set up event handlers
      utterance.onstart = () => {
        console.log('[BrowserTTS] Speech started')
        this.callbacks.onStart?.()
      }

      utterance.onend = () => {
        console.log('[BrowserTTS] Speech ended')
        this.currentUtterance = null
        this.callbacks.onEnd?.()
        resolve()
      }

      utterance.onerror = (event) => {
        console.error('[BrowserTTS] Speech error:', event.error)
        this.currentUtterance = null
        const error = new Error(`Speech synthesis failed: ${event.error}`)
        this.callbacks.onError?.(error)
        reject(error)
      }

      utterance.onpause = () => {
        console.log('[BrowserTTS] Speech paused')
        this.callbacks.onPause?.()
      }

      utterance.onresume = () => {
        console.log('[BrowserTTS] Speech resumed')
        this.callbacks.onResume?.()
      }

      utterance.onboundary = (event) => {
        this.callbacks.onBoundary?.(event)
      }

      this.currentUtterance = utterance
      
      console.log(`[BrowserTTS] Speaking: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
      console.log(`[BrowserTTS] Voice: ${voice?.name || 'default'} (${utterance.lang})`)
      console.log(`[BrowserTTS] Rate: ${utterance.rate}, Pitch: ${utterance.pitch}, Volume: ${utterance.volume}`)
      
      this.synthesis.speak(utterance)
    })
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel()
      this.currentUtterance = null
      console.log('[BrowserTTS] Speech stopped')
    }
  }

  /**
   * Pause current speech
   */
  pause(): void {
    if (this.synthesis.speaking && !this.synthesis.paused) {
      this.synthesis.pause()
      console.log('[BrowserTTS] Speech paused')
    }
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    if (this.synthesis.paused) {
      this.synthesis.resume()
      console.log('[BrowserTTS] Speech resumed')
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis.speaking
  }

  /**
   * Check if currently paused
   */
  isPaused(): boolean {
    return this.synthesis.paused
  }

  /**
   * Get current utterance
   */
  getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<BrowserTTSConfig> {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BrowserTTSConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * TTS Configuration Management
 */
export interface TTSSettings {
  provider: 'browser' | 'openai' | 'elevenlabs'
  browserConfig: BrowserTTSConfig
  fallbackProvider?: 'openai' | 'elevenlabs'
}

export class TTSConfigManager {
  private static readonly STORAGE_KEY = 'tts-settings'

  /**
   * Get TTS settings from localStorage
   */
  static getSettings(): TTSSettings {
    if (typeof window === 'undefined') {
      return this.getDefaultSettings()
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...this.getDefaultSettings(), ...parsed }
      }
    } catch (error) {
      console.error('[TTSConfigManager] Error loading settings:', error)
    }

    return this.getDefaultSettings()
  }

  /**
   * Save TTS settings to localStorage
   */
  static saveSettings(settings: Partial<TTSSettings>): void {
    if (typeof window === 'undefined') return

    try {
      const current = this.getSettings()
      const updated = { ...current, ...settings }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated))
      console.log('[TTSConfigManager] Settings saved:', updated)
    } catch (error) {
      console.error('[TTSConfigManager] Error saving settings:', error)
    }
  }

  /**
   * Get default TTS settings
   */
  static getDefaultSettings(): TTSSettings {
    return {
      provider: 'browser',
      browserConfig: {
        voice: null,
        rate: 1,
        pitch: 1,
        volume: 1,
        lang: 'en-US'
      },
      fallbackProvider: 'openai'
    }
  }

  /**
   * Reset settings to default
   */
  static resetSettings(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('[TTSConfigManager] Settings reset to default')
    } catch (error) {
      console.error('[TTSConfigManager] Error resetting settings:', error)
    }
  }
}

/**
 * Global browser TTS instance
 */
let globalBrowserTTS: BrowserTTS | null = null

/**
 * Get or create global browser TTS instance
 */
export function getBrowserTTS(): BrowserTTS {
  if (!globalBrowserTTS) {
    const settings = TTSConfigManager.getSettings()
    globalBrowserTTS = new BrowserTTS(settings.browserConfig)
  }
  return globalBrowserTTS
}

/**
 * Quick speak function using global instance
 */
export async function speakText(text: string, config?: Partial<BrowserTTSConfig>): Promise<void> {
  const tts = getBrowserTTS()
  return tts.speak(text, config)
}

/**
 * Test function for browser TTS
 */
export function testBrowserTTS(): void {
  console.log('=== Browser TTS Test ===')
  
  if (!BrowserTTS.isSupported()) {
    console.error('❌ Browser TTS is not supported')
    return
  }

  console.log('✅ Browser TTS is supported')
  
  const tts = new BrowserTTS()
  tts.initialize().then(() => {
    const voices = tts.getVoices()
    console.log(`📢 Available voices: ${voices.length}`)
    
    voices.slice(0, 5).forEach((voice, index) => {
      console.log(`  ${index + 1}. ${voice.name} (${voice.lang}) ${voice.default ? '[DEFAULT]' : ''}`)
    })

    const bestVoice = tts.getBestVoice()
    console.log(`🎯 Best voice: ${bestVoice?.name || 'none'} (${bestVoice?.lang || 'unknown'})`)
    
    // Test speech
    console.log('🗣️ Testing speech...')
    tts.speak('Hello! This is a test of browser text-to-speech.')
      .then(() => console.log('✅ Speech completed'))
      .catch((error) => console.error('❌ Speech error:', error))
  })
  
  console.log('=== End Test ===')
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).testBrowserTTS = testBrowserTTS
}