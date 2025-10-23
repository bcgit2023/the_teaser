import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'
import bcrypt from 'bcrypt'

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await open({
      filename: './db/parents.db',
      driver: sqlite3.Database
    });
    await createTables(_db);
  }
  return _db;
}

async function createTables(db: Database) {
  // Create parents table
  await db.exec(`CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE,
    full_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create parent-student relationship table
  await db.exec(`CREATE TABLE IF NOT EXISTS parent_student_relationship (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES parents(id)
  )`);

  // Create student progress table
  await db.exec(`CREATE TABLE IF NOT EXISTS student_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

async function insertInitialUsers(db: Database) {
  try {
    const parentPassword = await bcrypt.hash('parent123', 10);

    // Insert test parent
    await db.run(`
      INSERT OR REPLACE INTO parents (username, password, email, full_name) 
      VALUES (?, ?, ?, ?)
    `, ['parent1', parentPassword, 'parent1@example.com', 'Parent One']);

    // Create relationship between parent1 and student
    const parent = await db.get('SELECT id FROM parents WHERE username = ?', ['parent1']);

    if (parent) {
      await db.run(`
        INSERT OR REPLACE INTO parent_student_relationship (parent_id, student_id, relationship_type)
        VALUES (?, ?, ?)
      `, [parent.id, 101, 'parent']);
    }
  } catch (error) {
    console.error('Error inserting initial users:', error);
  }
}

// Initialize the database and export it
const initDb = async () => {
  const database = await getDb();
  await insertInitialUsers(database);
  return database;
};

export const db = await initDb();
export { getDb };
