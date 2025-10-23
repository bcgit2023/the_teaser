import { NextRequest, NextResponse } from 'next/server'
import { SupabaseSmartQuestionService } from '@/lib/services/supabase-smart-question-service'
import jwt from 'jsonwebtoken'

/**
 * User Analytics API Endpoint
 * Provides detailed learning analytics and progress tracking
 */

const smartQuestionService = new SupabaseSmartQuestionService();

export async function GET(request: NextRequest) {
  try {
    // Extract user ID from JWT token
  const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let userId: number;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key') as any;
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get user analytics
    const analytics = await smartQuestionService.getUserAnalytics(userId);

    return NextResponse.json({
      success: true,
      analytics: {
        overview: {
          total_questions_attempted: analytics.total_questions_attempted || 0,
          total_correct: analytics.total_correct || 0,
          total_attempts: analytics.total_attempts || 0,
          accuracy: analytics.accuracy || 0,
          avg_mastery: analytics.avg_mastery || 0,
          avg_response_time: analytics.avg_response_time || 0,
          mastered_questions: analytics.mastered_questions || 0
        },
        category_breakdown: analytics.categoryBreakdown || [],
        performance_metrics: {
          accuracy_percentage: Math.round((analytics.accuracy || 0) * 100),
          mastery_percentage: Math.round((analytics.avg_mastery || 0) * 100),
          questions_mastered_percentage: analytics.total_questions_attempted > 0 
            ? Math.round((analytics.mastered_questions / analytics.total_questions_attempted) * 100)
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user analytics' },
      { status: 500 }
    );
  }
}