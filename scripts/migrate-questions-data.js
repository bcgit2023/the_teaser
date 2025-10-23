#!/usr/bin/env node

/**
 * Questions Data Migration Script
 * Migrates questions from SQLite quiz.db to Supabase
 */

const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateQuestions() {
  console.log('🚀 Starting Questions Data Migration');
  console.log('📊 Source: SQLite quiz.db');
  console.log('🎯 Target: Supabase questions table');
  console.log('');

  try {
    // Connect to SQLite database
    const dbPath = path.join(process.cwd(), 'db', 'quiz.db');
    console.log(`📂 Opening SQLite database: ${dbPath}`);
    
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error opening SQLite database:', err);
        throw err;
      }
    });

    // Get all questions from SQLite
    const questions = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM questions ORDER BY id', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    console.log(`📋 Found ${questions.length} questions in SQLite database`);

    if (questions.length === 0) {
      console.log('⚠️ No questions found to migrate');
      return;
    }

    // Check if questions already exist in Supabase
    const { data: existingQuestions, error: checkError } = await supabase
      .from('questions')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking existing questions:', checkError);
      throw checkError;
    }

    if (existingQuestions && existingQuestions.length > 0) {
      console.log('⚠️ Questions already exist in Supabase. Skipping migration.');
      console.log('💡 To force re-migration, delete existing questions first.');
      return;
    }

    // Transform questions for Supabase (remove SQLite id, let Supabase generate UUID)
    const transformedQuestions = questions.map(q => ({
      question_text: q.question_text,
      correct_word: q.correct_word,
      position: q.position,
      option_1: q.option_1,
      option_2: q.option_2,
      option_3: q.option_3,
      option_4: q.option_4,
      correct_option: q.correct_option,
      type: q.type,
      difficulty_level: q.difficulty_level,
      new_category_id: q.new_category_id,
      new_difficulty_id: q.new_difficulty_id,
      uuid: q.uuid
    }));

    console.log('📤 Inserting questions into Supabase...');

    // Insert questions in batches to avoid timeout
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < transformedQuestions.length; i += batchSize) {
      const batch = transformedQuestions.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedQuestions.length / batchSize)} (${batch.length} questions)`);

      const { data, error } = await supabase
        .from('questions')
        .insert(batch);

      if (error) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
        errorCount += batch.length;
      } else {
        console.log(`✅ Successfully inserted batch ${Math.floor(i / batchSize) + 1}`);
        successCount += batch.length;
      }
    }

    // Close SQLite connection
    db.close();

    console.log('');
    console.log('📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} questions`);
    console.log(`❌ Failed to migrate: ${errorCount} questions`);
    console.log(`📋 Total processed: ${transformedQuestions.length} questions`);

    if (errorCount === 0) {
      console.log('');
      console.log('🎉 Questions migration completed successfully!');
    } else {
      console.log('');
      console.log('⚠️ Migration completed with some errors. Please review the logs above.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateQuestions();