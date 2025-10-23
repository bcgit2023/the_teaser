import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export interface QuizQuestion {
  id: number
  quiz_id?: number
  question_text: string
  correct_word: string
  user_answer?: string
  options: string
  option_1?: string
  option_2?: string
  option_3?: string
  option_4?: string
  correct_option?: number
  type?: string
  difficulty_level?: number
}

export class QuizDatabaseService {
  private static instance: QuizDatabaseService
  private dbPath = './db/quiz.db'

  static getInstance(): QuizDatabaseService {
    if (!QuizDatabaseService.instance) {
      QuizDatabaseService.instance = new QuizDatabaseService()
    }
    return QuizDatabaseService.instance
  }

  private async openDatabase() {
    try {
      const db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      })
      return db
    } catch (error) {
      console.error('Error opening quiz database:', error)
      throw error
    }
  }

  async getAllQuestions(): Promise<QuizQuestion[]> {
    const db = await this.openDatabase()
    try {
      const questions = await db.all('SELECT * FROM quiz_questions ORDER BY id')
      return questions
    } catch (error) {
      console.error('Error fetching questions:', error)
      // Return empty array if table doesn't exist
      return []
    } finally {
      await db.close()
    }
  }

  async getQuestionById(id: number): Promise<QuizQuestion | null> {
    const db = await this.openDatabase()
    try {
      const question = await db.get('SELECT * FROM quiz_questions WHERE id = ?', id)
      return question || null
    } catch (error) {
      console.error('Error fetching question by ID:', error)
      throw error
    } finally {
      await db.close()
    }
  }

  async getQuestionsByType(type: string): Promise<QuizQuestion[]> {
    const db = await this.openDatabase()
    try {
      const questions = await db.all('SELECT * FROM quiz_questions WHERE category = ? ORDER BY id', type)
      return questions
    } catch (error) {
      console.error('Error fetching questions by type:', error)
      // Return empty array if table doesn't exist
      return []
    } finally {
      await db.close()
    }
  }

  async updateQuestion(id: number, updates: Partial<QuizQuestion>): Promise<boolean> {
    const db = await this.openDatabase()
    try {
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ')
      const values = Object.values(updates)
      
      const result = await db.run(
        `UPDATE quiz_questions SET ${setClause} WHERE id = ?`,
        [...values, id]
      )
      
      return result.changes > 0
    } catch (error) {
      console.error('Error updating question:', error)
      throw error
    } finally {
      await db.close()
    }
  }

  async deleteQuestion(id: number): Promise<boolean> {
    const db = await this.openDatabase()
    try {
      const result = await db.run('DELETE FROM quiz_questions WHERE id = ?', id)
      return result.changes > 0
    } catch (error) {
      console.error('Error deleting question:', error)
      throw error
    } finally {
      await db.close()
    }
  }

  async addQuestion(question: Omit<QuizQuestion, 'id'>): Promise<number> {
    const db = await this.openDatabase()
    try {
      const columns = Object.keys(question).join(', ')
      const placeholders = Object.keys(question).map(() => '?').join(', ')
      const values = Object.values(question)
      
      const result = await db.run(
        `INSERT INTO quiz_questions (${columns}) VALUES (${placeholders})`,
        values
      )
      
      return result.lastID as number
    } catch (error) {
      console.error('Error adding question:', error)
      throw error
    } finally {
      await db.close()
    }
  }

  async getQuestionStats(): Promise<{
    total: number
    byType: Record<string, number>
    byDifficulty: Record<string, number>
  }> {
    const db = await this.openDatabase()
    try {
      const total = await db.get('SELECT COUNT(*) as count FROM quiz_questions')
      const byType = await db.all('SELECT category, COUNT(*) as count FROM quiz_questions GROUP BY category')
      // Since quiz_questions table doesn't have difficulty_level, return empty object
      const byDifficulty: { category: string; count: number }[] = []
      
      return {
        total: total.count,
        byType: byType.reduce((acc, row) => ({ ...acc, [row.category || 'unknown']: row.count }), {}),
        byDifficulty: byDifficulty.reduce((acc, row) => ({ ...acc, [row.category || 'unknown']: row.count }), {})
      }
    } catch (error) {
      console.error('Error fetching question stats:', error)
      // Return empty stats if table doesn't exist
      return {
        total: 0,
        byType: {},
        byDifficulty: {}
      }
    } finally {
      await db.close()
    }
  }
}

export const quizDbService = QuizDatabaseService.getInstance()