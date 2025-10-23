import { DatabaseManager } from './database/database-manager'

export async function getQuestions(limit: number = 5) {
  const dbManager = DatabaseManager.getInstance()
  await dbManager.initializeIfNeeded()
  const adapter = dbManager.getAdapter()
  const questions = await adapter.getRandomQuestions(limit)
  return questions
}