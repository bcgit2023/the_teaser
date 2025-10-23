/**
 * Speech recognition utility functions for consistent speech-to-text usage across the application
 * Includes browser compatibility handling and centralized microphone access management
 */

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

// Global instance to ensure only one speech recognition instance is active at a time
let globalRecognitionInstance: SpeechRecognitionInstance | null = null;

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
 * Starts speech recognition with the provided callbacks
 * Ensures only one instance is active at a time across the application
 * 
 * @param onResult Callback for when speech is recognized
 * @param onError Callback for when an error occurs
 * @param onEnd Callback for when recognition ends
 * @param options Configuration options
 * @returns The speech recognition instance or null if not supported
 */
export function startSpeechRecognition(
  onResult: (transcript: string) => void,
  onError: (error: string, message: string) => void,
  onEnd: () => void,
  options: {
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
  } = {}
): SpeechRecognitionInstance | null {
  // Stop any existing recognition instance
  if (globalRecognitionInstance) {
    try {
      globalRecognitionInstance.abort();
    } catch (error) {
      console.error('Error stopping previous speech recognition:', error);
    }
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
  
  // Set up event handlers
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    try {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    } catch (error) {
      console.error('Error processing speech result:', error);
      onError('processing-error', 'Failed to process your speech. Please try again.');
    }
  };
  
  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('Speech recognition error:', event.error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Speech recognition failed. Please try again.';
    
    if (event.error === 'not-allowed') {
      errorMessage = 'Microphone access was denied. Please allow microphone access and try again.';
    } else if (event.error === 'network') {
      errorMessage = 'Network error occurred. Please check your connection and try again.';
    } else if (event.error === 'no-speech') {
      errorMessage = 'No speech was detected. Please try speaking again.';
    } else if (event.error === 'aborted') {
      errorMessage = 'Speech recognition was aborted.';
    }
    
    onError(event.error, errorMessage);
  };
  
  recognition.onend = onEnd;
  
  // Store the instance globally
  globalRecognitionInstance = recognition;
  
  // Start recognition
  try {
    recognition.start();
  } catch (error) {
    console.error('Error starting speech recognition:', error);
    onError('start-error', 'Failed to start speech recognition. Please try again.');
    return null;
  }
  
  return recognition;
}

/**
 * Stops the current speech recognition instance
 */
export function stopSpeechRecognition(): void {
  if (globalRecognitionInstance) {
    try {
      globalRecognitionInstance.stop();
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
    globalRecognitionInstance = null;
  }
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
