import { createClient } from '@supabase/supabase-js'

/**
 * Supabase-based Smart Question Service
 * Provides intelligent question selection using Supabase database
 */

export interface Question {
  id: string;
  uuid: string;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  type: string;
  difficulty_level: number;
  category?: string;
}

export interface QuestionHistory {
  id: string;
  user_id: string;
  question_uuid: string;
  question_text: string;
  user_answer?: string;
  correct_answer?: string;
  is_correct: boolean;
  response_time_ms?: number;
  difficulty_level?: number;
  category?: string;
  presented_at: string;
  last_seen: string;
  times_seen: number;
  times_correct: number;
  times_incorrect: number;
  priority_score: number;
  mastery_level: number;
}

export interface SmartQuestionConfig {
  maxQuestionsPerSession: number;
  priorityWeights: {
    recency: number;
    difficulty: number;
    performance: number;
    mastery: number;
    variety: number;
  };
  masteryThreshold: number;
  minTimeBetweenRepeats: number;
}

export class SupabaseSmartQuestionService {
  private supabase;
  
  // Default configuration
  private config: SmartQuestionConfig = {
    maxQuestionsPerSession: 5,
    priorityWeights: {
      recency: 0.3,
      difficulty: 0.25,
      performance: 0.25,
      mastery: 0.15,
      variety: 0.05
    },
    masteryThreshold: 0.8,
    minTimeBetweenRepeats: 1 // 1 hour
  };

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Get smart question selection for a user
   */
  async getSmartQuestions(_userId: string, requestedCount: number = 5): Promise<Question[]> {
    try {
      // Get all available questions
      const { data: allQuestions, error: questionsError } = await this.supabase
        .from('questions')
        .select('*')
        .not('uuid', 'is', null);

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        throw new Error('Failed to fetch questions from database');
      }

      if (!allQuestions || allQuestions.length === 0) {
        throw new Error('No questions available in the database');
      }

      // For now, return a simple random selection
      // TODO: Implement smart selection based on user history
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(requestedCount, this.config.maxQuestionsPerSession));

      return selected.map(q => ({
        id: q.id,
        uuid: q.uuid || q.id,
        question_text: q.question_text,
        option_1: q.option_1,
        option_2: q.option_2,
        option_3: q.option_3,
        option_4: q.option_4,
        correct_option: q.correct_option,
        type: q.type || 'multiple_choice',
        difficulty_level: q.difficulty_level || 2,
        category: q.new_category_id || 'general'
      }));

    } catch (error) {
      console.error('Error in getSmartQuestions:', error);
      throw error;
    }
  }

  /**
   * Record question presentation to prevent immediate repetition
   */
  async recordQuestionPresentation(userId: string, questionUuids: string[]): Promise<void> {
    try {
      // For now, just log the presentation
      // TODO: Implement actual recording when user_question_history table is available
      console.log(`Recording question presentation for user ${userId}:`, questionUuids);
    } catch (error) {
      console.error('Error recording question presentation:', error);
      // Don't throw error - this is not critical for functionality
    }
  }

  /**
   * Record user answer for learning analytics
   */
  async recordAnswer(
    userId: string,
    questionUuid: string,
    userAnswer: string,
    correctAnswer: string,
    isCorrect: boolean,
    responseTimeMs?: number
  ): Promise<void> {
    try {
      // For now, just log the answer
      // TODO: Implement actual recording when user_question_history table is available
      console.log(`Recording answer for user ${userId}, question ${questionUuid}:`, {
        userAnswer,
        correctAnswer,
        isCorrect,
        responseTimeMs
      });
    } catch (error) {
      console.error('Error recording answer:', error);
      // Don't throw error - this is not critical for functionality
    }
  }

  /**
   * Fallback to random questions if smart selection fails
   */
  async getFallbackQuestions(count: number): Promise<Question[]> {
    try {
      const { data: questions, error } = await this.supabase
        .from('questions')
        .select('*')
        .limit(count);

      if (error) {
        console.error('Error fetching fallback questions:', error);
        return [];
      }

      return questions?.map(q => ({
        id: q.id,
        uuid: q.uuid || q.id,
        question_text: q.question_text,
        option_1: q.option_1,
        option_2: q.option_2,
        option_3: q.option_3,
        option_4: q.option_4,
        correct_option: q.correct_option,
        type: q.type || 'multiple_choice',
        difficulty_level: q.difficulty_level || 2,
        category: q.new_category_id || 'general'
      })) || [];
    } catch (error) {
      console.error('Error in getFallbackQuestions:', error);
      return [];
    }
  }

  /**
   * Get user analytics and performance data
   */
  async getUserAnalytics(userId: string | number): Promise<any> {
    try {
      const userIdStr = userId.toString();
      
      // Get quiz results for the user
      const { data: quizResults, error: quizError } = await this.supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', userIdStr);

      if (quizError) {
        console.error('Error fetching quiz results:', quizError);
        return this.getDefaultAnalytics();
      }

      const results = quizResults || [];
      
      if (results.length === 0) {
        return this.getDefaultAnalytics();
      }

      // Calculate basic statistics
      const totalQuestions = results.reduce((sum, result) => sum + (result.total_questions || 0), 0);
      const totalCorrect = results.reduce((sum, result) => sum + (result.correct_answers || 0), 0);
      const totalAttempts = totalQuestions; // Each question is an attempt
      const accuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

      // For now, return basic analytics
      // TODO: Implement more sophisticated analytics when user_question_history table is available
      return {
        total_questions_attempted: totalQuestions,
        total_correct: totalCorrect,
        total_attempts: totalAttempts,
        accuracy: accuracy,
        avg_mastery: accuracy, // Use accuracy as a proxy for mastery
        avg_response_time: 0, // Not available yet
        mastered_questions: Math.floor(totalCorrect * 0.8), // Estimate
        categoryBreakdown: [] // Not available yet
      };
    } catch (error) {
      console.error('Error in getUserAnalytics:', error);
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Get default analytics when no data is available
   */
  private getDefaultAnalytics(): any {
    return {
      total_questions_attempted: 0,
      total_correct: 0,
      total_attempts: 0,
      accuracy: 0,
      avg_mastery: 0,
      avg_response_time: 0,
      mastered_questions: 0,
      categoryBreakdown: []
    };
  }
}