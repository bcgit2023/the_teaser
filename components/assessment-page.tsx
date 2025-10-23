'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { MessageCircle, ChevronUp, ChevronDown } from "lucide-react"

interface Question {
  number: number
  correct: boolean
  question: string
  options: string[]
  answer: string
  userAnswer: string
}

export default function AssessmentPage() {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState(true)

  const questions: Question[] = [
    {
      number: 1,
      correct: true,
      question: "What does 'enormous' mean?",
      options: ["Very small", "Very big", "Very fast", "Very slow"],
      answer: "Very big",
      userAnswer: "Very big"
    },
    {
      number: 2,
      correct: true,
      question: "Which is the correct spelling?",
      options: ["Necesary", "Neccessary", "Necessary", "Neccesary"],
      answer: "Necessary",
      userAnswer: "Necessary"
    },
    {
      number: 3,
      correct: true,
      question: "What is the past tense of 'go'?",
      options: ["Goed", "Gone", "Went", "Going"],
      answer: "Went",
      userAnswer: "Went"
    },
    {
      number: 4,
      correct: false,
      question: "What is the opposite of 'brave'?",
      options: ["Scared", "Cowardly", "Timid", "Fearful"],
      answer: "Cowardly",
      userAnswer: "Scared"
    },
    {
      number: 5,
      correct: true,
      question: "Which word is an adverb?",
      options: ["Quick", "Quickly", "Quickness", "Quicken"],
      answer: "Quickly",
      userAnswer: "Quickly"
    },
    {
      number: 6,
      correct: false,
      question: "What is the plural of 'child'?",
      options: ["Childs", "Children", "Childrens", "Childres"],
      answer: "Children",
      userAnswer: "Childs"
    },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-64 bg-white p-4 shadow-md">
        <Button variant="ghost" className="mb-4 w-full justify-start">
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </Button>
        <h2 className="mb-4 text-xl font-bold text-blue-600">English Assessment</h2>
        <p className="mb-4 text-sm text-gray-600">6 / 6 questions completed</p>
        {questions.map((q) => (
          <Button
            key={q.number}
            className={`mb-2 w-full justify-start ${
              q.correct ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
            onClick={() => {
              setSelectedQuestion(q)
              setSummaryExpanded(false)
            }}
          >
            Question {q.number}
          </Button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <Card className="mb-4 p-6">
          <div className="mb-6">
            <div className="mb-2 flex justify-between">
              <span>Overall Score</span>
              <span className="font-bold">67%</span>
            </div>
            <Progress value={67} className="h-2 w-full" />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Assessment Details</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="p-1"
            >
              {summaryExpanded ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
            </Button>
          </div>
          {summaryExpanded && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold">Assessment Summary</h3>
                <p className="text-gray-600">
                  You've completed the Grammar practice session. Your performance shows a good understanding of basic
                  concepts, but there's room for improvement in some areas. Keep practicing to enhance your skills!
                </p>
              </div>
              <div>
                <h3 className="font-semibold">Action Tasks</h3>
                <ul className="list-inside list-disc text-gray-600">
                  <li>Review the questions you got wrong and try to understand why.</li>
                  <li>Practice more on plural forms and antonyms.</li>
                  <li>Consider moving on to the next topic: "Advanced Grammar Structures".</li>
                </ul>
              </div>
            </div>
          )}
        </Card>
        {selectedQuestion && (
          <Card className="p-6">
            <h2 className="mb-2 text-xl font-bold">Question {selectedQuestion.number}</h2>
            <p className="mb-4">{selectedQuestion.question}</p>
            <div className="space-y-2">
              {selectedQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`rounded-md p-2 ${
                    option === selectedQuestion.answer
                      ? 'bg-green-100 text-green-700'
                      : option === selectedQuestion.userAnswer && option !== selectedQuestion.answer
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100'
                  }`}
                >
                  {option}
                  {option === selectedQuestion.answer && ' ✓'}
                  {option === selectedQuestion.userAnswer && option !== selectedQuestion.answer && ' ✗'}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* AI Tutor Chat */}
      <div className="flex w-80 flex-col bg-white p-4 shadow-md">
        <h2 className="text-xl font-bold mb-4 text-[#0066CC]">AI Tutor</h2>
        <div className="bg-gray-100 rounded-lg p-4 mb-4">
          <p className="font-bold mb-2">Hi! I'm your AI tutor.</p>
          <p>How can I help you with your studies today?</p>
          <p className="text-sm mt-2">{new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        </div>
        <div className="mt-auto">
          <div className="relative">
            <input
              className="w-full rounded-full border border-gray-300 py-2 pl-4 pr-10"
              placeholder="Ask a question here"
              type="text"
            />
            <MessageCircle className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  )
}