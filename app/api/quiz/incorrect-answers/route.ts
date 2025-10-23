import { NextResponse } from 'next/server'
import { DatabaseManager } from '@/lib/database/database-manager'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, incorrectAnswers } = body

    const dbManager = DatabaseManager.getInstance()
    await dbManager.initializeIfNeeded()
    const adapter = dbManager.getAdapter()

    // Store each incorrect answer
    for (const answer of incorrectAnswers) {
      await adapter.createIncorrectAnswer({
        user_id: userId,
        question_id: answer.question.id,
        selected_answer: answer.selectedAnswer,
        correct_answer: answer.question.correct_word
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error storing incorrect answers:', error)
    return NextResponse.json(
      { error: 'Failed to store incorrect answers' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const dbManager = DatabaseManager.getInstance()
    await dbManager.initializeIfNeeded()
    const adapter = dbManager.getAdapter()

    const incorrectAnswers = await adapter.getIncorrectAnswersByUserId(userId, 50)

    return NextResponse.json(incorrectAnswers)
  } catch (error) {
    console.error('Error fetching incorrect answers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch incorrect answers' },
      { status: 500 }
    )
  }
}
