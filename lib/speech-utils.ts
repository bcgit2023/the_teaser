/**
 * Speech recognition utility functions for consistent speech-to-text usage across the application
 * Includes hybrid approach: OpenAI Whisper API (primary) + Web Speech API (fallback)
 * Provides browser compatibility handling, retry mechanisms, and centralized microphone access management
 */

import { AudioRecorder, AudioRecorderConfig, AudioRecorderCallbacks, createAudioFilename } from './audio-recorder'

// Define a type for the speech recognition event
export interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
    isFinal?: boolean;
  };
}

// Define a type for the speech recognition error event
export interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

// Define a type for the speech recognition instance
export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// Define retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 8000,  // 8 seconds
  retryableErrors: ['network', 'service-not-allowed', 'bad-grammar']
};

// Global instance to ensure only one speech recognition instance is active at a time
let globalRecognitionInstance: SpeechRecognitionInstance | null = null;
// @ts-ignore - Variable is used in multiple functions but TypeScript doesn't detect it
let currentRetryAttempt: number = 0;
let retryTimeoutId: NodeJS.Timeout | null = null;

/**
 * Checks network connectivity by attempting to fetch a small resource
 * @returns Promise<boolean> indicating if network is available
 */
async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    // Use a small, fast endpoint to check connectivity
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.warn('Network connectivity check failed:', error);
    return false;
  }
}

/**
 * Calculates delay for exponential backoff
 * @param attempt Current retry attempt (0-based)
 * @param config Retry configuration
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Creates a speech recognition instance with browser compatibility
 * @returns A speech recognition instance or null if not supported
 */
export function createSpeechRecognition(): SpeechRecognitionInstance | null {
  // Check if the browser supports speech recognition
  const SpeechRecognition = 
    window.SpeechRecognition || 
    (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('Speech recognition is not supported in this browser');
    return null;
  }
  
  return new SpeechRecognition() as SpeechRecognitionInstance;
}

/**
 * Internal function to attempt speech recognition with retry logic
 */
async function attemptSpeechRecognition(
  onResult: (transcript: string) => void,
  onError: (error: string, message: string) => void,
  onEnd: () => void,
  onRetry: (attempt: number, maxRetries: number) => void,
  options: {
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
    retryConfig?: Partial<RetryConfig>;
  } = {},
  attempt: number = 0
): Promise<SpeechRecognitionInstance | null> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  
  console.log(`Speech recognition attempt ${attempt + 1}/${config.maxRetries + 1}`);
  
  // Check network connectivity before attempting
  if (attempt === 0) {
    const isConnected = await checkNetworkConnectivity();
    if (!isConnected) {
      onError('network', 'No internet connection detected. Please check your network and try again.');
      return null;
    }
  }
  
  // Stop any existing recognition instance
  if (globalRecognitionInstance) {
    try {
      globalRecognitionInstance.abort();
    } catch (error) {
      console.error('Error stopping previous speech recognition:', error);
    }
  }
  
  // Clear any existing retry timeout
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
  
  // Create a new instance
  const recognition = createSpeechRecognition();
  
  if (!recognition) {
    onError('not-supported', 'Speech recognition is not supported in your browser. Please try using Chrome, Edge, or Safari.');
    return null;
  }
  
  // Configure the recognition instance
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? false;
  recognition.lang = options.lang ?? 'en-US';
  
  // Set up timeout for the recognition attempt
  let recognitionTimeout: NodeJS.Timeout | null = null;
  const timeoutDuration = 30000; // 30 seconds
  
  // Set up event handlers
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    try {
      if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = null;
      }
      
      const transcript = event.results[0][0].transcript;
      console.log('Speech recognition successful:', transcript);
      currentRetryAttempt = 0; // Reset retry counter on success
      onResult(transcript);
    } catch (error) {
      console.error('Error processing speech result:', error);
      onError('processing-error', 'Failed to process your speech. Please try again.');
    }
  };
  
  recognition.onerror = async (event: SpeechRecognitionErrorEvent) => {
    console.error(`Speech recognition error (attempt ${attempt + 1}):`, event.error);
    
    if (recognitionTimeout) {
      clearTimeout(recognitionTimeout);
      recognitionTimeout = null;
    }
    
    // Check if this error is retryable and we haven't exceeded max retries
    if (config.retryableErrors.includes(event.error) && attempt < config.maxRetries) {
      const delay = calculateBackoffDelay(attempt, config);
      console.log(`Retrying speech recognition in ${delay}ms...`);
      
      onRetry(attempt + 1, config.maxRetries);
      
      retryTimeoutId = setTimeout(async () => {
        await attemptSpeechRecognition(onResult, onError, onEnd, onRetry, options, attempt + 1);
      }, delay);
      
      return;
    }
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Speech recognition failed. Please try again.';
    
    if (event.error === 'not-allowed') {
      errorMessage = 'Microphone access was denied. Please allow microphone access and try again.';
    } else if (event.error === 'network') {
      if (attempt >= config.maxRetries) {
        errorMessage = `Network error persisted after ${config.maxRetries + 1} attempts. Please check your internet connection and try again later.`;
      } else {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
      }
    } else if (event.error === 'no-speech') {
      errorMessage = 'No speech was detected. Please try speaking again.';
    } else if (event.error === 'aborted') {
      errorMessage = 'Speech recognition was aborted.';
    } else if (event.error === 'service-not-allowed') {
      errorMessage = 'Speech recognition service is not available. Please try again later.';
    }
    
    currentRetryAttempt = 0; // Reset retry counter
    onError(event.error, errorMessage);
  };
  
  recognition.onend = () => {
    console.log('Speech recognition ended');
    if (recognitionTimeout) {
      clearTimeout(recognitionTimeout);
      recognitionTimeout = null;
    }
    onEnd();
  };
  
  recognition.onstart = () => {
    console.log('Speech recognition started successfully');
    // Set timeout for recognition attempt
    recognitionTimeout = setTimeout(() => {
      console.warn('Speech recognition timeout');
      if (globalRecognitionInstance) {
        globalRecognitionInstance.abort();
      }
    }, timeoutDuration);
  };
  
  // Store the instance globally
  globalRecognitionInstance = recognition;
  currentRetryAttempt = attempt;
  
  // Start recognition
  try {
    recognition.start();
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    if (recognitionTimeout) {
      clearTimeout(recognitionTimeout);
      recognitionTimeout = null;
    }
    onError('start-error', 'Failed to start speech recognition. Please try again.');
    return null;
  }
  
  return recognition;
}

/**
 * Starts speech recognition with retry logic and robust error handling
 * Ensures only one instance is active at a time across the application
 * 
 * @param onResult Callback for when speech is recognized
 * @param onError Callback for when an error occurs
 * @param onEnd Callback for when recognition ends
 * @param onRetry Optional callback for when a retry is attempted
 * @param options Configuration options including retry settings
 * @returns Promise<SpeechRecognitionInstance | null>
 */
export async function startSpeechRecognition(
  onResult: (transcript: string) => void,
  onError: (error: string, message: string) => void,
  onEnd: () => void,
  onRetry?: (attempt: number, maxRetries: number) => void,
  options: {
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
    retryConfig?: Partial<RetryConfig>;
  } = {}
): Promise<SpeechRecognitionInstance | null> {
  const defaultOnRetry = (attempt: number, maxRetries: number) => {
    console.log(`Retrying speech recognition: attempt ${attempt}/${maxRetries}`);
  };
  
  return attemptSpeechRecognition(
    onResult,
    onError,
    onEnd,
    onRetry || defaultOnRetry,
    options,
    0
  );
}

/**
 * Stops the current speech recognition instance and clears any pending retries
 */
export function stopSpeechRecognition(): void {
  // Clear any pending retry timeout
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
  
  // Stop the current recognition instance
  if (globalRecognitionInstance) {
    try {
      globalRecognitionInstance.stop();
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
    globalRecognitionInstance = null;
  }
  
  // Reset retry counter
  currentRetryAttempt = 0;
  
  console.log('Speech recognition stopped and retry state cleared');
}

/**
 * Checks if speech recognition is supported in the current browser
 * @returns True if speech recognition is supported, false otherwise
 */
export function isSpeechRecognitionSupported(): boolean {
  return !!(
    window.SpeechRecognition || 
    (window as any).webkitSpeechRecognition
  );
}

/**
 * Gets a user-friendly error message for speech recognition errors
 * @param error The error code from the speech recognition API
 * @returns A user-friendly error message
 */
export function getSpeechRecognitionErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
      return 'Microphone access was denied. Please allow microphone access and try again.';
    case 'network':
      return 'Network error occurred. Please check your connection and try again.';
    case 'no-speech':
      return 'No speech was detected. Please try speaking again.';
    case 'aborted':
      return 'Speech recognition was aborted.';
    case 'not-supported':
      return 'Speech recognition is not supported in your browser. Please try using Chrome, Edge, or Safari.';
    default:
      return 'Speech recognition failed. Please try again.';
  }
}

// ============================================================================
// HYBRID SPEECH RECOGNITION (Whisper API + Web Speech API Fallback)
// ============================================================================

export interface HybridSpeechOptions {
  maxDuration?: number // in milliseconds
  useWebSpeechFallback?: boolean
  whisperModel?: string
  language?: string
}

export interface HybridSpeechCallbacks {
  onStart?: () => void
  onStop?: () => void
  onResult?: (transcript: string, confidence?: number) => void
  onError?: (error: string, message: string) => void
  onStatusUpdate?: (status: string) => void
}

// Global audio recorder instance
let globalAudioRecorder: AudioRecorder | null = null

/**
 * Upload audio blob to Whisper API for transcription
 */
async function transcribeWithWhisper(
  audioBlob: Blob,
  options: HybridSpeechOptions = {}
): Promise<string> {
  // Check minimum audio duration (avoid sending very short recordings)
  if (audioBlob.size < 1000) { // Very rough estimate: less than 1KB likely too short
    console.warn('[transcribeWithWhisper] Audio blob too small, likely too short:', audioBlob.size, 'bytes')
    throw new Error('Audio recording too short')
  }

  const formData = new FormData()
  
  // Create filename based on blob type
  const filename = createAudioFilename(audioBlob.type)
  formData.append('audio', audioBlob, filename)
  
  if (options.whisperModel) {
    formData.append('model', options.whisperModel)
  }
  
  if (options.language) {
    formData.append('language', options.language)
  }

  console.log(`[transcribeWithWhisper] Sending audio to Whisper API: ${filename} (${audioBlob.size} bytes, ${audioBlob.type})`)

  const response = await fetch('/api/speech-to-text', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
    console.error('[transcribeWithWhisper] API error:', errorMessage)
    console.error('[transcribeWithWhisper] Full error response:', errorData)
    
    // Provide more specific error messages for common issues
    if (response.status === 400) {
      throw new Error(`Audio format error: ${errorMessage}`)
    } else if (response.status === 500) {
      throw new Error(`Server error during transcription: ${errorMessage}`)
    } else {
      throw new Error(`Failed to transcribe audio: ${errorMessage}`)
    }
  }

  const data = await response.json()
  console.log('[transcribeWithWhisper] API response:', data)
  
  // Fix: Use data.text instead of data.transcript
  const transcript = data.text || data.transcript || ''
  console.log('[transcribeWithWhisper] Extracted transcript:', transcript)
  
  return transcript
}

/**
 * Start hybrid speech recognition using Whisper API as primary method
 */
export async function startHybridSpeechRecognition(
  callbacks: HybridSpeechCallbacks = {},
  options: HybridSpeechOptions = {}
): Promise<boolean> {
  const {
    onStart,
    onStop,
    onResult,
    onError,
    onStatusUpdate
  } = callbacks

  const {
    maxDuration = 60000, // 60 seconds default
    useWebSpeechFallback = true,
    whisperModel = 'whisper-1',
    language = 'en'
  } = options

  // Stop any existing recording
  if (globalAudioRecorder) {
    globalAudioRecorder.cleanup()
    globalAudioRecorder = null
  }

  // Check if MediaRecorder is supported
  if (!AudioRecorder.isSupported()) {
    onStatusUpdate?.('MediaRecorder not supported, trying Web Speech API...')
    
    if (useWebSpeechFallback && isSpeechRecognitionSupported()) {
      // Fallback to Web Speech API
      return startWebSpeechFallback(callbacks, options)
    } else {
      onError?.('not-supported', 'Speech recognition is not supported in your browser.')
      return false
    }
  }

  try {
    onStatusUpdate?.('Initializing audio recorder...')

    // Create audio recorder with callbacks
    const recorderCallbacks: AudioRecorderCallbacks = {
      onStart: () => {
        onStatusUpdate?.('Recording started...')
        onStart?.()
      },
      
      onStop: async (audioBlob: Blob) => {
        onStatusUpdate?.('Processing audio...')
        
        try {
          // Transcribe with Whisper API
          const transcript = await transcribeWithWhisper(audioBlob, {
            whisperModel,
            language
          })
          
          if (transcript.trim()) {
            onResult?.(transcript.trim(), 1.0) // Whisper doesn't provide confidence scores
            onStatusUpdate?.('Transcription completed')
            onStop?.()
          } else {
            // Whisper returned empty result - try Web Speech API fallback
            console.log('[HybridSpeech] Whisper returned empty transcript, trying Web Speech API fallback...')
            if (useWebSpeechFallback && isSpeechRecognitionSupported()) {
              onStatusUpdate?.('No speech detected by Whisper, trying Web Speech API...')
              setTimeout(() => {
                startWebSpeechFallback(callbacks, options)
              }, 100)
            } else {
              onError?.('no-speech', 'No speech was detected in the recording.')
              onStop?.()
            }
          }
        } catch (error) {
          console.error('[HybridSpeech] Whisper transcription failed:', error)
          
          // Try Web Speech API fallback if enabled
          if (useWebSpeechFallback && isSpeechRecognitionSupported()) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            
            // Check if it's a "too short" error - in that case, don't fallback
            if (errorMessage.includes('too short')) {
              onError?.('recording-too-short', 'Audio recording was too short. Please speak for longer.')
              onStop?.()
            } else {
              onStatusUpdate?.('Whisper failed, trying Web Speech API...')
              setTimeout(() => {
                startWebSpeechFallback(callbacks, options)
              }, 100)
            }
          } else {
            onError?.('transcription-failed', `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            onStop?.()
          }
        }
      },
      
      onError: (error: Error) => {
        console.error('[HybridSpeech] Recording error:', error)
        
        // Try Web Speech API fallback if enabled
        if (useWebSpeechFallback && isSpeechRecognitionSupported()) {
          onStatusUpdate?.('Recording failed, trying Web Speech API...')
          setTimeout(() => {
            startWebSpeechFallback(callbacks, options)
          }, 100)
        } else {
          onError?.('recording-failed', `Recording failed: ${error.message}`)
        }
      },
      
      onMaxDurationReached: () => {
        onStatusUpdate?.('Maximum recording duration reached')
      }
    }

    const recorderConfig: AudioRecorderConfig = {
      maxDuration,
      maxFileSize: 25 * 1024 * 1024 // 25MB limit for Whisper API
    }

    globalAudioRecorder = new AudioRecorder(recorderConfig, recorderCallbacks)

    // Start recording
    const started = await globalAudioRecorder.startRecording()
    
    if (!started) {
      // Try Web Speech API fallback if enabled
      if (useWebSpeechFallback && isSpeechRecognitionSupported()) {
        onStatusUpdate?.('Recording permission denied, trying Web Speech API...')
        return startWebSpeechFallback(callbacks, options)
      } else {
        onError?.('permission-denied', 'Microphone permission was denied.')
        return false
      }
    }

    return true

  } catch (error) {
    console.error('[HybridSpeech] Failed to start recording:', error)
    
    // Try Web Speech API fallback if enabled
    if (useWebSpeechFallback && isSpeechRecognitionSupported()) {
      onStatusUpdate?.('Setup failed, trying Web Speech API...')
      return startWebSpeechFallback(callbacks, options)
    } else {
      onError?.('setup-failed', `Failed to initialize speech recognition: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }
}

/**
 * Stop hybrid speech recognition
 */
export function stopHybridSpeechRecognition(): void {
  // Stop audio recorder
  if (globalAudioRecorder) {
    globalAudioRecorder.stopRecording()
  }
  
  // Also stop any Web Speech API instance
  stopSpeechRecognition()
}

/**
 * Cleanup hybrid speech recognition resources
 */
export function cleanupHybridSpeechRecognition(): void {
  if (globalAudioRecorder) {
    globalAudioRecorder.cleanup()
    globalAudioRecorder = null
  }
  
  stopSpeechRecognition()
}

/**
 * Fallback to Web Speech API when Whisper is not available
 */
async function startWebSpeechFallback(
  callbacks: HybridSpeechCallbacks,
  options: HybridSpeechOptions
): Promise<boolean> {
  const { onStart, onStop, onResult, onError, onStatusUpdate } = callbacks

  onStatusUpdate?.('Using Web Speech API...')

  return new Promise((resolve) => {
    startSpeechRecognition(
      (transcript: string) => {
        onResult?.(transcript, 0.8) // Lower confidence for Web Speech API
      },
      (error: string, message: string) => {
        onError?.(error, message)
        resolve(false)
      },
      () => {
        onStop?.()
      },
      undefined, // no retry callback needed
      {
        continuous: false,
        interimResults: false,
        lang: options.language === 'en' ? 'en-US' : options.language || 'en-US'
      }
    ).then((instance) => {
      if (instance) {
        onStart?.()
        resolve(true)
      } else {
        resolve(false)
      }
    }).catch(() => {
      resolve(false)
    })
  })
}

/**
 * Check if hybrid speech recognition is supported
 */
export function isHybridSpeechRecognitionSupported(): boolean {
  return AudioRecorder.isSupported() || isSpeechRecognitionSupported()
}

/**
 * Get the current state of hybrid speech recognition
 */
export function getHybridSpeechRecognitionState(): {
  isRecording: boolean
  isSupported: boolean
  hasMediaRecorder: boolean
  hasWebSpeech: boolean
} {
  return {
    isRecording: globalAudioRecorder?.getState().isRecording || false,
    isSupported: isHybridSpeechRecognitionSupported(),
    hasMediaRecorder: AudioRecorder.isSupported(),
    hasWebSpeech: isSpeechRecognitionSupported()
  }
}
