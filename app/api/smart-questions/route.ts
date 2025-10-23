import { NextRequest, NextResponse } from 'next/server'
import { SupabaseSmartQuestionService } from '@/lib/services/supabase-smart-question-service'
import jwt from 'jsonwebtoken'

/**
 * Enhanced Smart Questions API Endpoint
 * Provides intelligent question selection based on user history and performance
 */

const smartQuestionService = new SupabaseSmartQuestionService();

export async function GET(request: NextRequest) {
  try {
    // Extract user ID from JWT token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key') as any;
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '5');
    const difficulty = searchParams.get('difficulty');
    const category = searchParams.get('category');

    // Get smart questions
    const questions = await smartQuestionService.getSmartQuestions(userId, count);

    // Filter by difficulty if specified
    let filteredQuestions = questions;
    if (difficulty) {
      const difficultyLevel = parseInt(difficulty);
      filteredQuestions = questions.filter(q => q.difficulty_level === difficultyLevel);
    }

    // Filter by category if specified
    if (category) {
      filteredQuestions = filteredQuestions.filter(q => q.category === category);
    }

    // Format questions for frontend
    const formattedQuestions = filteredQuestions.map(question => ({
      id: question.id,
      uuid: question.uuid,
      question_text: question.question_text,
      options: [
        question.option_1,
        question.option_2,
        question.option_3,
        question.option_4
      ].filter(opt => opt && opt.trim().length > 0),
      correct_option: question.correct_option,
      type: question.type,
      difficulty_level: question.difficulty_level,
      category: question.category
    }));

    // Record question presentations to prevent immediate repetition
    if (formattedQuestions.length > 0) {
      const questionUuids = formattedQuestions.map(q => q.uuid);
      await smartQuestionService.recordQuestionPresentation(userId, questionUuids);
    }

    return NextResponse.json({
      success: true,
      questions: formattedQuestions,
      metadata: {
        total_selected: formattedQuestions.length,
        user_id: userId,
        selection_method: 'smart_algorithm'
      }
    });

  } catch (error) {
    console.error('Error in smart questions API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch smart questions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extract user ID from JWT token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key') as any;
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { 
      question_uuid, 
      user_answer, 
      correct_answer, 
      is_correct, 
      response_time_ms 
    } = body;

    // Validate required fields
    if (!question_uuid || user_answer === undefined || correct_answer === undefined || is_correct === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: question_uuid, user_answer, correct_answer, is_correct' },
        { status: 400 }
      );
    }

    // Record the answer
    await smartQuestionService.recordAnswer(
      userId,
      question_uuid,
      user_answer,
      correct_answer,
      is_correct,
      response_time_ms
    );

    return NextResponse.json({
      success: true,
      message: 'Answer recorded successfully'
    });

  } catch (error) {
    console.error('Error recording answer:', error);
    return NextResponse.json(
      { error: 'Failed to record answer' },
      { status: 500 }
    );
  }
}