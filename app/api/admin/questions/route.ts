import { NextRequest, NextResponse } from 'next/server'
import { supabaseQuizService } from '@/lib/services/supabase-quiz-service'
import { JWTManager } from '@/lib/middleware/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    let questions
    if (type && type !== 'all') {
      questions = await supabaseQuizService.getQuestionsByType(type)
    } else {
      questions = await supabaseQuizService.getAllQuestions()
    }

    // Implement pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedQuestions = questions.slice(startIndex, endIndex)

    // Get stats
    const stats = await supabaseQuizService.getQuestionStats()

    return NextResponse.json({
      questions: paginatedQuestions,
      pagination: {
        page,
        limit,
        total: questions.length,
        totalPages: Math.ceil(questions.length / limit)
      },
      stats
    })
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 })
    }

    await supabaseQuizService.updateQuestion(id, updates)
    const success = true
    
    if (success) {
      return NextResponse.json({ message: 'Question updated successfully' })
    } else {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error updating question:', error)
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 })
    }

    await supabaseQuizService.deleteQuestion(id)
    const success = true
    
    if (success) {
      return NextResponse.json({ message: 'Question deleted successfully' })
    } else {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error deleting question:', error)
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = JWTManager.verifyAccessToken(token)
    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.question_text || !body.correct_word) {
      return NextResponse.json(
        { error: 'Question text and correct word are required' },
        { status: 400 }
      )
    }

    const question = await supabaseQuizService.createQuestion(body)
    const questionId = question.id
    
    return NextResponse.json({
      message: 'Question created successfully',
      id: questionId
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating question:', error)
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    )
  }
}