'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, ChevronDown, Clock, BarChart2, ArrowLeft } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface QuizAssessmentClientProps {
  id?: string
}

export default function QuizAssessmentClient({ id = "latest" }: QuizAssessmentClientProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState(true)
  const [quizData, setQuizData] = useState<any>(null)
  const [chatMessage, setChatMessage] = useState("")
  const router = useRouter()

  useEffect(() => {
    const fetchQuizData = async () => {
      // Simulating an API call to fetch quiz data
      await new Promise(resolve => setTimeout(resolve, 1000))

      // If id is "latest", generate a new quiz
      const quizId = id === "latest" ? Math.random().toString(36).substr(2, 9) : id

      setQuizData({
        id: quizId,
        score: 67,
        timeTaken: "10:30",
        passingScore: 70,
        averageScore: 72,
        questions: [
          {
            number: 1,
            correct: true,
            question: "What is the past tense of 'go'?",
            options: ["Goed", "Went", "Gone", "Going"],
            answer: "Went",
            userAnswer: "Went"
          },
          {
            number: 2,
            correct: true,
            question: "Which word is a synonym for 'enormous'?",
            options: ["Tiny", "Huge", "Average", "Mediocre"],
            answer: "Huge",
            userAnswer: "Huge"
          },
          {
            number: 3,
            correct: false,
            question: "What is the correct plural form of 'child'?",
            options: ["Childs", "Children", "Childrens", "Childres"],
            answer: "Children",
            userAnswer: "Childs"
          },
          {
            number: 4,
            correct: true,
            question: "Which sentence uses the correct form of 'there'?",
            options: [
              "Their going to the park.",
              "There going to the park.",
              "They're going to the park.",
              "There're going to the park."
            ],
            answer: "They're going to the park.",
            userAnswer: "They're going to the park."
          },
          {
            number: 5,
            correct: false,
            question: "What is the comparative form of the adjective 'good'?",
            options: ["Gooder", "More good", "Better", "Best"],
            answer: "Better",
            userAnswer: "More good"
          },
          {
            number: 6,
            correct: true,
            question: "Which sentence is in the passive voice?",
            options: [
              "The cat chased the mouse.",
              "The mouse was chased by the cat.",
              "The mouse ran from the cat.",
              "The cat and mouse played together."
            ],
            answer: "The mouse was chased by the cat.",
            userAnswer: "The mouse was chased by the cat."
          }
        ]
      })

      // If the id was "latest", update the URL with the new quiz id
      if (id === "latest") {
        router.replace(`/quiz-assessment/${quizId}`)
      }
    }

    fetchQuizData()
  }, [id, router])

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle chat submission logic here
    console.log("Chat message submitted:", chatMessage)
    setChatMessage("")
  }

  if (!quizData) {
    return <div>Loading...</div>
  }

  const passed = quizData.score >= quizData.passingScore

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-white p-4 shadow-md">
        <Button variant="ghost" className="mb-4 w-full justify-start" onClick={() => router.push('/tutorial')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tutorial
        </Button>
        <h2 className="mb-4 text-xl font-bold text-primary">Quiz Results for ID: {quizData.id}</h2>
        <p className="mb-4 text-sm text-muted-foreground">6 / 6 questions completed</p>
        {quizData.questions.map((q: any) => (
          <Button
            key={q.number}
            className={`mb-2 w-full justify-start ${
              q.correct ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
            onClick={() => {
              setSelectedQuestion(q.number)
              setSummaryExpanded(false)
            }}
          >
            Question {q.number}
          </Button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Your Quiz Results</CardTitle>
            <div className="flex items-center justify-center space-x-2 text-muted-foreground">
              <Clock className="h-5 w-5" />
              <span className="text-lg">Time Taken: {quizData.timeTaken}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xl font-semibold">Overall Score</span>
                <span className="text-2xl font-bold">{quizData.score}%</span>
              </div>
              <Progress value={quizData.score} className="h-3 w-full" />
            </div>
            <div className="mb-6 flex justify-center">
              <Badge variant={passed ? "default" : "destructive"} className="text-lg">
                {passed ? "PASSED" : "FAILED"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Detailed Analysis</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSummaryExpanded(!summaryExpanded)}
                className="p-1"
              >
                <ChevronDown className="h-6 w-6" />
              </Button>
            </div>
            {summaryExpanded && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span>Your Score</span>
                  <span className="font-semibold">{quizData.score}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Average Score</span>
                  <span className="font-semibold">{quizData.averageScore}%</span>
                </div>
                <div>
                  <h3 className="font-semibold">Performance Breakdown</h3>
                  <BarChart2 className="h-40 w-full" />
                </div>
                <div>
                  <h3 className="font-semibold">Next Steps</h3>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {passed ? (
                      <>
                        <li>Proceed to the next module</li>
                        <li>Review any questions you got wrong</li>
                      </>
                    ) : (
                      <>
                        <li>Review the study materials for this module</li>
                        <li>Focus on the topics you struggled with</li>
                        <li>Retake the quiz when you feel ready</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {selectedQuestion !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Question {selectedQuestion}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{quizData.questions[selectedQuestion - 1].question}</p>
              <RadioGroup defaultValue={quizData.questions[selectedQuestion - 1].userAnswer}>
                {quizData.questions[selectedQuestion - 1].options.map((option: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={option}
                      id={`question-${selectedQuestion}-option-${index}`}
                      disabled
                      className={
                        option === quizData.questions[selectedQuestion - 1].answer
                          ? 'text-green-600'
                          : option === quizData.questions[selectedQuestion - 1].userAnswer &&
                            option !== quizData.questions[selectedQuestion - 1].answer
                          ? 'text-red-600'
                          : ''
                      }
                    />
                    <Label htmlFor={`question-${selectedQuestion}-option-${index}`}>
                      {option}
                      {option === quizData.questions[selectedQuestion - 1].answer && ' ✓'}
                      {option === quizData.questions[selectedQuestion - 1].userAnswer &&
                        option !== quizData.questions[selectedQuestion - 1].answer &&
                        ' ✗'}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Tutor Chat */}
      <div className="flex w-80 flex-col bg-white p-4 shadow-md">
        <div className="mb-4 flex-grow rounded-lg bg-blue-100 p-4">
          <h3 className="mb-2 text-lg font-bold text-blue-600">Hi there! 👋 I'm your AI English tutor.</h3>
          <p className="text-sm text-muted-foreground">
            Congratulations on completing the quiz! Would you like to review any specific questions or discuss your
            results?
          </p>
        </div>
        <form onSubmit={handleChatSubmit} className="mt-auto">
          <div className="relative">
            <Input
              className="w-full rounded-full pr-10"
              placeholder="Ask a question here"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
            />
            <Button type="submit" size="sm" className="absolute right-1 top-1 h-7 w-7 rounded-full p-0">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}