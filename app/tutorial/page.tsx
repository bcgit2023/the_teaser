"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Award, Brain, ArrowRight, Sparkles, Target, Video, VideoOff, LogOut } from "lucide-react"
import Image from "next/image"
import ChatContent from "@/app/chat/ChatContent"
import SimpleWebcamRecorder from "@/components/SimpleWebcamRecorder"
import ScreenRecorder from "@/components/ScreenRecorder"

interface Question {
  id: number
  uuid: string
  question_text: string
  options: string[]
  correct_option: number
  type: string
  difficulty_level: number
  category?: string
}

interface Answer {
  questionId: number
  selectedAnswer: string
  isCorrect: boolean
}

export default function TutorialPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Answer[]>([])
  const [showAssessment, setShowAssessment] = useState(false)
  const [showWebcam, setShowWebcam] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: "ai",
      content: "Welcome! Let's practice English together. I'll guide you through some questions.",
    },
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fisher-Yates shuffle algorithm to randomize question order
  // This ensures each tutorial session has a unique sequence, maximizing use of all 100 questions
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array] // Create a copy to avoid mutating the original
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  useEffect(() => {
    const fetchSmartQuestions = async () => {
      try {
        // Try to fetch smart questions first
        const response = await fetch('/api/smart-questions?count=5')
        if (!response.ok) {
          throw new Error('Failed to fetch smart questions')
        }
        const data = await response.json()
        
        if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          setQuestions(data.questions);
          setMessages(prev => [...prev, {
            role: 'ai',
            content: `Great! I've selected ${data.questions.length} personalized questions based on your learning progress. Let's begin!`
          }])
        } else {
          throw new Error('No smart questions received')
        }
      } catch (error) {
        console.error('Failed to fetch smart questions, falling back to regular questions:', error)
        
        // Fallback to regular questions API
        try {
          const response = await fetch('/api/questions')
          if (!response.ok) {
            throw new Error('Failed to fetch fallback questions')
          }
          const data = await response.json()
          if (Array.isArray(data) && data.length > 0) {
            // Convert old format to new format for compatibility
            const convertedQuestions = data.map((q: any) => ({
              id: q.id,
              uuid: q.id.toString(), // Fallback UUID
              question_text: q.question_text,
              options: q.options,
              correct_option: q.options.indexOf(q.correct_answer) + 1,
              type: 'multiple_choice',
              difficulty_level: 2,
              category: 'general'
            }));
            
            const shuffledQuestions = shuffleArray([...convertedQuestions]);
            setQuestions(shuffledQuestions);
            setMessages(prev => [...prev, {
              role: 'ai',
              content: 'I\'ve prepared some practice questions for you. Let\'s get started!'
            }])
          } else {
            throw new Error('No questions received')
          }
        } catch (fallbackError) {
          console.error('Failed to fetch fallback questions:', fallbackError)
          setMessages(prev => [...prev, {
            role: 'ai',
            content: 'Sorry, I had trouble loading the questions. Please refresh the page.'
          }])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchSmartQuestions()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleAnswer = async (selectedAnswer: string) => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    const startTime = Date.now()
    
    // Determine correct answer based on question format
    let correctAnswer: string
    let isCorrect: boolean
    
    if (currentQuestion.correct_option && currentQuestion.options) {
      // New smart question format
      correctAnswer = currentQuestion.options[currentQuestion.correct_option - 1]
      isCorrect = selectedAnswer === correctAnswer
    } else {
      // Fallback format compatibility
      correctAnswer = (currentQuestion as any).correct_answer || selectedAnswer
      isCorrect = selectedAnswer === correctAnswer
    }

    const responseTime = Date.now() - startTime

    setUserAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedAnswer,
        isCorrect,
      },
    ])

    // Record answer to smart question system
    if (currentQuestion.uuid) {
      try {
        await fetch('/api/smart-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question_uuid: currentQuestion.uuid,
            user_answer: selectedAnswer,
            correct_answer: correctAnswer,
            is_correct: isCorrect,
            response_time_ms: responseTime
          })
        })
      } catch (error) {
        console.error('Failed to record answer:', error)
        // Continue with the tutorial even if recording fails
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        content: isCorrect
          ? "Correct! Well done! Let's try another question."
          : `Not quite. The correct answer is "${correctAnswer}". Let's keep practicing!`,
      },
    ])

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    } else {
      setShowAssessment(true)
      saveQuizResults()
    }
  }

  const saveQuizResults = async () => {
    try {
      const { score, correct: correctAnswers, total } = calculateScore()
      
      const answers = userAnswers.map((answer) => {
        const question = questions.find(q => q.id === answer.questionId)
        let correctAnswer = ''
        
        if (question) {
          if (question.correct_option && question.options) {
            // New smart question format
            correctAnswer = question.options[question.correct_option - 1]
          } else {
            // Fallback format compatibility
            correctAnswer = (question as any).correct_answer || ''
          }
        }
        
        return {
          questionText: question?.question_text || '',
          selectedAnswer: answer.selectedAnswer,
          correctAnswer,
          isCorrect: answer.isCorrect
        }
      })

      const response = await fetch('/api/quiz-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score,
          correctAnswers,
          totalQuestions: total,
          answers
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save quiz results')
      }
    } catch (error) {
      console.error('Error saving quiz results:', error)
      // Optionally show an error message to the user
      setMessages(prev => [...prev, {
        role: 'ai',
        content: 'There was an issue saving your quiz results, but don\'t worry - your score is still displayed here!'
      }])
    }
  }

  const calculateScore = () => {
    const correctAnswers = userAnswers.filter((answer) => answer.isCorrect).length
    return {
      score: (correctAnswers / questions.length) * 100,
      correct: correctAnswers,
      total: questions.length,
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      // Clear JWT token from localStorage
      localStorage.removeItem('token')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Redirect to login page
      router.push('/login')
    } catch (error) {
      console.error('Error during sign out:', error)
      setSigningOut(false)
    }
  }

  const renderAssessmentPage = () => {
    const { score, correct, total } = calculateScore()
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
                <Award className="w-16 h-16 text-[#2663ec]" />
              </div>
            </div>
          </div>
          <div className="pt-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Complete!</h1>
            <p className="text-gray-600 text-base">Great job! Here's your performance summary.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#2663ec] to-[#1a47b8] rounded-lg blur opacity-50 group-hover:opacity-75 transition duration-1000"></div>
            <div className="relative p-4 bg-white rounded-lg">
              <div className="text-4xl font-bold text-[#2663ec] mb-1">{score.toFixed(0)}%</div>
              <div className="text-xs font-medium text-gray-600">Overall Score</div>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-400 to-green-600 rounded-lg blur opacity-50 group-hover:opacity-75 transition duration-1000"></div>
            <div className="relative p-4 bg-white rounded-lg">
              <div className="text-4xl font-bold text-green-500 mb-1">{correct}</div>
              <div className="text-xs font-medium text-gray-600">Correct Answers</div>
            </div>
          </div>
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-orange-600 rounded-lg blur opacity-50 group-hover:opacity-75 transition duration-1000"></div>
            <div className="relative p-4 bg-white rounded-lg">
              <div className="text-4xl font-bold text-orange-500 mb-1">{total - correct}</div>
              <div className="text-xs font-medium text-gray-600">Need Review</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Target className="w-5 h-5 text-[#2663ec]" />
            <h2 className="text-xl font-semibold text-gray-900">Question Review</h2>
          </div>
          <div className="grid gap-4 max-h-[calc(100vh-42rem)] overflow-y-auto pr-4">
            {userAnswers.map((answer, index) => (
              <div
                key={index}
                className="p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-start gap-3">
                  {answer.isCorrect ? (
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                  )}
                  <div className="space-y-1 flex-1">
                    <p className="text-base font-medium text-gray-900">{questions[index].question_text}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-700">Your answer:</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          answer.isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {answer.selectedAnswer}
                      </span>
                      {!answer.isCorrect && (
                        <>
                          <span className="font-medium text-gray-700">Correct:</span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                            {questions[index].correct_option && questions[index].options 
                              ? questions[index].options[questions[index].correct_option - 1]
                              : (questions[index] as any).correct_answer || 'N/A'
                            }
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-6">
          <Button
            onClick={() => window.location.reload()}
            className="bg-[#2663ec] hover:bg-[#1a47b8] text-base px-6 py-2 h-auto rounded-xl"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Try Another Quiz
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2663ec] to-[#1a47b8]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-white/20 rounded-full"></div>
            <Brain className="w-16 h-16 mx-auto text-white animate-pulse relative z-10" />
          </div>
          <div className="text-2xl font-semibold text-white">Analyzing your learning style...</div>
          <div className="text-gray-200">Our AI is preparing your personalized tutorial</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2663ec] to-[#1a47b8] flex">
      {/* Main Content - Left Side (2/3) */}
      <div className="w-2/3 p-8">
        <div className="h-[calc(100vh-4rem)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 space-y-6 overflow-y-auto relative">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2663ec] to-[#1a47b8] bg-clip-text text-transparent">
                English Practice
              </h1>
              <p className="text-gray-600 text-base">Master the basics with our AI tutor</p>
            </div>
            
            <Button
              onClick={handleSignOut}
              disabled={signingOut}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 min-w-[100px]"
            >
              {signingOut ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </>
              )}
            </Button>
          </div>

          {!showAssessment ? (
            <Card className="p-6 space-y-6 border-0 shadow-xl rounded-xl bg-gradient-to-b from-white to-gray-50/50">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Exercise {currentQuestionIndex + 1}</h2>
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-[#2663ec] font-semibold text-sm">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-gray-700 text-lg">Choose the correct answer:</p>
                  <p className="text-xl font-medium text-gray-900">{questions[currentQuestionIndex]?.question_text}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 mt-6">
                  {questions[currentQuestionIndex]?.options.map((option, index) => {
                    const optionLabel = String.fromCharCode(65 + index)
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswer(option)}
                        className="group relative w-full p-4 text-left rounded-xl border-2 border-gray-100 
                          hover:border-[#2663ec] hover:bg-blue-50/50 transition-all duration-300 hover:shadow-md"
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-[#2663ec] 
                            text-gray-500 group-hover:text-white flex items-center justify-center 
                            font-semibold text-lg transition-colors duration-300"
                          >
                            {optionLabel}
                          </div>
                          <span className="text-gray-800 group-hover:text-[#2663ec] text-lg transition-colors duration-300">
                            {option}
                          </span>
                          <ArrowRight
                            className="w-5 h-5 text-[#2663ec] opacity-0 group-hover:opacity-100 
                            transition-all duration-300 ml-auto transform translate-x-0 
                            group-hover:translate-x-2"
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Progress Indicator */}
                <div className="mt-8">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <div className="text-gray-600 font-medium">Progress</div>
                    <div className="font-semibold text-[#2663ec]">
                      {currentQuestionIndex + 1}/{questions.length} Exercises
                    </div>
                  </div>
                  <Progress
                    value={((currentQuestionIndex + 1) / questions.length) * 100}
                    className="w-full h-2 rounded-full"
                  />
                </div>
              </div>
            </Card>
          ) : (
            renderAssessmentPage()
          )}
        </div>
      </div>

      {/* Webcam positioned at the lower area */}
      {showWebcam && (
        <div className="absolute bottom-16 left-24 z-10">
          <div className="relative">
            <SimpleWebcamRecorder 
              width={235} 
              height={235} 
              className="shadow-lg"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWebcam(!showWebcam)}
              className="absolute -top-3 -right-3 bg-white flex items-center justify-center p-1 h-8 w-8 rounded-full shadow-md z-20"
            >
              <VideoOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Right side - AI Tutor Chat */}
      <div className="w-1/3 p-8">
        <div className="h-[calc(100vh-4rem)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 flex flex-col">

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 flex items-center justify-center">
                <Image
                  src="/logo/fl_logo.png"
                  alt="FutureLearner AI"
                  width={48}
                  height={48}
                  priority
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">AI Tutor</h3>
                <p className="text-sm text-gray-500">Always here to help</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showWebcam && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWebcam(!showWebcam)}
                  className="flex items-center gap-1"
                >
                  <Video className="w-3 h-3" />
                  <span className="text-xs">Show Camera</span>
                </Button>
              )}
              <ScreenRecorder />
            </div>
          </div>
          <div className="flex-1">
            {questions[currentQuestionIndex] && (
              <ChatContent 
                questionContext={{
                  id: questions[currentQuestionIndex].id,
                  text: questions[currentQuestionIndex].question_text,
                  options: questions[currentQuestionIndex].options,
                  correct_answer: questions[currentQuestionIndex].correct_option && questions[currentQuestionIndex].options
                    ? questions[currentQuestionIndex].options[questions[currentQuestionIndex].correct_option - 1]
                    : (questions[currentQuestionIndex] as any).correct_answer || ''
                }}
                enableContextAwareness={true}
                isFirstQuestion={currentQuestionIndex === 0}
              />
            )}
            {!questions[currentQuestionIndex] && (
              <ChatContent enableContextAwareness={false} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
