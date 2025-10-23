'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Mic } from 'lucide-react'
import VoiceVisualizer from '@/components/VoiceVisualizer'
import ErrorMessage from '@/components/ui/error-message'
import { playTextToSpeech } from '@/lib/tts-utils'
import { startSpeechRecognition, stopSpeechRecognition, isSpeechRecognitionSupported } from '@/lib/speech-utils'
import type { Question } from '@/lib/services/supabase-smart-question-service'

// Extended Question type with uuid field
interface ExtendedQuestion extends Question {
  uuid: string
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface ChatContentProps {
  currentQuestion: ExtendedQuestion
  previousAnswers: {
    questionId: string
    isCorrect: boolean
    concept: string
  }[]
}

export default function ChatContent({ currentQuestion, previousAnswers }: ChatContentProps) {
  const { toast } = useToast()

  // State
  const [messages, setMessages] = useState<Message[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isLoading] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  // Used to control audio playback state - keeping for future implementation
  const [, setIsPlaying] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [teachingStep, setTeachingStep] = useState<'introduction' | 'concept_check' | 'guidance' | 'options'>('introduction')
  const [isProcessing, setIsProcessing] = useState(false)
  const [speechError, setSpeechError] = useState<{title: string, message: string} | null>(null)

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentQuestionRef = useRef<string | null>(null)
  const lastMessageRef = useRef<string>('')
  const processedStepsRef = useRef<Set<string>>(new Set())

  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
  };

  // Used in createMessage function
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { hour12: false })
  }

  const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
    role,
    content,
    timestamp: getCurrentTime()
  })

  /* Removed unused function _generateStepLock */

  // Play welcome message and prepare first question in parallel
  useEffect(() => {
    if (!isMounted) {
      setIsMounted(true)
      
      const playWelcomeMessage = async () => {
        try {
          const welcomeMessage = "Welcome to your English quiz! I will guide you through each question step-by-step. If you have any questions, feel free to ask me anytime. Let's get started!"
          
          setMessages([createMessage('assistant', welcomeMessage)])
          
          // Use the text-to-speech utility function
          if (audioRef.current) {
            await playTextToSpeech(
              welcomeMessage,
              audioRef.current,
              'nova',
              () => {
                setIsAiSpeaking(true)
              },
              () => {
                setIsAiSpeaking(false)
                
                // After welcome message ends, show the first question if available
                if (currentQuestion && !currentQuestionRef.current) {
                  currentQuestionRef.current = currentQuestion.uuid
                  setTimeout(() => {
                    setTeachingStep('introduction')
                    startTeaching()
                  }, 500)
                }
              },
              (error) => {
                console.error('Error playing welcome audio:', error)
                setSpeechError({
                  title: "Audio Playback Error",
                  message: "Failed to play welcome message."
                })
              }
            )
          }
        } catch (error) {
          console.error('Error in welcome message:', error)
          setSpeechError({
            title: "Audio Playback Error",
            message: "Failed to play welcome message. Please refresh the page."
          })
          
          // Continue with teaching even if audio fails
          if (currentQuestion && !currentQuestionRef.current) {
            currentQuestionRef.current = currentQuestion.uuid
            setTimeout(() => {
              setTeachingStep('introduction')
              startTeaching()
            }, 500)
          }
        }
      }
      
      setTimeout(() => {
        playWelcomeMessage()
      }, 2000)
    }
  }, [])

  const handleAiSpeaking = async (audioUrl: string, message: Message): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioRef.current) {
        resolve()
        return
      }

      // Stop any existing audio
      audioRef.current.pause()
      audioRef.current.currentTime = 0

      audioRef.current.src = audioUrl
      
      audioRef.current.onplay = () => {
        setIsAiSpeaking(true)
        setIsPlaying(true)
        setMessages(prev => [...prev, message])
      }

      audioRef.current.onended = () => {
        setIsAiSpeaking(false)
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
        resolve()
      }
      
      audioRef.current.onerror = (e) => {
        console.error('Audio playback error:', e)
        setIsAiSpeaking(false)
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
        resolve()
      }

      setTimeout(() => {
        audioRef.current?.play().catch(error => {
          console.error('Error playing audio:', error)
          resolve()
        })
      }, 100)
    })
  }

  const startTeaching = async () => {
    if (!currentQuestion || isAiSpeaking || isProcessing) return;

    // Create unique step identifier
    const stepId = `${currentQuestion.uuid}-${teachingStep}`;
    
    // Check if this step has already been processed
    if (processedStepsRef.current.has(stepId)) {
      setIsProcessing(false);
      return;
    }

    try {
      setIsProcessing(true);
      processedStepsRef.current.add(stepId);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [],
          context: {
            step: teachingStep,
            currentQuestion,
            previousAnswers
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');
      
      const data = await response.json();
      
      // Verify this is still the current step
      if (stepId !== `${currentQuestion.uuid}-${teachingStep}`) {
        setIsProcessing(false);
        return;
      }

      // Check message uniqueness using hash
      const messageHash = hashCode(data.text);
      if (lastMessageRef.current === messageHash) {
        setIsProcessing(false);
        return;
      }

      const audioResponse = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: data.text,
          voice: 'nova',
          model: 'tts-1',
          speed: 1.0
        }),
      });

      if (!audioResponse.ok) throw new Error('Failed to get audio response');

      const audioBlob = await audioResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const aiMessage = createMessage('assistant', data.text);
      await handleAiSpeaking(audioUrl, aiMessage);
      lastMessageRef.current = messageHash;

      if (data.progressToNext) {
        const nextStep = (() => {
          switch (teachingStep) {
            case 'introduction':
              return 'concept_check'
            case 'concept_check':
              return 'guidance'
            case 'guidance':
              return 'options'
            default:
              return teachingStep
          }
        })();

        if (nextStep !== teachingStep) {
          setTeachingStep(nextStep);
          setIsProcessing(false);
          // Delay next step until audio finishes
          setTimeout(() => {
            if (!isAiSpeaking) startTeaching();
          }, 500);
        } else {
          setIsProcessing(false);
        }
      } else {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error:', error);
      processedStepsRef.current.delete(stepId);
      setIsProcessing(false);
      setSpeechError({
        title: "Communication Error",
        message: "An error occurred while processing your request. Please try again."
      });
    }
  };

  useEffect(() => {
    const processQueue = async () => {
      // Removed for brevity
    }

    processQueue()
  }, [/* Removed for brevity */])

  /* Removed unused function _handleUserInput */

  useEffect(() => {
    // Check if speech recognition is supported in this browser
    if (typeof window !== 'undefined' && !isSpeechRecognitionSupported()) {
      console.warn('Speech recognition not supported in this browser')
      toast({
        variant: "destructive",
        title: "Browser Compatibility Issue",
        description: "Speech recognition is not supported in your browser. Please try using Chrome, Edge, or Safari."
      })
    }
    
    return () => {
      // Clean up resources when component unmounts
      stopSpeechRecognition()
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle question changes
  useEffect(() => {
    const handleQuestionChange = async () => {
      if (!currentQuestion) return;
      
      if (currentQuestion.uuid !== currentQuestionRef.current) {
        try {
          // Reset all tracking
          processedStepsRef.current.clear();
          lastMessageRef.current = '';
          currentQuestionRef.current = currentQuestion.uuid;
          setTeachingStep('introduction');
          
          // Clear existing audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
          }
          
          // Reset all state
          setIsProcessing(false);
          setIsAiSpeaking(false);
          setMessages([]);
          
          await startTeaching();
        } catch (error) {
          console.error('Error handling question change:', error);
          setIsProcessing(false);
        }
      }
    };

    handleQuestionChange();
  }, [currentQuestion?.uuid])

  return (
    <div className="flex flex-col h-full">
      {/* Hidden audio element for AI speech playback */}
      <audio ref={audioRef} hidden />
      {/* ARIA live region for screen readers */}
      <div aria-live="polite" className="sr-only">
        {messages.length > 0 && 
          `Latest message: ${messages[messages.length - 1]?.content || ''}`
        }
      </div>
      
      {/* Display speech recognition errors */}
      {speechError && (
        <div className="p-4">
          <ErrorMessage
            title={speechError.title}
            message={speechError.message}
            variant="warning"
            onRetry={() => setSpeechError(null)}
          />
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message, index) => (
          <div key={index}>
            <div className={`${
              message.role === 'user' 
                ? 'bg-[#0066CC] text-white' 
                : 'text-gray-900'
              } p-3 rounded-lg max-w-[80%] ${message.role === 'user' ? 'ml-auto' : ''}`}
            >
              {message.content}
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
        <div ref={messagesEndRef} />
      </div>
      
      <div className="flex flex-col gap-4 p-4 border-t">
        {/* Voice visualizer for both user input and AI speech */}
        <div className="h-16 overflow-hidden">
          <VoiceVisualizer 
            isActive={isListening || isAiSpeaking} 
            audioRef={audioRef} 
          />
        </div>
        
        <Button
          onClick={() => {
            if (isListening) {
              stopSpeechRecognition()
              setIsListening(false)
            } else {
              // Use the centralized speech recognition utility
              recognitionRef.current = startSpeechRecognition(
                // onResult callback
                async (transcript) => {
                  setIsListening(false)
                  // Add user message to the chat
                  const userMessage: Message = {
                    role: 'user',
                    content: transcript,
                    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
                  }
                  setMessages(prev => [...prev, userMessage])
                  
                  // Process the user input
                  try {
                    setIsProcessing(true)
                    const response = await fetch('/api/chat', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        message: transcript,
                        questionId: currentQuestion.uuid,
                        teachingStep,
                        previousAnswers
                      }),
                    })
                    
                    if (!response.ok) {
                      throw new Error(`HTTP error! status: ${response.status}`)
                    }
                    
                    const data = await response.json()
                    
                    // Process the response as in startTeaching function
                    await playTextToSpeech(
                      data.message,
                      audioRef.current!,
                      'nova',
                      () => setIsAiSpeaking(true),
                      () => setIsAiSpeaking(false)
                    )
                    
                    setIsProcessing(false)
                  } catch (error) {
                    console.error('Error processing speech input:', error)
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "Failed to process your speech. Please try again."
                    })
                    setIsProcessing(false)
                  }
                },
                // onError callback
                (_, message) => {
                  setIsListening(false)
                  toast({
                    variant: "destructive",
                    title: "Speech Recognition Error",
                    description: message
                  })
                },
                // onEnd callback
                () => {
                  setIsListening(false)
                },
                // options
                {
                  continuous: false,
                  interimResults: false,
                  lang: 'en-US'
                }
              )
              
              if (recognitionRef.current) {
                setIsListening(true)
              }
            }
          }}
          disabled={isLoading || isAiSpeaking}
          className="bg-[#0066CC] hover:bg-[#0077EE] text-white"
        >
          {isListening ? (
            <>
              <Mic className="w-4 h-4 mr-2 animate-pulse" />
              Listening...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 mr-2" />
              Start Speaking
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
