'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const questions = [
  {
    question: "What is the base form of the verb in Simple Present?",
    options: ["Base form", "Past tense", "Past participle"],
    answer: 0
  },
  {
    question: "When do we add 's' to the verb?",
    options: ["For I/you/we/they", "For he/she/it", "For all subjects"],
    answer: 1
  }
]

export default function ReviewQuiz({ onComplete }) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)

  const handleAnswer = (index) => {
    setSelectedAnswer(index)
    setShowResult(true)

    // Move to next question or complete
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1)
        setSelectedAnswer(null)
        setShowResult(false)
      } else {
        onComplete()
      }
    }, 1000)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quick Review</h3>
      <p>{questions[currentQuestion].question}</p>
      <div className="space-y-2">
        {questions[currentQuestion].options.map((option, index) => (
          <Button
            key={index}
            variant={selectedAnswer === index ? (index === questions[currentQuestion].answer ? 'default' : 'destructive') : 'outline'}
            className="w-full justify-start"
            onClick={() => handleAnswer(index)}
            disabled={showResult}
          >
            {option}
          </Button>
        ))}
      </div>
      {showResult && (
        <p className={`text-sm ${selectedAnswer === questions[currentQuestion].answer ? 'text-green-600' : 'text-red-600'}`}>
          {selectedAnswer === questions[currentQuestion].answer ? 'Correct!' : 'Try again next time!'}
        </p>
      )}
    </div>
  )
}
