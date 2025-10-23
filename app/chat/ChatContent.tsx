'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Mic, BookOpen } from 'lucide-react'
import VoiceVisualizer from '@/components/VoiceVisualizer'
import AudioErrorBoundary from '@/components/AudioErrorBoundary'

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
  const recognitionRef = useRef<any>(null)
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

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for speech recognition support with fallbacks
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser')
        toast({
          variant: "destructive",
          title: "Browser Compatibility",
          description: "Speech recognition is not supported in your browser. Please try using Chrome, Edge, or Safari."
        })
        return
      }

      try {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        
        // Try different language codes as fallbacks
        const supportedLanguages = ['en-US', 'en-GB', 'en']
        let languageSet = false
        
        for (const lang of supportedLanguages) {
          try {
            recognitionRef.current.lang = lang
            languageSet = true
            console.log(`Speech recognition language set to: ${lang}`)
            break
          } catch (error) {
            console.warn(`Failed to set language ${lang}:`, error)
          }
        }
        
        if (!languageSet) {
          console.warn('Could not set any supported language, using default')
        }

        recognitionRef.current.onresult = async (event: any) => {
          const transcript = event.results[0][0].transcript
          setIsListening(false)
          
          console.log('Speech recognition result:', transcript)
          
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
        }

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
          
          let errorMessage = 'Speech recognition failed. Please try again.'
          
          switch (event.error) {
            case 'language-not-supported':
              errorMessage = 'The selected language is not supported. Trying with default settings.'
              // Try to reinitialize with default language
              setTimeout(() => {
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.lang = 'en'
                    console.log('Fallback to default language')
                  } catch (error) {
                    console.warn('Failed to set fallback language:', error)
                  }
                }
              }, 100)
              break
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please allow microphone access and try again.'
              break
            case 'network':
              errorMessage = 'Network error occurred. Please check your connection and try again.'
              break
            case 'no-speech':
              errorMessage = 'No speech detected. Please try speaking again.'
              break
            case 'aborted':
              errorMessage = 'Speech recognition was stopped.'
              break
            default:
              errorMessage = `Speech recognition error: ${event.error}. Please try again.`
          }
          
          toast({
            description: errorMessage,
            variant: "destructive"
          })
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }
      } catch (error) {
        console.error('Failed to initialize speech recognition:', error)
        toast({
          variant: "destructive",
          title: "Speech Recognition Error",
          description: "Failed to initialize speech recognition. Please refresh the page and try again."
        })
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch (error) {
          console.warn('Error aborting speech recognition:', error)
        } finally {
          recognitionRef.current = null
        }
      }
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

  
  // Function to get AI response from the API
  const getAIResponse = async (messageHistory: Message[]): Promise<string | { content: string; highlightedHint?: string }> => {
    try {
      console.log('Getting AI response for message history:', messageHistory)
      
      // Prepare the request body with backward compatibility
      const requestBody: any = {
        mode: 'reactive',
        messages: messageHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }

      // Only add question context if feature flag is enabled and context exists
      if (enableContextAwareness && questionContext) {
        // Ensure we have the question text and options
        const questionText = questionContext.text || questionContext.question_text || ''
        const questionOptions = questionContext.options || []
        
        // Detailed debug logging
        console.log('======= QUESTION CONTEXT DEBUG =======')
        console.log('enableContextAwareness:', enableContextAwareness)
        console.log('questionContext raw:', JSON.stringify(questionContext, null, 2))
        console.log('questionText:', questionText)
        console.log('questionOptions:', JSON.stringify(questionOptions, null, 2))
        
        // Only proceed if we have valid question data
        if (questionText && questionOptions.length > 0) {
          console.log('Sending question context to AI:', JSON.stringify({
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

      if (!response.ok) {
        console.error('API response not OK:', response.status, response.statusText)
        throw new Error('Failed to get AI response')
      }
      
      const data = await response.json()
      console.log('AI response data:', data)
      
      // Return both the content and any highlighted hint
      return {
        content: data.content || data.response || 'No response content available',
        highlightedHint: data.highlightedHint
      }
    } catch (error) {
      console.error('Error getting AI response:', error)
      return 'I apologize, but I encountered an error. Please try again.'
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
      
      // Create a new audio element each time to avoid state issues
      const audio = new Audio();
      
      // Fetch the audio data
      const audioResponse = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!audioResponse.ok) throw new Error('Failed to generate audio')

      const audioBlob = await audioResponse.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Set up the new audio element
      audio.src = audioUrl;
      
      // Set up event handlers - use function references for easier cleanup
      const handlePlay = () => {
        console.log('Audio playback started');
        setIsAiSpeaking(true);
        if (isQuestionReading) {
          setHighlightState(prev => ({ ...prev, isReading: true, progress: 0 }));
          // Reset word index when starting
          setCurrentWordIndex(-1);
          currentWordIndexRef.current = -1;
        }
      };
      
      const handleEnded = () => {
        setIsAiSpeaking(false);
        setHasAudioFinished(true);
        URL.revokeObjectURL(audioUrl);
        if (isQuestionReading) {
          setHighlightState(prev => ({ ...prev, isReading: false }));
          // Reset word index when done
          setCurrentWordIndex(-1);
        }
        // Clean up audio resources
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.ontimeupdate = null;
      };
      
      const handleError = () => {
        setIsAiSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        if (isQuestionReading) {
          setHighlightState(prev => ({ ...prev, isReading: false }));
          // Reset word index on error
          setCurrentWordIndex(-1);
        }
        // Clean up audio resources
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.ontimeupdate = null;
        toast({
          description: 'Audio playback failed. Please try again.',
          variant: "destructive"
        });
      };

      // Update the question text ref with the current question
      questionTextRef.current = questionContext?.text || questionContext?.question_text || '';
      
      const handleTimeUpdate = () => {
        if (isQuestionReading) {
          const progress = audio.currentTime / audio.duration;
          
          // Get the text from our ref to ensure we have the latest value
          const questionText = questionTextRef.current;
          
          // Update highlight state
          setHighlightState(prev => ({ ...prev, progress }));
          
          // Calculate which word should be highlighted based on progress
          if (progress > 0 && questionText) {
            // Split the text into words directly here instead of using state
            const words = questionText.match(/\S+/g) || [];
            const wordIndex = Math.min(Math.floor(progress * words.length), words.length - 1);
            
            console.log('Updating word index:', wordIndex, 'progress:', progress, 'words:', words.length);
            
            // Force a direct DOM update for the highlighted word
            const wordElements = document.querySelectorAll('.question-word');
            wordElements.forEach((el, idx) => {
              if (idx === wordIndex) {
                el.classList.add('bg-blue-200', 'text-blue-900');
              } else {
                el.classList.remove('bg-blue-200', 'text-blue-900');
              }
            });
            
            // Also update the state for React's rendering
            setCurrentWordIndex(wordIndex);
          }
        }
      };
      
      // Assign the event handlers
      audio.onplay = handlePlay;
      audio.onended = handleEnded;
      audio.onerror = handleError;
      audio.ontimeupdate = handleTimeUpdate;
      
      // Update the audio element state
      setAudioElement(audio);
      
      // Update the ref for the visualizer if it exists
      if (audioRef.current) {
        audioRef.current = audio;
      }
      
      // Play the audio
      try {
        await audio.play();
        // Mark that user interaction has occurred if audio plays successfully
        setHasUserInteracted(true);
      } catch (playError) {
        console.log('Audio play failed, likely due to auto-play restrictions:', playError);
        
        // Show permission prompt for AI responses
        if (!hasUserInteracted) {
          toast({
            title: "Audio Permission Required",
            description: "Please enable audio permissions in your browser and refresh the page to hear AI responses automatically.",
            variant: "default",
            duration: 6000,
          });
        }
        
        // Clean up resources
        URL.revokeObjectURL(audioUrl);
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.ontimeupdate = null;
        
        throw playError;
      }
      
      // Mark that user interaction has occurred (indirectly)
      setHasUserInteracted(true);
      
    } catch (error) {
      console.error('Error generating speech:', error);
      setIsAiSpeaking(false);
      if (isQuestionReading) {
        setHighlightState(prev => ({ ...prev, isReading: false }));
      }
      toast({
        description: 'An error occurred generating speech. Please try again.',
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
            
            {/* Main Speech Recognition Button */}
            <Button
              onClick={() => {
                // Enable audio on first interaction if needed
                if (!hasUserInteracted) {
                  setHasUserInteracted(true);
                }
                
                if (isListening) {
                  recognitionRef.current?.stop()
                  setIsListening(false)
                } else if (!isAiSpeaking && !isLoading) {
                  try {
                    recognitionRef.current?.start()
                    setIsListening(true)
                  } catch (error) {
                    console.error('Error starting speech recognition:', error)
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "Failed to start speech recognition. Please try again.",
                    })
                  }
                }
              }}
              disabled={isAiSpeaking || isLoading}
              className={`w-full ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-[#0066CC] hover:bg-[#0077EE]'
              } text-white rounded-full`}
            >
              {isListening ? (
                <>
                  <Mic className="w-4 h-4 mr-2 animate-pulse" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  {isLoading ? 'Processing...' : isAiSpeaking ? 'AI Speaking...' : 'Start Speaking'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
