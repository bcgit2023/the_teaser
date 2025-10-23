import { DatabaseManager } from '@/lib/database/database-manager'
import { SupabaseAdapter } from '@/lib/database/supabase-adapter'

export interface QuizQuestion {
  id: string
  quiz_id?: string
  question_text: string
  correct_word: string
  user_answer?: string
  options: string[]
  option_1?: string
  option_2?: string
  option_3?: string
  option_4?: string
  correct_option?: number
  type?: string
  difficulty_level?: number
}

export interface QuizStats {
  totalQuestions: number
  questionsByType: Record<string, number>
  questionsByDifficulty: Record<string, number>
}

export class SupabaseQuizService {
  private adapter: SupabaseAdapter | null = null

  private async getAdapter(): Promise<SupabaseAdapter> {
    if (!this.adapter) {
      const dbManager = DatabaseManager.getInstance()
      await dbManager.initializeIfNeeded()
      const adapter = dbManager.getAdapter()
      
      if (!(adapter instanceof SupabaseAdapter)) {
        throw new Error('SupabaseAdapter required for SupabaseQuizService')
      }
      
      this.adapter = adapter
    }
    return this.adapter
  }

  async getAllQuestions(): Promise<QuizQuestion[]> {
    const adapter = await this.getAdapter()
    
    // Use the service client to get all questions
    const { data, error } = await adapter.supabase
      .from('questions')
      .select('*')
      .order('id')

    if (error) throw error

    return (data || []).map(q => ({
      id: q.id,
      question_text: q.question_text,
      correct_word: q.correct_word,
      options: [q.option_1, q.option_2, q.option_3, q.option_4],
      option_1: q.option_1,
      option_2: q.option_2,
      option_3: q.option_3,
      option_4: q.option_4,
      correct_option: q.correct_option,
      type: q.type,
      difficulty_level: q.difficulty_level
    }))
  }

  async getQuestionsByType(type: string): Promise<QuizQuestion[]> {
    const adapter = await this.getAdapter()
    
    const { data, error } = await adapter.supabase
      .from('questions')
      .select('*')
      .eq('type', type)
      .order('id')

    if (error) throw error

    return (data || []).map(q => ({
      id: q.id,
      question_text: q.question_text,
      correct_word: q.correct_word,
      options: [q.option_1, q.option_2, q.option_3, q.option_4],
      option_1: q.option_1,
      option_2: q.option_2,
      option_3: q.option_3,
      option_4: q.option_4,
      correct_option: q.correct_option,
      type: q.type,
      difficulty_level: q.difficulty_level
    }))
  }

  async getQuestionStats(): Promise<QuizStats> {
    const adapter = await this.getAdapter()
    
    const { data, error } = await adapter.supabase
      .from('questions')
      .select('type, difficulty_level')

    if (error) throw error

    const questions = data || []
    const totalQuestions = questions.length
    
    const questionsByType: Record<string, number> = {}
    const questionsByDifficulty: Record<string, number> = {}

    questions.forEach(q => {
      if (q.type) {
        questionsByType[q.type] = (questionsByType[q.type] || 0) + 1
      }
      if (q.difficulty_level !== null && q.difficulty_level !== undefined) {
        const difficultyKey = q.difficulty_level.toString()
        questionsByDifficulty[difficultyKey] = (questionsByDifficulty[difficultyKey] || 0) + 1
      }
    })

    return {
      totalQuestions,
      questionsByType,
      questionsByDifficulty
    }
  }

  async getRandomQuestions(count: number): Promise<QuizQuestion[]> {
    const adapter = await this.getAdapter()
    return adapter.getRandomQuestions(count)
  }

  async updateQuestion(id: string, updates: Partial<QuizQuestion>): Promise<void> {
    const adapter = await this.getAdapter()
    
    const updateData: any = {}
    if (updates.question_text) updateData.question_text = updates.question_text
    if (updates.correct_word) updateData.correct_word = updates.correct_word
    if (updates.option_1) updateData.option_1 = updates.option_1
    if (updates.option_2) updateData.option_2 = updates.option_2
    if (updates.option_3) updateData.option_3 = updates.option_3
    if (updates.option_4) updateData.option_4 = updates.option_4
    if (updates.correct_option !== undefined) updateData.correct_option = updates.correct_option
    if (updates.type) updateData.type = updates.type
    if (updates.difficulty_level !== undefined) updateData.difficulty_level = updates.difficulty_level

    const { error } = await adapter.supabase
      .from('questions')
      .update(updateData)
      .eq('id', id)

    if (error) throw error
  }

  async deleteQuestion(id: string): Promise<void> {
    const adapter = await this.getAdapter()
    
    const { error } = await adapter.supabase
      .from('questions')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async createQuestion(question: Omit<QuizQuestion, 'id'>): Promise<QuizQuestion> {
    const adapter = await this.getAdapter()
    
    const questionData = {
      question_text: question.question_text,
      correct_word: question.correct_word,
      option_1: question.option_1,
      option_2: question.option_2,
      option_3: question.option_3,
      option_4: question.option_4,
      correct_option: question.correct_option,
      type: question.type,
      difficulty_level: question.difficulty_level
    }

    const { data, error } = await adapter.supabase
      .from('questions')
      .insert([questionData])
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      question_text: data.question_text,
      correct_word: data.correct_word,
      options: [data.option_1, data.option_2, data.option_3, data.option_4],
      option_1: data.option_1,
      option_2: data.option_2,
      option_3: data.option_3,
      option_4: data.option_4,
      correct_option: data.correct_option,
      type: data.type,
      difficulty_level: data.difficulty_level
    }
  }
}

// Create a singleton instance
export const supabaseQuizService = new SupabaseQuizService()