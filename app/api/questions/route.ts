import { NextResponse } from 'next/server'
import { DatabaseManager } from '@/lib/database/database-manager'

export async function GET() {
  try {
    console.log('[QUESTIONS API] Starting request...');
    const dbManager = DatabaseManager.getInstance()
    console.log('[QUESTIONS API] Got database manager');
    await dbManager.initializeIfNeeded()
    console.log('[QUESTIONS API] Initialized adapter if needed');
    const adapter = dbManager.getAdapter()
    console.log('[QUESTIONS API] Got adapter:', adapter.constructor.name);
    
    console.log('[QUESTIONS API] Using Supabase adapter');
    const questions = await adapter.getRandomQuestions(5)
    console.log('[QUESTIONS API] Got questions from Supabase:', questions.length);
    return NextResponse.json(questions)
  } catch (error) {
    console.error('Error fetching questions:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available')
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}
