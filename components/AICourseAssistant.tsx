'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Mic } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import VoiceVisualizer from '@/components/VoiceVisualizer'
import ErrorMessage from '@/components/ui/error-message'
import { playTextToSpeech, getVoiceForMode } from '@/lib/tts-utils'
import { startSpeechRecognition, stopSpeechRecognition, isSpeechRecognitionSupported } from '@/lib/speech-utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  id?: string
}

interface AICourseAssistantProps {
  mode: 'proactive' | 'reactive' | 'assessment'
  currentQuestion?: {
    text: string
    options: string[]
  }
  quizResults?: {
    score: number
    totalQuestions: number
  }
}

export default function AICourseAssistant({ mode, currentQuestion, quizResults }: AICourseAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState<{title: string, message: string} | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef<boolean>(false)
  const currentQuestionRef = useRef<string>('')
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const previousMode = useRef<'proactive' | 'reactive' | 'assessment'>(mode)

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { hour12: false })
  }

  // Initialize speech recognition
  useEffect(() => {
    // Check if speech recognition is supported in this browser
    if (typeof window !== 'undefined' && !isSpeechRecognitionSupported()) {
      console.warn('Speech recognition not supported in this browser')
      setSpeechError({
        title: 'Browser Compatibility Issue',
        message: 'Speech recognition is not supported in your browser. Please try using Chrome, Edge, or Safari.'
      })
    }

    return () => {
      // Clean up resources when component unmounts
      stopSpeechRecognition()
    }
  }, [])

  const handleUserInput = async (input: string) => {
    if (!input.trim()) {
      toast({
        description: 'Please provide some input before submitting.',
        variant: "destructive"
      })
      return
    }
    
    const newMessage = {
      role: 'user' as const,
      content: input,
      timestamp: getCurrentTime(),
      id: `user-${Date.now()}`
    }

    setMessages(prev => [...prev, newMessage])
    setIsLoading(true)

    try {
      // Get AI response
      const aiResponse = await getAIResponse([...messages, newMessage])
      
      const responseMessage: Message = {
        role: 'assistant' as const,
        content: aiResponse,
        timestamp: getCurrentTime(),
        id: `ai-${Date.now()}`
      }
      setMessages(prev => [...prev, responseMessage])

      // Generate and play audio response
      await playAudioResponse(aiResponse)
    } catch (error) {
      console.error('Error in handleUserInput:', error)
      toast({
        description: error instanceof Error ? error.message : 'An error occurred. Please try again.',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Separate function to handle audio response generation and playback
  const playAudioResponse = async (text: string): Promise<void> => {
    try {
      if (!audioRef.current) {
        throw new Error('Audio element not available')
      }
      
      // Select voice based on current mode and play the audio
      const voice = getVoiceForMode(mode)
      
      await playTextToSpeech(
        text,
        audioRef.current,
        voice,
        () => setIsAiSpeaking(true),
        () => setIsAiSpeaking(false),
        (error) => {
          console.error('Audio playback error:', error)
          setIsAiSpeaking(false)
          toast({
            description: 'Failed to play audio response. Please try again.',
            variant: "destructive"
          })
        }
      )
    } catch (error) {
      console.error('Error in playAudioResponse:', error)
      throw error
    }
  }

  const getAIResponse = async (messageHistory: Message[]) => {
    try {
      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          currentQuestion,
          messages: messageHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      })

      if (!response.ok) throw new Error('Failed to get AI response')
      
      const data = await response.json()
      return data.content
    } catch (error) {
      console.error('Error getting AI response:', error)
      return 'I apologize, but I encountered an error. Please try again.'
    }
  }

  useEffect(() => {
    const initializeChat = async () => {
      if (!hasInitialized.current) {
        try {
          hasInitialized.current = true
          setIsLoading(true)
          
          // Get initial AI response
          const initialResponse = await getAIResponse([])
          
          // Create message object
          const message: Message = {
            role: 'assistant' as const,
            content: initialResponse,
            timestamp: getCurrentTime(),
            id: 'initial'
          }
          
          setMessages([message])
          setIsLoading(false)
          
          // Automatically speak the initial message in proactive mode
          if (mode === 'proactive') {
            await playAudioResponse(initialResponse)
          }
        } catch (error) {
          console.error('Error initializing chat:', error)
          setIsLoading(false)
          toast({
            description: 'Failed to initialize the chat. Please refresh the page.',
            variant: "destructive"
          })
        }
      }
    }

    initializeChat()
    
    // Clean up function to handle component unmounting
    return () => {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  useEffect(() => {
    // Only get hints for new questions in proactive mode
    if (mode === 'proactive' && 
        currentQuestion && 
        currentQuestion.text !== currentQuestionRef.current) {
      currentQuestionRef.current = currentQuestion.text
      
      const getHint = async () => {
        try {
          // Add a user message requesting a hint
          const hintRequest: Message = {
            role: 'user' as const,
            content: 'Can you give me a hint for this question?',
            timestamp: getCurrentTime(),
            id: `hint-${Date.now()}`
          }
          
          // Get AI response for the hint
          const hintResponse = await getAIResponse([...messages, hintRequest])
          
          // Create and add the assistant message with the hint
          const message: Message = {
            role: 'assistant' as const,
            content: hintResponse,
            timestamp: getCurrentTime(),
            id: `hint-response-${Date.now()}`
          }
          setMessages(prev => [...prev, message])

          // Automatically speak hints in proactive mode
          await playAudioResponse(hintResponse)
        } catch (error) {
          console.error('Error getting hint:', error)
          toast({
            description: 'Failed to get a hint for this question. Please try again.',
            variant: "destructive"
          })
        }
      }

      getHint()
    }
  }, [currentQuestion?.text])

  useEffect(() => {
    const handleModeChange = async () => {
      try {
        // Clear existing messages
        setMessages([])
        hasInitialized.current = false
        
        // Initialize with new mode-specific message
        setIsLoading(true)
        let initialMessage: Message

        if (mode === 'assessment') {
          if (quizResults) {
            const percentage = (quizResults.score / quizResults.totalQuestions) * 100
            const passed = percentage >= 80

            const content = passed
              ? `Congratulations! You've scored ${percentage.toFixed(1)}% on the quiz. You've demonstrated a strong understanding of Simple Present tense. Keep up the great work!`
              : `You've scored ${percentage.toFixed(1)}% on the quiz. While you're making progress, let's practice more to strengthen your understanding of Simple Present tense. Don't worry - with more practice, you'll definitely improve! Would you like to try the exercises again?`

            initialMessage = {
              role: 'assistant' as const,
              content,
              timestamp: getCurrentTime(),
              id: 'assessment-result'
            }
          } else {
            // Quiz is still ongoing
            setIsLoading(false)
            return
          }
        } else if (mode === 'reactive') {
          initialMessage = {
            role: 'assistant' as const,
            content: "We're now moving to self-practice. I'll be here to help whenever you have questions about Simple Present tense. Just click 'Start Speaking' to ask me anything!",
            timestamp: getCurrentTime(),
            id: 'mode-change'
          }
        } else {
          const initialResponse = await getAIResponse([])
          initialMessage = {
            role: 'assistant' as const,
            content: initialResponse,
            timestamp: getCurrentTime(),
            id: 'mode-change'
          }
        }

        setMessages([initialMessage])
        setIsLoading(false)

        // Speak the message
        await playAudioResponse(initialMessage.content)
      } catch (error) {
        console.error('Error in handleModeChange:', error)
        setIsLoading(false)
        toast({
          description: 'Failed to initialize the assistant. Please refresh the page.',
          variant: "destructive"
        })
      }
    }

    if (mode !== previousMode.current || (mode === 'assessment' && quizResults)) {
      handleModeChange()
      previousMode.current = mode
    }
  }, [mode, quizResults])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioRef} className="hidden" />
      
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
        {messages.map((message) => (
          <div key={message.id}>
            <div className={`${
              message.role === 'user' 
                ? 'bg-[#0066CC] text-white' 
                : 'bg-white text-gray-800'
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
      
      <div className="flex-shrink-0 border-t p-4">
        <VoiceVisualizer audioRef={audioRef} isActive={isListening || isAiSpeaking} />
        {mode !== 'assessment' && (
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
                    await handleUserInput(transcript)
                  },
                  // onError callback
                  (_, message) => {
                    setIsListening(false)
                    setSpeechError({
                      title: 'Speech Recognition Error',
                      message: message
                    })
                  },
                  // onEnd callback
                  () => {
                    setIsListening(false)
                  },
                  // onRetry callback (optional)
                  undefined,
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
            className="w-full mt-2 bg-[#0066CC] hover:bg-[#0077EE] text-white"
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
        )}
      </div>
    </div>
  )
}
