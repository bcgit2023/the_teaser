import { NextResponse } from 'next/server'
import { DatabaseManager } from '@/lib/database/database-manager'
import { SupabaseAdapter } from '@/lib/database/supabase-adapter'

// Define the question interface to match our database schema
interface DBQuestion {
  id: number
  question_text: string
  correct_word: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  correct_option: number
  type: string
  difficulty_level: number
}

export async function GET() {
  try {
    console.log('[QUESTIONS API] Starting request...');
    const dbManager = DatabaseManager.getInstance()
    console.log('[QUESTIONS API] Got database manager');
    await dbManager.initializeIfNeeded()
    console.log('[QUESTIONS API] Initialized adapter if needed');
    const adapter = dbManager.getAdapter()
    console.log('[QUESTIONS API] Got adapter:', adapter.constructor.name);
    
    if (adapter instanceof SupabaseAdapter) {
      console.log('[QUESTIONS API] Using Supabase adapter');
      // Use Supabase adapter for questions
      const questions = await adapter.getRandomQuestions(5)
      console.log('[QUESTIONS API] Got questions from Supabase:', questions.length);
      return NextResponse.json(questions)
    } else {
      console.log('[QUESTIONS API] Using SQLite adapter');
      // Use SQLite adapter for questions
      const questions = await adapter.getRandomQuestions(5)
      console.log('[QUESTIONS API] Got questions from SQLite:', questions.length);
      return NextResponse.json(questions)
    }
  } catch (error) {
    console.error('Error fetching questions:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}
