'use client'

import React from 'react'
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, ChevronUp, Clock, BarChart2 } from "lucide-react"

export default function QuizAssessment() {
  const params = useParams()
  const quizId = params?.id ?? 'unknown'

  // Mock data for the quiz assessment
  const quizData = {
    title: "Mathematics Assessment",
    description: "Test your math skills with this comprehensive quiz",
    questions: 20,
    timeLimit: 30, // in minutes
    difficulty: "Intermediate",
    averageScore: 75,
    yourScore: 85,
    improvement: 10,
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">{quizData.title}</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quiz Summary</CardTitle>
          <CardDescription>{quizData.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center">
              <MessageCircle className="mr-2 h-4 w-4 text-blue-500" />
              <span>{quizData.questions} Questions</span>
            </div>
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4 text-blue-500" />
              <span>{quizData.timeLimit} Minutes</span>
            </div>
            <div className="flex items-center">
              <BarChart2 className="mr-2 h-4 w-4 text-blue-500" />
              <span>{quizData.difficulty}</span>
            </div>
            <div className="flex items-center">
              <Badge variant="outline" className="text-blue-500 border-blue-500">
                Quiz ID: {quizId}
              </Badge>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Your Score</h3>
              <Progress value={quizData.yourScore} className="h-4" />
              <p className="text-sm text-gray-500 mt-1">{quizData.yourScore}% Correct</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Average Score</h3>
              <Progress value={quizData.averageScore} className="h-4" />
              <p className="text-sm text-gray-500 mt-1">{quizData.averageScore}% Correct</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold">Improvement</span>
            <div className="flex items-center">
              <span className="text-2xl font-bold text-green-500 mr-2">+{quizData.improvement}%</span>
              <ChevronUp className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <p className="text-gray-600">
            Great job! You've shown significant improvement in your performance. Keep up the good work and continue practicing to further enhance your skills.
          </p>
        </CardContent>
      </Card>
      <div className="mt-6 flex justify-center">
        <Button className="bg-blue-600 hover:bg-blue-700">Retake Quiz</Button>
      </div>
    </div>
  )
}