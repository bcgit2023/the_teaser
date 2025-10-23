'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type Question = {
  id: number;
  question_text: string;
  options: string[];
  correct_answer: string;
}

type QuestionTiming = {
  questionNumber: number;
  questionId: number;
  timeTaken: number;
  isCorrect: boolean;
  answer: string;
}

export default function Component() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [score, setScore] = useState(0)
  const [quizStarted, setQuizStarted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null)
  const [questionTimings, setQuestionTimings] = useState<QuestionTiming[]>([])
  const router = useRouter()

  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/questions')
      const data = await response.json()
      setQuestions(data)
      setTimeLeft(30)
    } catch (error) {
      console.error('Error fetching questions:', error)
    }
  }

  const submitQuizResults = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const endTime = Date.now()
      const totalTimeSpent = startTime ? Math.floor((endTime - startTime) / 1000) : 0

      // Record the last question's timing if it hasn't been recorded yet
      const lastQuestionRecorded = questionTimings.some(t => t.questionNumber === questions.length)
      let finalQuestionTimings = [...questionTimings]

      if (!lastQuestionRecorded && selectedAnswer !== null && questionStartTime !== null) {
        const currentQuestion = questions[currentQuestionIndex]
        const isCorrect = selectedAnswer === currentQuestion.correct_answer
        const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000)

        finalQuestionTimings = [...questionTimings, {
          questionNumber: currentQuestionIndex + 1,
          questionId: currentQuestion.id,
          timeTaken,
          isCorrect,
          answer: selectedAnswer
        }]
      }

      console.log('Submitting quiz results with timings:', finalQuestionTimings)
      console.log('Total timings count:', finalQuestionTimings.length)
      console.log('Expected questions:', questions.length)

      const response = await fetch('/api/quiz-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score,
          correctAnswers: score,
          totalQuestions: questions.length,
          answers: finalQuestionTimings.map(timing => ({
            questionText: questions.find(q => q.id === timing.questionId)?.question_text || '',
            selectedAnswer: timing.answer,
            correctAnswer: questions.find(q => q.id === timing.questionId)?.correct_answer || '',
            isCorrect: timing.isCorrect
          }))
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit quiz results')
      }

      const data = await response.json()
      console.log('Quiz results submitted successfully:', data)
      
      if (data.quizResultId) {
        router.push(`/quiz-assessment/${data.quizResultId}`)
      } else {
        console.error('No quiz result ID received')
        throw new Error('No quiz result ID received')
      }
    } catch (error) {
      console.error('Error submitting quiz results:', error)
      setIsSubmitting(false)
    }
  }

  const handleNextQuestion = useCallback(() => {
    if (selectedAnswer !== null && questionStartTime !== null) {
      const currentQuestion = questions[currentQuestionIndex]
      const isCorrect = selectedAnswer === currentQuestion.correct_answer
      const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000)

      const newTiming = {
        questionNumber: currentQuestionIndex + 1,
        questionId: currentQuestion.id,
        timeTaken,
        isCorrect,
        answer: selectedAnswer
      }

      // Update question timings immediately
      setQuestionTimings(prev => [...prev, newTiming])

      if (isCorrect) {
        setScore(prevScore => prevScore + 1)
      }
    }

    const nextQuestionIndex = currentQuestionIndex + 1
    if (nextQuestionIndex < questions.length) {
      setCurrentQuestionIndex(nextQuestionIndex)
      setSelectedAnswer(null)
      setTimeLeft(30)
      setQuestionStartTime(Date.now())
    } else {
      // This is the last question, but don't submit here
      // Let the "Finish" button handle submission
      setCurrentQuestionIndex(nextQuestionIndex)
    }
  }, [currentQuestionIndex, questions, selectedAnswer, questionStartTime])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      setQuizStarted(true)
      setStartTime(Date.now())
      setQuestionStartTime(Date.now())
      fetchQuestions()
    }
    return () => {}
  }, [countdown])

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (quizStarted && questions.length > 0) {
      timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime > 0) {
            return prevTime - 1
          } else {
            if (timer) clearInterval(timer)
            handleNextQuestion()
            return 0
          }
        })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [quizStarted, questions, handleNextQuestion])

  const handleAnswerSelection = (answer: string) => {
    setSelectedAnswer(answer)
  }

  if (countdown > 0) {
    return (
      <div className="min-h-screen bg-blue-500 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-center">Fun English Quiz</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg mb-6">Get ready! Your quiz will start in...</p>
            <p className="text-9xl font-bold text-blue-600">{countdown}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quizStarted || questions.length === 0) {
    return (
      <div className="min-h-screen bg-blue-500 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-2xl font-semibold">Loading questions...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const answers = currentQuestion.options

  return (
    <div className="min-h-screen bg-blue-500 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-4xl font-bold">Fun English Quiz</CardTitle>
          <div className="bg-blue-100 text-blue-800 text-2xl font-bold px-4 py-2 rounded-full">
            Time Left: {timeLeft}s
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={(currentQuestionIndex / questions.length) * 100} className="w-full h-2" />
          <h2 className="text-3xl font-bold">{currentQuestion.question_text}</h2>
          <div className="space-y-4">
            {answers.map((answer, index) => (
              <Button
                key={index}
                className={`w-full text-left justify-start text-2xl p-6 h-auto ${
                  selectedAnswer === answer ? 'bg-blue-200 text-blue-800' : 'bg-white text-black'
                }`}
                variant="outline"
                onClick={() => handleAnswerSelection(answer)}
              >
                {answer}
              </Button>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <div className="text-xl font-semibold">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          <Button 
            onClick={handleNextQuestion}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xl py-2 px-6"
            disabled={selectedAnswer === null || isSubmitting}
          >
            {currentQuestionIndex === questions.length - 1 ? "Finish" : "Next Question"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}