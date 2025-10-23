/**
 * Database Connection Module
 * 
 * Updated to support both SQLite and Supabase based on environment configuration.
 * This maintains backward compatibility while enabling the migration to Supabase.
 */

import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'
import bcrypt from 'bcrypt'
import { getDbAdapter as getAdapterFromManager } from './database/database-manager'
import { AbstractDatabaseAdapter } from './database/abstract-adapter'

let _db: Database | null = null;
let _adapter: AbstractDatabaseAdapter | null = null;

// Legacy SQLite functions for backward compatibility
async function getDb(): Promise<Database> {
  if (!_db) {
    _db = await open({
      filename: './db/user.db',
      driver: sqlite3.Database
    });
    await createTables(_db);
  }
  return _db;
}

async function createTables(db: Database) {
  // Create users table
  await db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    profile_picture TEXT
  )`);

  // Create quiz_results table
  await db.exec(`CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    score REAL,
    correct_answers INTEGER,
    total_questions INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Create quiz_answers table for detailed answer tracking
  await db.exec(`CREATE TABLE IF NOT EXISTS quiz_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_result_id INTEGER,
    question_text TEXT,
    selected_answer TEXT,
    correct_answer TEXT,
    is_correct BOOLEAN,
    FOREIGN KEY (quiz_result_id) REFERENCES quiz_results(id)
  )`);
}

async function insertInitialUsers(db: Database) {
  try {
    // Check if admin user already exists
    const existingAdmin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    
    if (!existingAdmin) {
      // Only create admin if it doesn't exist - use correct credentials
      const adminPassword = await bcrypt.hash('admin123', 10);
      await db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['admin', adminPassword, 'admin']
      );
      console.log('Admin user created with correct credentials');
    }

    // Check if student user already exists
    const existingUser = await db.get('SELECT * FROM users WHERE username = ?', ['user']);
    
    if (!existingUser) {
      const userPassword = await bcrypt.hash('user', 10);
      await db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['user', userPassword, 'student']
      );
      console.log('Student user created');
    }
  } catch (error) {
    console.error('Error inserting initial users:', error);
  }
}

// New adapter-based functions
async function getDbAdapter(): Promise<AbstractDatabaseAdapter> {
  // Always get a fresh adapter from the manager to ensure proper initialization
  return await getAdapterFromManager();
}

// Initialize the database based on environment configuration
const initDb = async () => {
  const databaseType = process.env.DATABASE_TYPE || 'sqlite';
  
  if (databaseType === 'supabase') {
    console.log('Initializing Supabase database connection...');
    // For Supabase, we use the adapter pattern
    _adapter = await getAdapterFromManager();
    return _adapter;
  } else {
    console.log('Initializing SQLite database connection...');
    // For SQLite, maintain legacy compatibility
    const database = await getDb();
    await insertInitialUsers(database);
    return database;
  }
};

// Export both legacy and new interfaces
export const db = await initDb();
export { getDb, getDbAdapter };

// Export database type for conditional logic
export const getDatabaseType = () => process.env.DATABASE_TYPE || 'sqlite';

// Export helper function to check if using Supabase
export const isUsingSupabase = () => getDatabaseType() === 'supabase';