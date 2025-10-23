'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

const questions = [
  {
    id: 1,
    question: "Choose the correct form of the verb:",
    sentence: "She _____ to the store yesterday.",
    options: ["go", "goes", "went", "gone"],
    correctAnswer: "went"
  },
  {
    id: 2,
    question: "Identify the proper noun in this sentence:",
    sentence: "We visited Paris last summer.",
    options: ["We", "visited", "Paris", "summer"],
    correctAnswer: "Paris"
  },
  {
    id: 3,
    question: "Select the correct pronoun:",
    sentence: "_____ gave me the book.",
    options: ["Him", "His", "He", "He's"],
    correctAnswer: "He"
  }
]

export default function GrammarPractice() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState("")
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)

  const handleAnswerSelection = (answer: string) => {
    setSelectedAnswer(answer)
  }

  const handleNextQuestion = () => {
    if (selectedAnswer === questions[currentQuestion].correctAnswer) {
      setScore(score + 1)
    }

    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer("")
    } else {
      setShowResult(true)
    }
  }

  const restartQuiz = () => {
    setCurrentQuestion(0)
    setSelectedAnswer("")
    setScore(0)
    setShowResult(false)
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold text-center mb-6 text-blue-600">Grammar Practice</h1>
      {!showResult ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Question {currentQuestion + 1} of {questions.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{questions[currentQuestion].question}</p>
            <p className="mb-4 font-semibold">{questions[currentQuestion].sentence}</p>
            <RadioGroup value={selectedAnswer} onValueChange={handleAnswerSelection}>
              {questions[currentQuestion].options.map((option) => (
                <div key={option} className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option}>{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleNextQuestion} 
              disabled={!selectedAnswer}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {currentQuestion === questions.length - 1 ? "Finish" : "Next Question"}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Quiz Results</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl text-center mb-4">
              You scored {score} out of {questions.length}
            </p>
            <Progress value={(score / questions.length) * 100} className="w-full h-4" />
          </CardContent>
          <CardFooter>
            <Button onClick={restartQuiz} className="w-full bg-blue-600 hover:bg-blue-700">
              Restart Quiz
            </Button>
          </CardFooter>
        </Card>
      )}
      {!showResult && (
        <div className="mt-4">
          <Progress value={progress} className="w-full h-4" />
          <p className="text-center mt-2">Progress: {Math.round(progress)}%</p>
        </div>
      )}
    </div>
  )
}