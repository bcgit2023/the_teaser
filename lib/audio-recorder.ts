/**
 * Audio Recording Utilities for Vercel-Compatible STT
 * Provides MediaRecorder wrapper with cross-browser compatibility
 */

export interface AudioRecorderConfig {
  mimeType?: string
  audioBitsPerSecond?: number
  maxDuration?: number // in milliseconds
  maxFileSize?: number // in bytes
}

export interface AudioRecorderCallbacks {
  onStart?: () => void
  onStop?: (audioBlob: Blob) => void
  onError?: (error: Error) => void
  onDataAvailable?: (event: BlobEvent) => void
  onMaxDurationReached?: () => void
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  private audioChunks: Blob[] = []
  private config: AudioRecorderConfig
  private callbacks: AudioRecorderCallbacks
  private maxDurationTimer: NodeJS.Timeout | null = null
  private isRecording = false

  constructor(config: AudioRecorderConfig = {}, callbacks: AudioRecorderCallbacks = {}) {
    this.config = {
      mimeType: this.getSupportedMimeType(),
      audioBitsPerSecond: 128000,
      maxDuration: 60000, // 60 seconds default
      maxFileSize: 25 * 1024 * 1024, // 25MB default
      ...config
    }
    this.callbacks = callbacks
  }

  /**
   * Get the best supported MIME type for the current browser
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav'
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm' // fallback
  }

  /**
   * Check if audio recording is supported in the current browser
   */
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && 
              typeof navigator.mediaDevices.getUserMedia === 'function' && 
              window.MediaRecorder)
  }

  /**
   * Request microphone permission and initialize audio stream
   */
  async requestPermission(): Promise<boolean> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })
      return true
    } catch (error) {
      console.error('[AudioRecorder] Permission denied or error:', error)
      this.callbacks.onError?.(new Error('Microphone permission denied'))
      return false
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<boolean> {
    if (this.isRecording) {
      console.warn('[AudioRecorder] Already recording')
      return false
    }

    if (!this.audioStream) {
      const hasPermission = await this.requestPermission()
      if (!hasPermission) {
        return false
      }
    }

    try {
      this.audioChunks = []
      
      const options: MediaRecorderOptions = {
        mimeType: this.config.mimeType!,
        audioBitsPerSecond: this.config.audioBitsPerSecond
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream!, options)

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
          this.callbacks.onDataAvailable?.(event)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop()
      }

      this.mediaRecorder.onerror = (event) => {
        console.error('[AudioRecorder] MediaRecorder error:', event)
        this.callbacks.onError?.(new Error('Recording failed'))
      }

      this.mediaRecorder.start(1000) // Collect data every second
      this.isRecording = true

      // Set max duration timer
      if (this.config.maxDuration) {
        this.maxDurationTimer = setTimeout(() => {
          this.callbacks.onMaxDurationReached?.()
          this.stopRecording()
        }, this.config.maxDuration)
      }

      this.callbacks.onStart?.()
      console.log('[AudioRecorder] Recording started')
      return true

    } catch (error) {
      console.error('[AudioRecorder] Failed to start recording:', error)
      this.callbacks.onError?.(error as Error)
      return false
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('[AudioRecorder] Not currently recording')
      return
    }

    this.mediaRecorder.stop()
    this.isRecording = false

    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
    }

    console.log('[AudioRecorder] Recording stopped')
  }

  /**
   * Handle the recording stop event and create audio blob
   */
  private handleRecordingStop(): void {
    if (this.audioChunks.length === 0) {
      this.callbacks.onError?.(new Error('No audio data recorded'))
      return
    }

    const audioBlob = new Blob(this.audioChunks, { 
      type: this.config.mimeType 
    })

    // Check file size
    if (this.config.maxFileSize && audioBlob.size > this.config.maxFileSize) {
      this.callbacks.onError?.(new Error(`Audio file too large: ${audioBlob.size} bytes`))
      return
    }

    console.log(`[AudioRecorder] Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`)
    this.callbacks.onStop?.(audioBlob)
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.isRecording) {
      this.stopRecording()
    }

    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
      this.audioStream = null
    }

    this.mediaRecorder = null
    this.audioChunks = []
  }

  /**
   * Get current recording state
   */
  getState(): {
    isRecording: boolean
    isSupported: boolean
    hasPermission: boolean
    mimeType: string
  } {
    return {
      isRecording: this.isRecording,
      isSupported: AudioRecorder.isSupported(),
      hasPermission: !!this.audioStream,
      mimeType: this.config.mimeType!
    }
  }
}

/**
 * Utility function to convert audio blob to different formats if needed
 */
export async function convertAudioBlob(
  blob: Blob, 
  _targetMimeType: string
): Promise<Blob> {
  // For now, return the original blob
  // In the future, we could add audio conversion logic here
  return blob
}

/**
 * Utility function to compress audio blob
 */
export async function compressAudioBlob(
  blob: Blob, 
  _quality: number = 0.8
): Promise<Blob> {
  // For now, return the original blob
  // In the future, we could add audio compression logic here
  return blob
}

/**
 * Create a filename for the audio recording
 */
export function createAudioFilename(mimeType: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const extension = mimeType.includes('webm') ? 'webm' : 
                   mimeType.includes('mp4') ? 'm4a' : 
                   mimeType.includes('mpeg') ? 'mp3' : 'wav'
  return `recording-${timestamp}.${extension}`
}