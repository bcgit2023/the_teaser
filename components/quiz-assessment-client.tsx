'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Clock, ArrowLeft } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

import classNames from 'classnames'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ChatContent from "@/app/chat/ChatContent"
import HeygenEmbed from "@/app/components/HeygenEmbed"

interface QuizQuestion {
  number: number;
  question: string;
  userAnswer: string;
  answer: string;
  type: string;
  category: string;
  correct: boolean;
  timeTaken: number;
  options?: string[];
  correctAnswer: string;
}

interface QuizData {
  id: string;
  score: number;
  totalTime: number;
  passingScore: number;
  averageScore: number;
  totalQuestions: number;
  questions: QuizQuestion[];
  improvementRate: number;
}

interface QuizAssessmentClientProps {
  id?: string;
}

export default function QuizAssessmentClient({ id = "latest" }: QuizAssessmentClientProps) {
  const [quizData, setQuizData] = useState<QuizData | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(false)

  const router = useRouter()

  const formatTime = (totalSeconds: number) => {
    if (!totalSeconds || isNaN(totalSeconds)) return '0:00'
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const fetchQuizData = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/quiz/assessment/${id}`)
        const data = await response.json()
        
        if (response.ok) {
          console.log('Quiz Data:', data)
          console.log('Questions:', data.questions)
          console.log('Categories:', data.questions.map((q: QuizQuestion) => q.type))
          setQuizData(data)
        } else {
          setError(data.error || 'Failed to fetch quiz data')
        }
      } catch (error) {
        setError('An error occurred while fetching quiz data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuizData()
  }, [id])

  const handleFinish = () => {
    router.push('/tutorial')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066CC] mx-auto mb-4" />
          <p className="text-gray-500">Loading quiz data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500 text-center">
          <p>{error}</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!quizData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p>No quiz data available.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#E6F3FF]">
      <HeygenEmbed />
      <aside className="w-64 bg-gradient-to-b from-[#0066CC] to-[#004C99] p-6 text-white flex flex-col">
        <Button 
          variant="outline" 
          className="mb-4 w-full bg-white text-[#0066CC] hover:bg-gray-100 hover:text-[#0066CC]" 
          onClick={handleFinish}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Profile
        </Button>
        <h2 className="mb-4 text-xl font-bold text-white">Quiz Results for ID: {quizData.id}</h2>
        <p className="mb-4 text-sm text-white opacity-90">{quizData.questions.length} / {quizData.questions.length} questions completed</p>

        {/* Question List */}
        {quizData.questions.map((q: QuizQuestion, index: number) => (
          <Button
            key={index}
            variant="ghost"
            className={classNames(
              "mb-2 w-full justify-start text-white hover:bg-[#0077EE] hover:text-white",
              selectedQuestion === index + 1 && 'bg-[#0077EE]'
            )}
            onClick={() => {
              setSelectedQuestion(index + 1)
            }}
          >
            <div className="flex w-full items-center justify-between">
              <span>Question {index + 1}</span>
              <span className={classNames(
                "text-sm",
                q.correct ? "text-green-300" : "text-red-300"
              )}>
                {q.correct ? "✓" : "✗"}
              </span>
            </div>
          </Button>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* Results Overview Card */}
        <Card className="mb-6">
          <CardHeader className="border-b pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-primary">Your Quiz Results</CardTitle>
              </div>
              <Badge 
                className={classNames(
                  "text-lg px-4 py-1",
                  (quizData.questions.filter((q: QuizQuestion) => q.correct).length / quizData.totalQuestions) >= 0.5 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}
                variant="outline"
                data-quiz-score={Math.round((quizData.questions.filter((q: QuizQuestion) => q.correct).length / quizData.totalQuestions) * 100)}
                data-total-questions={quizData.totalQuestions}
              >
                {(quizData.questions.filter((q: QuizQuestion) => q.correct).length / quizData.totalQuestions) >= 0.5 ? "PASSED" : "FAILED"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Score Display */}
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-muted-foreground">Overall Score</h3>
                  <div className="mt-2 flex items-center justify-center">
                    <div className="relative h-32 w-32">
                      <svg className="h-32 w-32 transform -rotate-90">
                        <circle
                          className="text-gray-200"
                          strokeWidth="12"
                          stroke="currentColor"
                          fill="transparent"
                          r="58"
                          cx="64"
                          cy="64"
                        />
                        <circle
                          className={classNames(
                            "transition-all",
                            quizData.questions.filter(q => q.correct).length >= 4 ? "text-green-500" : "text-red-500"
                          )}
                          strokeWidth="12"
                          strokeDasharray={364}
                          strokeDashoffset={364 - ((quizData.questions.filter(q => q.correct).length / quizData.totalQuestions) * 364)}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="58"
                          cx="64"
                          cy="64"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl font-bold">
                          {Math.round((quizData.questions.filter(q => q.correct).length / quizData.totalQuestions) * 100)}%
                        </span>
                      </div>
                      {/* Hidden div for quiz data */}
                      <div className="hidden">
                        {quizData.questions.map((q, index) => (
                          <div key={index}
                            data-question={q.question}
                            data-user-answer={q.userAnswer}
                            data-correct-answer={q.answer}
                            data-type={q.type}
                            data-correct={q.correct}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Correct Answers</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {quizData.questions.filter(q => q.correct).length}/{quizData.totalQuestions}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Time</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {formatTime(quizData.totalTime)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Improvement Rate</p>
                    <p className={`mt-1 text-2xl font-bold ${
                      quizData.improvementRate > 0 ? 'text-green-600' : 
                      quizData.improvementRate < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {quizData.improvementRate > 0 ? '+' : ''}{quizData.improvementRate}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Average Time</p>
                    <p className="mt-1 text-2xl font-bold text-primary">
                      {(() => {
                        const totalTimeTaken = quizData.questions.reduce((acc: number, q: QuizQuestion) => acc + q.timeTaken, 0);
                        console.log('Total time taken:', totalTimeTaken);
                        console.log('Number of questions:', quizData.totalQuestions);
                        const averageTime = Math.floor(totalTimeTaken / quizData.totalQuestions);
                        console.log('Average time:', averageTime);
                        return formatTime(averageTime);
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Analysis */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-muted-foreground">Performance Breakdown</h3>
                <div className="space-y-2">
                  {quizData.questions.map((q, index) => (
                    <div
                      key={index}
                      className={classNames(
                        "flex items-center justify-between rounded-md p-2",
                        q.correct ? "bg-green-50" : "bg-red-50"
                      )}
                    >
                      <span className="text-sm">Question {index + 1}</span>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm">{formatTime(q.timeTaken)}</span>
                        <span className={q.correct ? "text-green-500" : "text-red-500"}>
                          {q.correct ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Assessment Card */}
        <Card className="mb-6">
          <CardHeader 
            className="border-b pb-6 cursor-pointer"
            onClick={() => setIsPerformanceExpanded(!isPerformanceExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-primary">Performance Assessment</CardTitle>
                <CardDescription className="mt-1 text-base">
                  View detailed analysis by category
                </CardDescription>
              </div>
              {isPerformanceExpanded ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
            </div>
          </CardHeader>
          {isPerformanceExpanded && (
            <CardContent className="pt-6">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="mt-4">
                  <div className="space-y-6">
                    {/* Overall Performance Card */}
                    <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">
                      <h3 className="font-semibold text-primary mb-4 text-lg">Overall Performance</h3>
                      
                      {/* Dynamic Categories Analysis */}
                      {(() => {
                        // Get unique categories
                        const categories = Array.from(new Set(quizData.questions.map(q => q.category)));
                        
                        // Calculate scores for each category
                        const categoryScores = categories.map(category => {
                          const questionsInCategory = quizData.questions.filter(q => q.category === category);
                          const correctAnswers = questionsInCategory.filter(q => q.correct).length;
                          return {
                            category,
                            score: (correctAnswers / questionsInCategory.length) * 100,
                            total: questionsInCategory.length
                          };
                        });

                        // Find strongest and weakest areas
                        const strongestCategory = categoryScores.reduce((prev, current) => 
                          (current.score > prev.score) ? current : prev
                        );

                        const areasForImprovement = categoryScores
                          .filter(cat => cat.score < 70)
                          .sort((a, b) => a.score - b.score);

                        return (
                          <div className="space-y-6">
                            {/* Strongest Area */}
                            <div className="rounded-lg bg-green-50 p-4 border border-green-100">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                <h4 className="font-medium text-green-700">Strongest Area</h4>
                              </div>
                              <div className="pl-4">
                                <p className="text-green-800">
                                  <span className="font-semibold">{strongestCategory.category}</span>
                                  <span className="text-sm ml-2">
                                    ({Math.round(strongestCategory.score)}% accuracy)
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Areas for Improvement */}
                            <div className="rounded-lg bg-amber-50 p-4 border border-amber-100">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                                <h4 className="font-medium text-amber-700">Areas for Improvement</h4>
                              </div>
                              <div className="pl-4">
                                {areasForImprovement.length > 0 ? (
                                  <ul className="space-y-2">
                                    {areasForImprovement.map(area => (
                                      <li key={area.category} className="text-amber-800">
                                        <span className="font-semibold">{area.category}</span>
                                        <span className="text-sm ml-2">
                                          ({Math.round(area.score)}% accuracy)
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-amber-800">None - Great job!</p>
                                )}
                              </div>
                            </div>

                            {/* Time Analysis */}
                            <div className="rounded-lg bg-blue-50 p-4 border border-blue-100">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                <h4 className="font-medium text-blue-700">Time Management</h4>
                              </div>
                              <div className="pl-4">
                                {(() => {
                                  const avgTimePerQuestion = quizData.questions.reduce((acc: number, q: QuizQuestion) => acc + q.timeTaken, 0) / quizData.questions.length;
                                  let timeStatus;
                                  let timeColor;
                                  
                                  if (avgTimePerQuestion < 30) {
                                    timeStatus = "Quick and efficient";
                                    timeColor = "text-green-700";
                                  } else if (avgTimePerQuestion < 60) {
                                    timeStatus = "Well-paced";
                                    timeColor = "text-blue-700";
                                  } else {
                                    timeStatus = "Consider working on speed";
                                    timeColor = "text-amber-700";
                                  }

                                  return (
                                    <p className={timeColor}>
                                      {timeStatus} - Avg. {formatTime(Math.floor(avgTimePerQuestion))} per question
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Recommendations */}
                            <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-100">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                                <h4 className="font-medium text-indigo-700">Recommendations</h4>
                              </div>
                              <div className="pl-4">
                                <ul className="list-disc list-inside space-y-2">
                                  {categoryScores.map(cat => {
                                    if (cat.score < 70) {
                                      return (
                                        <li key={cat.category} className="text-indigo-800 text-sm">
                                          Focus on improving {cat.category.toLowerCase()} - try additional practice exercises
                                        </li>
                                      );
                                    }
                                    return null;
                                  }).filter(Boolean)}
                                  {!categoryScores.some(cat => cat.score < 70) && (
                                    <li className="text-indigo-800 text-sm">
                                      Continue with more advanced material to maintain your high performance
                                    </li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="detailed" className="mt-4">
                  <div className="space-y-6">
                    {/* Incorrect Answers Review */}
                    <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
                      <h3 className="font-semibold text-primary mb-4 text-lg">Detailed Review</h3>
                      
                      {quizData.questions.filter(q => !q.correct).length === 0 ? (
                        <div className="text-center p-6 bg-green-50 rounded-lg">
                          <p className="text-green-600 font-semibold">Perfect score! No incorrect answers to review.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {quizData.questions.filter(q => !q.correct).map((q, index) => (
                            <div key={index} className="p-4 border rounded-lg bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-gray-700">Question {q.number}</span>
                                <Badge variant="outline" className="bg-red-50 text-red-600">
                                  Incorrect
                                </Badge>
                              </div>
                              <p className="mb-3 text-gray-800">{q.question}</p>
                              <div className="space-y-2">
                                <div className="flex items-center text-red-600">
                                  <span className="font-medium mr-2">Your answer:</span>
                                  <span>{q.userAnswer}</span>
                                </div>
                                <div className="flex items-center text-green-600">
                                  <span className="font-medium mr-2">Correct answer:</span>
                                  <span>{q.correctAnswer}</span>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t">
                                <div className="flex items-center text-gray-600">
                                  <Clock className="h-4 w-4 mr-2" />
                                  <span className="text-sm">Time taken: {formatTime(q.timeTaken)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dynamic Category Sections */}
                    {(() => {
                      // Get unique categories
                      const categories = Array.from(new Set(quizData.questions.map(q => q.category)));
                      
                      return categories.map(category => {
                        const questionsInCategory = quizData.questions.filter(q => q.category === category);
                        const correctAnswers = questionsInCategory.filter(q => q.correct).length;
                        const accuracy = (correctAnswers / questionsInCategory.length) * 100;
                        
                        return (
                          <div key={category} className="rounded-lg border p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-primary">{category}</h3>
                              <Badge variant="outline" className={
                                accuracy >= 50
                                ? "bg-green-500 text-white hover:bg-green-600" 
                                : "bg-red-500 text-white hover:bg-red-600"
                              }>
                                {correctAnswers}/{questionsInCategory.length}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {accuracy >= 50
                                ? `Strong understanding of ${category.toLowerCase()} (${Math.round(accuracy)}% accuracy).`
                                : `Need more practice with ${category.toLowerCase()} (${Math.round(accuracy)}% accuracy).`}
                            </p>
                            
                            {/* Questions in this category */}
                            <div className="mt-3 space-y-2">
                              {questionsInCategory.map((q, idx) => (
                                <div key={idx} 
                                  className={`text-sm p-2 rounded-md ${
                                    q.correct ? 'bg-green-50' : 'bg-red-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className={q.correct ? 'text-green-700' : 'text-red-700'}>
                                      Question {q.number}
                                    </span>
                                    <span className="text-gray-600">
                                      {formatTime(q.timeTaken)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          )}
        </Card>

        {/* Question Display */}
        {selectedQuestion !== null && quizData.questions[selectedQuestion - 1] && (
          <Card>
            <CardHeader>
              <CardTitle>Question {selectedQuestion}</CardTitle>
              <CardDescription>
                Time taken: {formatTime(quizData.questions[selectedQuestion - 1]?.timeTaken || 0)}
                <span className={classNames(
                  "ml-2 inline-block",
                  quizData.questions[selectedQuestion - 1]?.correct ? "text-green-500" : "text-red-500"
                )}>
                  {quizData.questions[selectedQuestion - 1]?.correct ? "Correct ✓" : "Incorrect ✗"}
                </span>
                <span className="ml-2 inline-block text-sm text-muted-foreground">
                  Category: {quizData.questions[selectedQuestion - 1]?.category}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{quizData.questions[selectedQuestion - 1]?.question}</p>
              <RadioGroup 
                value={quizData.questions[selectedQuestion - 1]?.answer}
                className="space-y-4"
              >
                {quizData.questions[selectedQuestion - 1]?.options?.map((option: string, index: number) => {
                  const isUserAnswer = option === quizData.questions[selectedQuestion - 1]?.answer;
                  const isCorrectAnswer = option === quizData.questions[selectedQuestion - 1]?.correctAnswer;
                  
                  return (
                    <div key={index} className={classNames(
                      "flex items-center space-x-2 p-2 rounded",
                      isUserAnswer && !quizData.questions[selectedQuestion - 1]?.correct && "bg-red-100", // User's incorrect answer
                      isCorrectAnswer && "bg-green-100" // Correct answer
                    )}>
                      <RadioGroupItem
                        value={option}
                        id={`option-${selectedQuestion}-${index}`}
                        disabled
                      />
                      <Label htmlFor={`option-${selectedQuestion}-${index}`} className="flex-grow">
                        {option}
                        {isUserAnswer && (
                          <span className={classNames(
                            "ml-2",
                            quizData.questions[selectedQuestion - 1]?.correct ? "text-green-500" : "text-red-500"
                          )}>
                            (Your answer)
                          </span>
                        )}
                        {isCorrectAnswer && (
                          <span className="ml-2 text-green-500">(Correct answer)</span>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Right Sidebar - AI Tutor */}
      <aside className="w-96 bg-white p-6 shadow-lg flex flex-col">
        <h2 className="text-xl font-bold mb-4 text-[#0066CC]">AI Tutor</h2>
        <div className="flex-1 bg-[#E6F3FF] rounded-lg flex flex-col overflow-hidden">
          <ChatContent />
        </div>
      </aside>
    </div>
  )
}