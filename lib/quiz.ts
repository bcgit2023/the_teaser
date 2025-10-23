import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export async function getQuestions(limit: number = 5) {
  const db = await open({
    filename: './db/quiz.db',
    driver: sqlite3.Database
  })

  const questions = await db.all('SELECT * FROM questions ORDER BY RANDOM() LIMIT ?', limit)
  await db.close()

  return questions
}