import { NextRequest, NextResponse } from 'next/server'
import { DatabaseManager } from '@/lib/database/database-manager'
import { JWTManager } from '@/lib/middleware/auth-middleware'

interface QuizResult {
  id: string
  score: number
  correct_answers: number
  total_questions: number
  completed_at: string
}

interface QuizAnswer {
  id: string
  quiz_result_id: string
  question_text: string
  selected_answer: string
  correct_answer: string
  is_correct: boolean
}

interface DetailedQuizResult extends QuizResult {
  answers: QuizAnswer[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Verify authentication and admin role
    let token = request.cookies.get('auth-token')?.value
    
    // If no cookie token, check Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = params.userId
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Initialize database manager
    const dbManager = DatabaseManager.getInstance()
    await dbManager.initializeIfNeeded()
    const adapter = dbManager.getAdapter()

    // Get all quiz results for the user
    console.log('[QUIZ-DETAILS API] Fetching quiz results for userId:', userId);
    const quizResults = await adapter.getQuizResultsByUserId(userId) as QuizResult[]
    console.log('[QUIZ-DETAILS API] Found quiz results:', quizResults.length);
    console.log('[QUIZ-DETAILS API] Quiz results data:', JSON.stringify(quizResults, null, 2));

    // Get detailed answers for each quiz result
    const detailedResults: DetailedQuizResult[] = []

    for (const result of quizResults) {
      console.log('[QUIZ-DETAILS API] Fetching answers for quiz result:', result.id);
      const answers = await adapter.getQuizAnswersByResultId(result.id) as QuizAnswer[]
      console.log('[QUIZ-DETAILS API] Found answers:', answers.length);

      detailedResults.push({
        ...result,
        answers
      })
    }

    // Get user info
    console.log('[QUIZ-DETAILS API] Fetching user info for userId:', userId);
    const userInfo = await adapter.getUserById(userId)
    console.log('[QUIZ-DETAILS API] User info:', userInfo ? 'found' : 'not found');

    return NextResponse.json({
      user: userInfo ? {
        username: userInfo.username,
        full_name: userInfo.full_name,
        email: userInfo.email
      } : null,
      quizResults: detailedResults
    })

  } catch (error) {
    console.error('Error fetching quiz details:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}