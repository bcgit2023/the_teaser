import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'

/**
 * Smart Question Pool Management Service
 * Implements intelligent question selection with priority scoring and user-specific tracking
 */

export interface Question {
  id: number;
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
  id: number;
  user_id: number;
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
    recency: number;        // Weight for how recently question was seen
    difficulty: number;     // Weight for difficulty matching
    performance: number;    // Weight for past performance
    mastery: number;        // Weight for mastery level
    variety: number;        // Weight for question variety
  };
  masteryThreshold: number; // Threshold for considering a question mastered
  minTimeBetweenRepeats: number; // Minimum hours between showing same question
}

export class SmartQuestionService {
  private userDb: Database | null = null;
  private quizDb: Database | null = null;
  
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
    minTimeBetweenRepeats: 1 // 1 hour - prevent immediate repetition
  };

  async getUserDb(): Promise<Database> {
    if (!this.userDb) {
      this.userDb = await open({
        filename: './db/user.db',
        driver: sqlite3.Database
      });
    }
    return this.userDb;
  }

  async getQuizDb(): Promise<Database> {
    if (!this.quizDb) {
      this.quizDb = await open({
        filename: './db/quiz.db',
        driver: sqlite3.Database
      });
    }
    return this.quizDb;
  }

  /**
   * Get smart question selection for a user
   */
  async getSmartQuestions(userId: number, requestedCount: number = 5): Promise<Question[]> {
    const quizDb = await this.getQuizDb();
    const userDb = await this.getUserDb();

    try {
      // Get all available questions
      const allQuestions = await quizDb.all<Question[]>(`
        SELECT id, uuid, question_text, option_1, option_2, option_3, option_4, 
               correct_option, type, difficulty_level, 
               COALESCE(new_category_id, 'general') as category
        FROM questions 
        WHERE uuid IS NOT NULL
      `);

      if (allQuestions.length === 0) {
        throw new Error('No questions available in the database');
      }

      // Get user's question history
      const userHistory = await userDb.all<QuestionHistory[]>(`
        SELECT * FROM user_question_history 
        WHERE user_id = ?
      `, [userId]);

      // Calculate priority scores for each question
      const questionsWithPriority = await this.calculatePriorityScores(
        allQuestions, 
        userHistory, 
        userId
      );

      // Filter out recently seen questions (within minimum time)
      const availableQuestions = this.filterRecentQuestions(questionsWithPriority, userHistory);

      // Sort by priority score (descending)
      availableQuestions.sort((a, b) => b.priorityScore - a.priorityScore);

      // Select top questions with some randomization to avoid predictability
      const selectedQuestions = this.selectWithRandomization(
        availableQuestions, 
        Math.min(requestedCount, this.config.maxQuestionsPerSession)
      );

      return selectedQuestions.map(q => ({
        id: q.id,
        uuid: q.uuid,
        question_text: q.question_text,
        option_1: q.option_1,
        option_2: q.option_2,
        option_3: q.option_3,
        option_4: q.option_4,
        correct_option: q.correct_option,
        type: q.type,
        difficulty_level: q.difficulty_level,
        category: q.category
      }));

    } catch (error) {
      console.error('Error in getSmartQuestions:', error);
      // Fallback to random selection
      return this.getFallbackQuestions(requestedCount);
    }
  }

  /**
   * Calculate priority scores for questions based on multiple factors
   */
  private async calculatePriorityScores(
    questions: Question[], 
    userHistory: QuestionHistory[], 
    userId: number
  ): Promise<Array<Question & { priorityScore: number }>> {
    const historyMap = new Map<string, QuestionHistory>();
    userHistory.forEach(h => historyMap.set(h.question_uuid, h));

    const userDb = await this.getUserDb();
    
    // Get user's overall performance stats
    const userStats = await userDb.get(`
      SELECT 
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) as avg_accuracy,
        AVG(difficulty_level) as avg_difficulty,
        COUNT(*) as total_attempts
      FROM user_question_history 
      WHERE user_id = ?
    `, [userId]);

    const userAccuracy = userStats?.avg_accuracy || 0.5;
    const userAvgDifficulty = userStats?.avg_difficulty || 2;

    return questions.map(question => {
      const history = historyMap.get(question.uuid);
      
      // Calculate individual score components
      const recencyScore = this.calculateRecencyScore(history);
      const difficultyScore = this.calculateDifficultyScore(question, userAvgDifficulty, userAccuracy);
      const performanceScore = this.calculatePerformanceScore(history);
      const masteryScore = this.calculateMasteryScore(history);
      const varietyScore = this.calculateVarietyScore(question, userHistory);

      // Weighted final score
      const priorityScore = 
        (recencyScore * this.config.priorityWeights.recency) +
        (difficultyScore * this.config.priorityWeights.difficulty) +
        (performanceScore * this.config.priorityWeights.performance) +
        (masteryScore * this.config.priorityWeights.mastery) +
        (varietyScore * this.config.priorityWeights.variety);

      return {
        ...question,
        priorityScore: Math.max(0, Math.min(1, priorityScore)) // Normalize to 0-1
      };
    });
  }

  /**
   * Calculate recency score (higher for questions not seen recently)
   */
  private calculateRecencyScore(history: QuestionHistory | undefined): number {
    if (!history) return 1.0; // New questions get highest recency score

    const hoursSinceLastSeen = (Date.now() - new Date(history.last_seen).getTime()) / (1000 * 60 * 60);
    const maxHours = 168; // 1 week
    
    return Math.min(1.0, hoursSinceLastSeen / maxHours);
  }

  /**
   * Calculate difficulty score (prefer questions matching user's level)
   */
  private calculateDifficultyScore(question: Question, userAvgDifficulty: number, userAccuracy: number): number {
    const targetDifficulty = userAccuracy > 0.7 ? userAvgDifficulty + 0.5 : 
                           userAccuracy < 0.5 ? userAvgDifficulty - 0.5 : userAvgDifficulty;
    
    const difficultyDiff = Math.abs(question.difficulty_level - targetDifficulty);
    return Math.max(0, 1 - (difficultyDiff / 3)); // Normalize based on max difficulty difference
  }

  /**
   * Calculate performance score (higher for questions where user struggled)
   */
  private calculatePerformanceScore(history: QuestionHistory | undefined): number {
    if (!history) return 0.7; // Neutral score for new questions

    if (history.times_seen === 0) return 0.7;
    
    const accuracy = history.times_correct / history.times_seen;
    return 1 - accuracy; // Higher score for lower accuracy (need more practice)
  }

  /**
   * Calculate mastery score (lower for mastered questions)
   */
  private calculateMasteryScore(history: QuestionHistory | undefined): number {
    if (!history) return 0.8; // Neutral-high score for new questions

    return Math.max(0, 1 - history.mastery_level);
  }

  /**
   * Calculate variety score (prefer different categories/types)
   */
  private calculateVarietyScore(question: Question, userHistory: QuestionHistory[]): number {
    const recentHistory = userHistory
      .filter(h => (Date.now() - new Date(h.last_seen).getTime()) < (24 * 60 * 60 * 1000)) // Last 24 hours
      .slice(-10); // Last 10 questions

    const categoryCount = recentHistory.filter(h => h.category === question.category).length;
    const typeCount = recentHistory.filter(h => 
      userHistory.find(uh => uh.question_uuid === h.question_uuid)
    ).length;

    // Higher score for less frequently seen categories/types
    return Math.max(0, 1 - (categoryCount + typeCount) / 20);
  }

  /**
   * Filter out questions seen too recently
   */
  private filterRecentQuestions(
    questions: Array<Question & { priorityScore: number }>, 
    userHistory: QuestionHistory[]
  ): Array<Question & { priorityScore: number }> {
    const minTimeMs = this.config.minTimeBetweenRepeats * 60 * 60 * 1000;
    const now = Date.now();

    const recentQuestionUuids = new Set(
      userHistory
        .filter(h => (now - new Date(h.last_seen).getTime()) < minTimeMs)
        .map(h => h.question_uuid)
    );

    return questions.filter(q => !recentQuestionUuids.has(q.uuid));
  }

  /**
   * Select questions with some randomization to avoid predictability
   */
  private selectWithRandomization(
    questions: Array<Question & { priorityScore: number }>, 
    count: number
  ): Array<Question & { priorityScore: number }> {
    if (questions.length <= count) return questions;

    // Take top 70% deterministically, randomize the rest
    const deterministicCount = Math.ceil(count * 0.7);
    const randomCount = count - deterministicCount;

    const deterministic = questions.slice(0, deterministicCount);
    const randomPool = questions.slice(deterministicCount, deterministicCount + randomCount * 3);
    
    // Weighted random selection from the pool
    const random = [];
    for (let i = 0; i < randomCount && randomPool.length > 0; i++) {
      const weights = randomPool.map(q => q.priorityScore);
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      
      let randomValue = Math.random() * totalWeight;
      let selectedIndex = 0;
      
      for (let j = 0; j < weights.length; j++) {
        randomValue -= weights[j];
        if (randomValue <= 0) {
          selectedIndex = j;
          break;
        }
      }
      
      random.push(randomPool[selectedIndex]);
      randomPool.splice(selectedIndex, 1);
    }

    return [...deterministic, ...random];
  }

  /**
   * Fallback to random questions if smart selection fails
   */
  private async getFallbackQuestions(count: number): Promise<Question[]> {
    const quizDb = await this.getQuizDb();
    
    return await quizDb.all<Question[]>(`
      SELECT id, uuid, question_text, option_1, option_2, option_3, option_4, 
             correct_option, type, difficulty_level,
             COALESCE(new_category_id, 'general') as category
      FROM questions 
      WHERE uuid IS NOT NULL
      ORDER BY RANDOM() 
      LIMIT ?
    `, [count]);
  }

  /**
   * Record user's answer and update history
   */
  async recordAnswer(
    userId: number, 
    questionUuid: string, 
    userAnswer: string, 
    correctAnswer: string, 
    isCorrect: boolean,
    responseTimeMs?: number
  ): Promise<void> {
    const userDb = await this.getUserDb();
    const quizDb = await this.getQuizDb();

    try {
      // Get question details
      const question = await quizDb.get<Question>(`
        SELECT * FROM questions WHERE uuid = ?
      `, [questionUuid]);

      if (!question) {
        throw new Error(`Question not found: ${questionUuid}`);
      }

      // Check if history record exists
      const existingHistory = await userDb.get<QuestionHistory>(`
        SELECT * FROM user_question_history 
        WHERE user_id = ? AND question_uuid = ?
      `, [userId, questionUuid]);

      const now = new Date().toISOString();

      if (existingHistory) {
        // Update existing record
        const newTimesCorrect = existingHistory.times_correct + (isCorrect ? 1 : 0);
        const newTimesIncorrect = existingHistory.times_incorrect + (isCorrect ? 0 : 1);
        const newTimesSeen = existingHistory.times_seen + 1;
        const newMasteryLevel = this.calculateMasteryLevel(newTimesCorrect, newTimesSeen);
        const newPriorityScore = this.calculateUpdatedPriorityScore(existingHistory, isCorrect);

        await userDb.run(`
          UPDATE user_question_history 
          SET 
            user_answer = ?,
            correct_answer = ?,
            is_correct = ?,
            response_time_ms = ?,
            last_seen = ?,
            times_seen = ?,
            times_correct = ?,
            times_incorrect = ?,
            mastery_level = ?,
            priority_score = ?
          WHERE user_id = ? AND question_uuid = ?
        `, [
          userAnswer, correctAnswer, isCorrect, responseTimeMs, now,
          newTimesSeen, newTimesCorrect, newTimesIncorrect,
          newMasteryLevel, newPriorityScore, userId, questionUuid
        ]);
      } else {
        // Create new record
        const masteryLevel = this.calculateMasteryLevel(isCorrect ? 1 : 0, 1);
        
        await userDb.run(`
          INSERT INTO user_question_history (
            user_id, question_uuid, question_text, user_answer, correct_answer,
            is_correct, response_time_ms, difficulty_level, category,
            presented_at, last_seen, times_seen, times_correct, times_incorrect,
            priority_score, mastery_level
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId, questionUuid, question.question_text, userAnswer, correctAnswer,
          isCorrect, responseTimeMs, question.difficulty_level, question.category || 'general',
          now, now, 1, isCorrect ? 1 : 0, isCorrect ? 0 : 1,
          1.0, masteryLevel
        ]);
      }
    } catch (error) {
      console.error('Error recording answer:', error);
      throw error;
    }
  }

  /**
   * Record question presentations (when questions are shown but not answered)
   */
  async recordQuestionPresentation(userId: number, questionUuids: string[]): Promise<void> {
    const userDb = await this.getUserDb();
    const quizDb = await this.getQuizDb();

    try {
      const now = new Date().toISOString();

      for (const questionUuid of questionUuids) {
        // Get question details
        const question = await quizDb.get<Question>(`
          SELECT * FROM questions WHERE uuid = ?
        `, [questionUuid]);

        if (!question) {
          console.warn(`Question not found: ${questionUuid}`);
          continue;
        }

        // Check if history record exists
        const existingHistory = await userDb.get<QuestionHistory>(`
          SELECT * FROM user_question_history 
          WHERE user_id = ? AND question_uuid = ?
        `, [userId, questionUuid]);

        if (existingHistory) {
          // Update last_seen time only (don't increment times_seen for presentations)
          await userDb.run(`
            UPDATE user_question_history 
            SET last_seen = ?
            WHERE user_id = ? AND question_uuid = ?
          `, [now, userId, questionUuid]);
        } else {
          // Create new record for presentation (no answer data)
          await userDb.run(`
            INSERT INTO user_question_history (
              user_id, question_uuid, question_text, user_answer, correct_answer,
              is_correct, response_time_ms, difficulty_level, category,
              presented_at, last_seen, times_seen, times_correct, times_incorrect,
              priority_score, mastery_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            userId, questionUuid, question.question_text, null, null,
            false, null, question.difficulty_level, question.category || 'general',
            now, now, 0, 0, 0, 1.0, 0.0
          ]);
        }
      }
    } catch (error) {
      console.error('Error recording question presentation:', error);
      throw error;
    }
  }

  /**
   * Calculate mastery level based on performance
   */
  private calculateMasteryLevel(timesCorrect: number, timesSeen: number): number {
    if (timesSeen === 0) return 0;
    
    const accuracy = timesCorrect / timesSeen;
    const confidenceBonus = Math.min(0.2, timesSeen / 10); // Bonus for more attempts
    
    return Math.min(1.0, accuracy + confidenceBonus);
  }

  /**
   * Calculate updated priority score after answer
   */
  private calculateUpdatedPriorityScore(history: QuestionHistory, isCorrect: boolean): number {
    const currentScore = history.priority_score;
    const adjustment = isCorrect ? -0.1 : 0.1; // Decrease priority if correct, increase if incorrect
    
    return Math.max(0, Math.min(1, currentScore + adjustment));
  }

  /**
   * Get user's learning analytics
   */
  async getUserAnalytics(userId: number): Promise<any> {
    const userDb = await this.getUserDb();

    const analytics = await userDb.get(`
      SELECT 
        COUNT(*) as total_questions_attempted,
        SUM(times_correct) as total_correct,
        SUM(times_seen) as total_attempts,
        AVG(mastery_level) as avg_mastery,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN mastery_level >= ? THEN 1 END) as mastered_questions
      FROM user_question_history 
      WHERE user_id = ?
    `, [this.config.masteryThreshold, userId]);

    const categoryBreakdown = await userDb.all(`
      SELECT 
        category,
        COUNT(*) as questions_attempted,
        AVG(mastery_level) as avg_mastery,
        SUM(times_correct) as total_correct,
        SUM(times_seen) as total_attempts
      FROM user_question_history 
      WHERE user_id = ?
      GROUP BY category
    `, [userId]);

    return {
      ...analytics,
      accuracy: analytics.total_attempts > 0 ? analytics.total_correct / analytics.total_attempts : 0,
      categoryBreakdown
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SmartQuestionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    if (this.userDb) {
      await this.userDb.close();
      this.userDb = null;
    }
    if (this.quizDb) {
      await this.quizDb.close();
      this.quizDb = null;
    }
  }
}