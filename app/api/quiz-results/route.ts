import { NextRequest, NextResponse } from 'next/server'
import { getDbAdapter } from '@/lib/database/database-manager'
import { JWTManager } from '@/lib/middleware/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie and verify authentication
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const dbAdapter = await getDbAdapter()
    const results = await dbAdapter.getQuizResultsByUserId(decoded.userId, 10)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching quiz results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quiz results' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie and verify authentication
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { score, correctAnswers, totalQuestions, answers } = await request.json()

    const dbAdapter = await getDbAdapter()

    // Create quiz result with the actual logged-in user's ID
    const quizResult = await dbAdapter.createQuizResult({
      user_id: decoded.userId,
      score,
      correct_answers: correctAnswers,
      total_questions: totalQuestions
    })

    // Insert detailed answers
    for (const answer of answers) {
      await dbAdapter.createQuizAnswer({
        quiz_result_id: quizResult.id,
        question_text: answer.questionText,
        selected_answer: answer.selectedAnswer,
        correct_answer: answer.correctAnswer,
        is_correct: answer.isCorrect
      })
    }

    return NextResponse.json({ success: true, quizResultId: quizResult.id })
  } catch (error) {
    console.error('Error saving quiz results:', error)
    return NextResponse.json(
      { error: 'Failed to save quiz results' },
      { status: 500 }
    )
  }
}
