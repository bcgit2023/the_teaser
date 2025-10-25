'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Mic, BookOpen } from 'lucide-react'
import VoiceVisualizer from '@/components/VoiceVisualizer'
import AudioErrorBoundary from '@/components/AudioErrorBoundary'
import { 
  stopSpeechRecognition, 
  isSpeechRecognitionSupported,
  startHybridSpeechRecognition,
  stopHybridSpeechRecognition,
  cleanupHybridSpeechRecognition,
  isHybridSpeechRecognitionSupported
} from '@/lib/speech-utils'
import { speakText } from '@/lib/tts-utils'

// Define types for context-aware functionality
interface QuestionContext {
  id?: number
  question_text?: string
  text?: string // For compatibility with different naming conventions
  options?: string[]
  correct_answer?: string
}

interface HighlightState {
  text: string;
  progress: number; // 0 to 1 representing percentage of text read
  isReading: boolean;
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  id?: string
  highlightedHint?: string // Optional highlighted hint for special formatting
}

// Props interface with optional contextual information
interface ChatContentProps {
  questionContext?: QuestionContext
  enableContextAwareness?: boolean
  isFirstQuestion?: boolean
}

export default function ChatContent({ questionContext, enableContextAwareness = false, isFirstQuestion = true }: ChatContentProps) {

  const [messages, setMessages] = useState<Message[]>(
    isFirstQuestion ? [
      {
        role: 'assistant',
        content: "Welcome to your English quiz! I will guide you through each question step-by-step. If you have any questions, feel free to ask me anytime. Let's get started!",
        timestamp: '',
        id: 'initial'
      }
    ] : []
  )
  const [isListening, setIsListening] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [speechRetryAttempt, setSpeechRetryAttempt] = useState(0)
  const [speechRetryMax, setSpeechRetryMax] = useState(0)
  const [speechStatus, setSpeechStatus] = useState<string>('')
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [showQuestionReader, setShowQuestionReader] = useState(false)
  const [highlightState, setHighlightState] = useState<HighlightState>({ text: '', progress: 0, isReading: false })
  // State to track the current word being read
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1)
  // Audio interaction states
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  // State to track if audio has finished playing for the current question
  const [hasAudioFinished, setHasAudioFinished] = useState(false)
  // Use a ref to track the current word index to avoid closure issues
  const currentWordIndexRef = useRef<number>(-1)
  // Store the question text in a ref to ensure we have access to the latest value
  const questionTextRef = useRef<string>('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { hour12: false })
  }

  // Initial mounting effect - only play welcome audio on first question
  useEffect(() => {
    setIsMounted(true)
    
    // Only play welcome message if this is the first question
    if (isFirstQuestion) {
      // Try to play welcome audio automatically
      const attemptWelcomeAudio = async () => {
        try {
          await playWelcomeAudio()
        } catch (error) {
          console.log('Auto-play blocked, showing permission prompt:', error)
          // Show permission prompt toast
          toast({
            title: "Audio Permission Required",
            description: "Please enable audio permissions in your browser and refresh the page to hear the welcome message and AI responses automatically.",
            variant: "default",
            duration: 8000, // Show for 8 seconds
          })
        }
      }
      
      // Delay the attempt slightly to ensure component is fully mounted
      setTimeout(attemptWelcomeAudio, 500)
    }
    

    
    // Cleanup function to ensure audio is properly stopped when component unmounts
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.onplay = null;
        audioElement.onended = null;
        audioElement.onerror = null;
        audioElement.ontimeupdate = null;
      }
      // Cleanup hybrid speech recognition
      cleanupHybridSpeechRecognition();
    };
  }, [])

  // Reset audio finished state when question context changes
  useEffect(() => {
    setHasAudioFinished(false)
  }, [questionContext?.id, questionContext?.text, questionContext?.question_text])

  // Function to play welcome audio
  const playWelcomeAudio = async () => {
    try {
      // Stop any currently playing audio first
      if (audioElement) {
        audioElement.pause();
        audioElement.onended = null;
        audioElement.onplay = null;
        audioElement.onerror = null;
        audioElement.ontimeupdate = null;
      }
      
      // Create a new audio element for welcome message
      const audio = new Audio('/voice/welcome_quiz.mp3');
      
      // Set up event handlers
      audio.onplay = () => {
        setIsAiSpeaking(true);
      };
      
      audio.onended = () => {
        setIsAiSpeaking(false);
        setHasAudioFinished(true);
        // Clean up audio resources
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
      };
      
      audio.onerror = (e) => {
        console.error('Welcome audio error:', e);
        setIsAiSpeaking(false);
        // Clean up audio resources
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
      };
      
      // Store the audio element for the visualizer
      try {
        setAudioElement(audio);
        if (audioRef.current) {
          audioRef.current = audio;
        }
      } catch (error) {
        console.warn('Error setting audio element:', error);
      }
      
      // Play the audio
      try {
        await audio.play();
        // Mark that user interaction has occurred if audio plays successfully
        setHasUserInteracted(true);
      } catch (playError) {
        console.log('Welcome audio play failed, likely due to auto-play restrictions:', playError);
        setIsAiSpeaking(false);
        // Clean up audio element on play failure
        try {
          audio.remove();
          URL.revokeObjectURL(audio.src);
        } catch (cleanupError) {
          console.warn('Error cleaning up audio element:', cleanupError);
        }
        throw playError;
      }
      
    } catch (error) {
      console.log('Audio playback failed, likely due to auto-play restrictions:', error);
      setIsAiSpeaking(false);
      throw error; // Re-throw to be caught by the caller
    }
  }



  // Set initial message timestamp once mounted (only for first question)
  useEffect(() => {
    if (!isMounted || !isFirstQuestion || messages.length === 0) return
    console.log('Setting initial message timestamp')
    // Make sure we're not replacing the entire messages array, just updating the first message
    setMessages(prev => {
      console.log('Previous messages before timestamp update:', prev)
      const updatedMessages = [
        {
          ...prev[0],
          timestamp: getCurrentTime()
        },
        ...prev.slice(1) // Keep all other messages
      ];
      console.log('Updated messages after timestamp update:', updatedMessages)
      return updatedMessages;
    })
  }, [isMounted, isFirstQuestion, messages.length])

  // Enhanced scroll to bottom function with more reliable behavior
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }
  
  // Force scroll with multiple attempts to ensure it works reliably
  const forceScrollToBottom = () => {
    // Immediate scroll
    scrollToBottom();
    
    // Multiple delayed attempts with increasing timeouts
    // This helps ensure scrolling works even with dynamic content loading
    const timeouts = [10, 50, 100, 200, 500, 1000];
    timeouts.forEach(delay => {
      setTimeout(scrollToBottom, delay);
    });
  }

  // Combined scroll effect that handles all scroll trigger cases
  useEffect(() => {
    // Log for debugging
    console.log('Messages changed, current count:', messages.length)
    console.log('Current messages:', messages)
    
    // Scroll immediately
    scrollToBottom();
    
    // Then force scroll with multiple attempts
    forceScrollToBottom();
    
    // Also set up a mutation observer to detect content changes
    if (messagesContainerRef.current) {
      const observer = new MutationObserver(() => {
        scrollToBottom();
      });
      
      observer.observe(messagesContainerRef.current, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      return () => observer.disconnect();
    }
    
    // Return empty cleanup function when messagesContainerRef.current is null
    return () => {};
  }, [messages, isAiSpeaking, isLoading])
  
  // Keep the ref in sync with the state
  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
    console.log('Current word index updated:', currentWordIndex);
  }, [currentWordIndex])

  // Initialize speech recognition support check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if speech recognition is supported
      if (!isSpeechRecognitionSupported()) {
        console.warn('Speech recognition not supported in this browser')
        toast({
          variant: "destructive",
          title: "Browser Compatibility",
          description: "Speech recognition is not supported in your browser. Please try using Chrome, Edge, or Safari."
        })
      }
    }

    return () => {
      // Cleanup any active speech recognition
      stopSpeechRecognition()
    }
  }, [])
  
  // Function to handle user input and get AI response
  const handleUserInput = async (userMessage: Message) => {
    setIsLoading(true)
    try {
      // Log for debugging
      console.log('Processing user message:', userMessage)
      console.log('Current messages state before AI response:', messages)
      
      // Scroll to bottom after adding user message
      forceScrollToBottom()
      
      // Get AI response from the API
      // Use the current messages state plus the new user message
      const currentMessages = [...messages, userMessage]
      const aiResponse = await getAIResponse(currentMessages)
      
      // Create AI response message
      const responseMessage: Message = {
        role: 'assistant',
        content: typeof aiResponse === 'string' ? aiResponse : aiResponse.content,
        timestamp: getCurrentTime(),
        id: `ai-${Date.now()}`,
        highlightedHint: typeof aiResponse === 'object' ? aiResponse.highlightedHint : undefined
      }
      
      // Log for debugging
      console.log('AI response message:', responseMessage)
      
      // Update messages state with the AI response
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages, responseMessage];
        console.log('Updated messages state after AI response:', updatedMessages);
        return updatedMessages;
      })
      
      // Scroll to bottom after adding AI response
      forceScrollToBottom()
      
      // Generate speech from AI response - don't process initial message
      if (responseMessage.id !== 'initial') {
        await generateSpeech(responseMessage.content)
      }
    } catch (error) {
      console.error('Error getting AI response:', error)
      toast({
        description: 'Failed to get AI response. Please try again.',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
      // Ensure we scroll to bottom after loading completes
      forceScrollToBottom()
    }
  }

  // Preset question button handlers
  const handleAskAboutQuestion = () => {
    if (!questionContext) return;
    
    const questionText = questionContext.text || questionContext.question_text;
    if (!questionText) return;

    const message: Message = {
      role: 'user',
      content: `Please explain the question to me`,
      timestamp: getCurrentTime(),
      id: `ask-about-${questionContext.id}-${Date.now()}`
    };

    setMessages(prevMessages => [...prevMessages, message]);
    handleUserInput(message);
  };

  const handleAskHowToSolve = () => {
    if (!questionContext) return;
    
    const questionText = questionContext.text || questionContext.question_text;
    if (!questionText) return;

    const message: Message = {
      role: 'user',
      content: `How do I solve this question: "${questionText}"?`,
      timestamp: getCurrentTime(),
      id: `ask-solve-${questionContext.id}-${Date.now()}`
    };

    setMessages(prevMessages => [...prevMessages, message]);
    handleUserInput(message);
  };

  
  // Function to get AI response from the API with streaming support
  const getAIResponse = async (messageHistory: Message[]) => {
    try {
      console.log('Current messages:', messageHistory)
      
      const requestBody: any = {
        mode: 'reactive',
        messages: messageHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }

      // Add question context if available and context awareness is enabled
      if (enableContextAwareness && questionContext) {
        const questionText = questionContext.text || questionContext.question_text
        const questionOptions = questionContext.options
        
        if (questionText && questionOptions && questionOptions.length > 0) {
          console.log('Adding question context:', JSON.stringify({
            text: questionText,
            options: questionOptions
          }, null, 2))
          requestBody.currentQuestion = {
            text: questionText,
            options: questionOptions
          }
        } else {
          console.warn('Invalid question context - missing text or options')
        }
      } else {
        console.log('Context awareness disabled or no question context provided:', { 
          enableContextAwareness, 
          hasQuestionContext: !!questionContext 
        })
      }

      console.log('Sending request to AI tutor API:', requestBody)
      
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('AI Tutor API Response Status:', response.status)
      console.log('AI Tutor API Response Headers:', Object.fromEntries(response.headers))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API response not OK:', response.status, response.statusText)
        console.error('Error response body:', errorText)
        throw new Error(`Failed to get AI response: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      // Handle streaming response
      if (response.body) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let content = ''
        
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value, { stream: true })
            content += chunk
            console.log('Streaming chunk:', chunk)
          }
        } finally {
          reader.releaseLock()
        }
        
        console.log('Final streaming content:', content)
        
        // Process the complete response to extract any highlighted hints
        const highlightRegex = /\[HIGHLIGHT\](.*?)\[\/HIGHLIGHT\]/
        const highlightMatch = content.match(highlightRegex)
        
        // Return both the content and any highlighted hint
        return {
          content: content.replace(highlightRegex, '$1'),
          highlightedHint: highlightMatch ? highlightMatch[1] : undefined
        }
      } else {
        throw new Error('No response body received')
      }
    } catch (error) {
      console.error('Error getting AI response:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      
      // Return more specific error information
      if (error instanceof Error) {
        return `I apologize, but I encountered an error: ${error.message}. Please try again.`
      } else {
        return 'I apologize, but I encountered an unknown error. Please try again.'
      }
    }
  }
  
  // Function to generate speech from text
  const generateSpeech = async (text: string, isQuestionReading: boolean = false) => {
    try {
      // Stop any currently playing audio and clean up event listeners
      if (audioElement) {
        // First remove all event listeners to prevent duplicate events
        audioElement.onplay = null;
        audioElement.onended = null;
        audioElement.onerror = null;
        audioElement.ontimeupdate = null;
        
        // Then pause the audio
        audioElement.pause();
        
        // Reset the audio element
        audioElement.currentTime = 0;
      }
      
      console.log('Generating speech for text:', text.substring(0, 100) + '...')
      
      // Use the new TTS routing system
      await speakText(
        text,
        'nova', // voice
        () => {
          console.log('Audio playback started');
          setIsAiSpeaking(true);
          if (isQuestionReading) {
            setHighlightState(prev => ({ ...prev, isReading: true, progress: 0 }));
            // Reset word index when starting
            setCurrentWordIndex(-1);
            currentWordIndexRef.current = -1;
          }
        },
        () => {
          console.log('Audio playback ended');
          setIsAiSpeaking(false);
          setHasAudioFinished(true);
          if (isQuestionReading) {
            setHighlightState(prev => ({ ...prev, isReading: false }));
            // Reset word index when done
            setCurrentWordIndex(-1);
          }
        },
        (error) => {
          console.error('Audio playback error:', error);
          setIsAiSpeaking(false);
          if (isQuestionReading) {
            setHighlightState(prev => ({ ...prev, isReading: false }));
            // Reset word index on error
            setCurrentWordIndex(-1);
          }
          toast({
            description: 'Audio playback failed. Please try again.',
            variant: "destructive"
          });
        }
      );
      
      // Update the question text ref with the current question
      questionTextRef.current = questionContext?.text || questionContext?.question_text || '';
      
      // Note: Browser TTS doesn't provide audio element for time tracking
      // Word highlighting during question reading is handled by the browser TTS callbacks
      
      // Mark that user interaction has occurred
      setHasUserInteracted(true);
      
    } catch (error) {
      console.error('Error generating speech:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setIsAiSpeaking(false);
      if (isQuestionReading) {
        setHighlightState(prev => ({ ...prev, isReading: false }));
      }
      
      // Provide more specific error messages
      let errorMessage = 'An error occurred generating speech. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Failed to generate audio')) {
          errorMessage = `Speech generation failed: ${error.message}`;
        } else if (error.message.includes('auto-play')) {
          errorMessage = 'Audio auto-play is blocked. Please click to enable audio.';
        } else {
          errorMessage = `Speech error: ${error.message}`;
        }
      }
      
      toast({
        description: errorMessage,
        variant: "destructive"
      });
    }
  }

  const isPlaying = isListening || isAiSpeaking

  // Calculate the height for the fixed control bar and message container
  const controlBarHeight = 140; // in pixels
  const headerHeight = 40; // in pixels
  
  // Function to read the question aloud with highlighting
  const readQuestion = async () => {
    if (isAiSpeaking || !questionContext) return;
    
    const questionText = questionContext.text || questionContext.question_text || '';
    if (!questionText) {
      toast({
        description: 'No question available to read.',
        variant: "destructive"
      });
      return;
    }
    
    console.log('Reading question:', questionText);
    
    // Update our question text ref
    questionTextRef.current = questionText;
    
    // Reset the current word index
    setCurrentWordIndex(-1);
    currentWordIndexRef.current = -1;
    
    // Update highlight state with the question text
    setHighlightState({
      text: questionText,
      progress: 0,
      isReading: false
    });
    
    // Show the question reader
    setShowQuestionReader(true);
    
    // Larger delay to ensure DOM is fully updated before playing audio
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Process the text for speech - replace underscores with "blank"
    const speechText = questionText.replace(/_{3,}/g, ' blank ');
    
    // Generate speech for the question
    await generateSpeech(speechText, true);
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Hidden audio element for AI speech playback */}
      {/* Hidden audio element for AI speech playback - not used directly */}
      <audio ref={audioRef} hidden />
      
      {/* Main container with relative positioning to contain the fixed elements */}
      <div className="relative h-full w-full">
        {/* Chat container with borders */}
        <div className="flex flex-col h-full w-full border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
          {/* Header - fixed height */}
          <div className="p-2 border-b bg-white flex items-center justify-between z-10" 
               style={{ height: `${headerHeight}px` }}>
            <h2 className="font-semibold text-base">English Quiz Assistant</h2>
            
            {/* Question Reader Button */}
            {questionContext && (questionContext.text || questionContext.question_text) && (
              <Button 
                size="sm" 
                className="flex items-center gap-1 text-xs bg-[#0066CC] hover:bg-[#0077EE] text-white" 
                onClick={readQuestion}
                disabled={isAiSpeaking && highlightState.isReading}
              >
                <BookOpen className="w-3 h-3" />
                Read the question
              </Button>
            )}
          </div>
          
          {/* Question Reader Modal */}
          {showQuestionReader && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col p-4 overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Question</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowQuestionReader(false)}
                >
                  Close
                </Button>
              </div>
              
              <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 rounded-lg">
                <p className="text-3xl font-medium leading-relaxed max-w-3xl">
                  {(() => {
                    // Split the text into words for highlighting
                    const words = highlightState.text.match(/\S+/g) || [];
                    const spaces = highlightState.text.split(/\S+/).filter(Boolean);
                    
                    console.log('Rendering words:', words.length, 'Current word index:', currentWordIndex);
                    
                    // Combine words and spaces back together for rendering
                    return words.map((word, wordIndex) => {
                      const space = wordIndex < spaces.length ? spaces[wordIndex] : '';
                      const isHighlighted = wordIndex === currentWordIndex;
                      
                      return (
                        <span key={wordIndex}>
                          <span 
                            className={`question-word ${isHighlighted ? 'bg-blue-200 text-blue-900' : 'text-gray-800'} transition-colors duration-100`}
                            data-word-index={wordIndex}
                          >
                            {word}
                          </span>
                          <span>{space}</span>
                        </span>
                      );
                    });
                  })()}
                </p>
              </div>
              
              <div className="mt-4 flex justify-center">
                <Button 
                  onClick={readQuestion}
                  disabled={highlightState.isReading}
                  className="bg-[#0066CC] hover:bg-[#0077EE] text-white w-full max-w-xs"
                >
                  {highlightState.isReading ? 'Reading...' : 'Read Again'}
                </Button>
              </div>
            </div>
          )}
          
          
          {/* Messages container with absolute fixed height */}
          <div 
            ref={messagesContainerRef}
            className="overflow-y-auto p-4 pb-6" 
            id="messages-container"
            style={{ 
              position: 'absolute',
              top: `${headerHeight}px`,
              left: 0,
              right: 0,
              bottom: `${controlBarHeight}px`,
              scrollBehavior: 'smooth'
            }}
          >
            <div className="flex flex-col space-y-4 w-full">
              {messages.map((message) => (
                <div key={message.id || message.timestamp}>
                  <div className={`${
                    message.role === 'user' 
                      ? 'bg-[#0066CC] text-white' 
                      : 'bg-gray-100 text-gray-900'
                    } p-3 rounded-lg max-w-[80%] break-words shadow-sm ${message.role === 'user' ? 'ml-auto' : ''}`}
                  >
                    {message.highlightedHint ? (
                      <div>
                        <div className="mb-2">{message.content.split(message.highlightedHint)[0]}</div>
                        <div className="bg-yellow-200 text-black p-2 rounded-md font-medium my-2">
                          {message.highlightedHint}
                        </div>
                        <div className="mt-2">{message.content.split(message.highlightedHint)[1]}</div>
                      </div>
                    ) : (
                      message.content
                    )}
                    <div className={`text-xs mt-1 ${
                      message.role === 'user' 
                        ? 'text-blue-200' 
                        : 'text-gray-500'
                    }`}>
                      {message.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* This empty div is used as a marker for scrolling to the bottom */}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
        
        {/* Fixed bottom control bar - positioned absolutely at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-3 shadow-lg z-20" 
             style={{ height: `${controlBarHeight}px`, minHeight: `${controlBarHeight}px` }}>
          {/* Preset Question Buttons */}
          {questionContext && enableContextAwareness && (hasAudioFinished || !isAiSpeaking) && (
            <div className="flex gap-2 mb-2">
              <Button
                onClick={handleAskAboutQuestion}
                disabled={isAiSpeaking || isLoading}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                <BookOpen className="w-3 h-3 mr-1" />
                Explain the question to me
              </Button>
              <Button
                onClick={handleAskHowToSolve}
                disabled={isAiSpeaking || isLoading}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                <BookOpen className="w-3 h-3 mr-1" />
                Ask how to solve the question
              </Button>
            </div>
          )}
          
          {/* Voice visualizer */}
          <div className="mb-2">
            <AudioErrorBoundary
              fallback={
                <div className="h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm text-gray-500">Audio visualizer unavailable</span>
                </div>
              }
            >
              <VoiceVisualizer 
                isPlaying={isPlaying} 
                audioElement={isAiSpeaking ? audioElement : null} 
              />
            </AudioErrorBoundary>
          </div>
          <div className="w-full space-y-2">
            
            {/* Main Speech Recognition Button - Hybrid Approach */}
            <Button
              onClick={async () => {
                // Enable audio on first interaction if needed
                if (!hasUserInteracted) {
                  setHasUserInteracted(true);
                }
                
                if (isListening) {
                  // Stop current speech recognition
                  stopHybridSpeechRecognition()
                  setIsListening(false)
                  setSpeechStatus('')
                } else if (!isAiSpeaking && !isLoading) {
                  // Check if hybrid speech recognition is supported
                  if (!isHybridSpeechRecognitionSupported()) {
                    toast({
                      variant: "destructive",
                      title: "Speech Recognition Unavailable",
                      description: "Speech recognition is not supported in your browser or device."
                    })
                    return
                  }

                  // Reset state
                  setSpeechRetryAttempt(0)
                  setSpeechRetryMax(0)
                  setSpeechStatus('Initializing...')

                  // Start hybrid speech recognition
                  try {
                    const started = await startHybridSpeechRecognition(
                      {
                        // onStart callback
                        onStart: () => {
                          setIsListening(true)
                          setSpeechStatus('Listening...')
                          console.log('Hybrid speech recognition started')
                        },
                        
                        // onStop callback
                        onStop: () => {
                          setIsListening(false)
                          setSpeechStatus('')
                          console.log('Hybrid speech recognition stopped')
                        },
                        
                        // onResult callback
                        onResult: async (transcript: string, confidence?: number) => {
                          setIsListening(false)
                          setSpeechStatus('')
                          console.log('Speech recognition result:', transcript, 'confidence:', confidence)
                          
                          // Add user message to chat
                          const newMessage: Message = { 
                            role: 'user', 
                            content: transcript,
                            timestamp: getCurrentTime(),
                            id: `user-${Date.now()}`
                          }
                          
                          console.log('New user message:', newMessage)
                          
                          // Update messages state with the new user message
                          setMessages(prevMessages => {
                            console.log('Previous messages:', prevMessages)
                            const updatedMessages = [...prevMessages, newMessage];
                            console.log('Updated messages with user input:', updatedMessages)
                            return updatedMessages;
                          })
                          
                          // Force scroll after adding user message
                          forceScrollToBottom()
                          
                          // Get AI response
                          await handleUserInput(newMessage)
                        },
                        
                        // onError callback
                        onError: (error: string, message: string) => {
                          console.error('Hybrid speech recognition error:', error, message)
                          setIsListening(false)
                          setSpeechStatus('')
                          
                          toast({
                            variant: "destructive",
                            title: "Speech Recognition Error",
                            description: message,
                            duration: 8000
                          })
                        },
                        
                        // onStatusUpdate callback
                        onStatusUpdate: (status: string) => {
                          setSpeechStatus(status)
                          console.log('Speech status:', status)
                        }
                      },
                      {
                        // Hybrid speech options
                        maxDuration: 60000, // 60 seconds
                        useWebSpeechFallback: true,
                        whisperModel: 'whisper-1',
                        language: 'en'
                      }
                    )

                    if (!started) {
                      setSpeechStatus('')
                      toast({
                        variant: "destructive",
                        title: "Speech Recognition Failed",
                        description: "Unable to start speech recognition. Please try again.",
                        duration: 5000
                      })
                    }
                  } catch (error) {
                    console.error('Failed to start hybrid speech recognition:', error)
                    setIsListening(false)
                    setSpeechStatus('')
                    toast({
                      variant: "destructive",
                      title: "Speech Recognition Failed",
                      description: "Unable to start speech recognition. Please try again.",
                      duration: 5000
                    })
                  }
                }
              }}
              disabled={isAiSpeaking || isLoading || !isHybridSpeechRecognitionSupported()}
              className={`w-full ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-[#0066CC] hover:bg-[#0077EE]'
              } text-white rounded-full ${
                !isHybridSpeechRecognitionSupported() ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isListening ? (
                <>
                  <Mic className="w-4 h-4 mr-2 animate-pulse" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  {isLoading ? 'Processing...' : 
                   isAiSpeaking ? 'AI Speaking...' : 
                   speechStatus ? speechStatus :
                   speechRetryAttempt > 0 ? `Retrying... (${speechRetryAttempt}/${speechRetryMax})` :
                   !isHybridSpeechRecognitionSupported() ? 'Speech Recognition Unavailable' :
                   'Start Speaking'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
