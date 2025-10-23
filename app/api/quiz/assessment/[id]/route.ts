import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const quizResultId = parseInt(params.id)
    
    if (isNaN(quizResultId)) {
      return NextResponse.json({ error: 'Invalid quiz result ID' }, { status: 400 })
    }

    const db = await getDb()
    
    // Get quiz result data
    const quizResult = await db.get(`
      SELECT * FROM quiz_results 
      WHERE id = ?
    `, [quizResultId])

    if (!quizResult) {
      return NextResponse.json({ error: 'Quiz result not found' }, { status: 404 })
    }

    // Calculate score percentage
    const scorePercentage = Math.round((quizResult.correct_answers / quizResult.total_questions) * 100)

    // Mock question details for now (since we don't have detailed question tracking yet)
    const questions = []
    for (let i = 1; i <= quizResult.total_questions; i++) {
      questions.push({
        number: i,
        correct: i <= quizResult.correct_answers, // First 'correct_answers' questions are correct
        question: `Question ${i}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        answer: 'Option A',
        userAnswer: i <= quizResult.correct_answers ? 'Option A' : 'Option B'
      })
    }

    const assessmentData = {
      id: quizResult.id,
      score: scorePercentage,
      totalQuestions: quizResult.total_questions,
      correctAnswers: quizResult.correct_answers,
      timeTaken: '2:30', // Mock time since we don't have total_time in schema
      passingScore: 70,
      questions: questions,
      completedAt: new Date(quizResult.completed_at).toLocaleDateString()
    }

    return NextResponse.json(assessmentData)
  } catch (error) {
    console.error('Error fetching quiz assessment:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error details:', errorMessage)
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}