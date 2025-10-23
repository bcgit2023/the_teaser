const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Import SQLite Data to Supabase
 * Based on Master Registry Schema Management Document
 */

async function importToSupabase() {
  console.log('🚀 Starting Supabase Data Import...');
  
  // Create Supabase client with service role key for admin operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const exportDir = './migration-data';
  
  if (!fs.existsSync(exportDir)) {
    throw new Error(`Export directory not found: ${exportDir}. Please run export-sqlite-data.js first.`);
  }

  const importSummary = {
    timestamp: new Date().toISOString(),
    tables: [],
    totalImported: 0,
    errors: []
  };

  try {
    // Import in dependency order to handle foreign keys
    console.log('\n📊 Importing data in dependency order...');
    
    // 1. Import users first (both regular users and parents)
    await importUsers(supabase, exportDir, importSummary);
    
    // 2. Import quiz results
    await importQuizResults(supabase, exportDir, importSummary);
    
    // 3. Import quiz answers
    await importQuizAnswers(supabase, exportDir, importSummary);
    
    // 4. Import incorrect answers
    await importIncorrectAnswers(supabase, exportDir, importSummary);
    
    // 5. Create parent-child relationships
    await createParentChildRelationships(supabase, exportDir, importSummary);

    // Save import summary
    const summaryFile = path.join(exportDir, 'import-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(importSummary, null, 2));

    console.log('\n🎉 Supabase Data Import Completed!');
    console.log(`📊 Summary:`);
    console.log(`   Total Imported: ${importSummary.totalImported}`);
    console.log(`   Errors: ${importSummary.errors.length}`);
    console.log(`   Summary File: ${summaryFile}`);
    
    if (importSummary.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      importSummary.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    return importSummary;
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    throw error;
  }
}

async function importUsers(supabase, exportDir, summary) {
  console.log('\n👥 Importing users...');
  
  // Import regular users from user.db
  const usersFile = path.join(exportDir, 'user_users.json');
  if (fs.existsSync(usersFile)) {
    const userData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    
    for (const user of userData) {
      try {
        const transformedUser = {
          id: generateUUIDFromId(user.id), // Convert integer ID to UUID
          email: user.username ? `${user.username}@futurelearner.com` : `user${user.id}@futurelearner.com`,
          username: user.username,
          role: user.role || 'student',
          password_hash: user.password,
          account_status: 'active',
          avatar_url: user.profile_picture,
          created_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('users_enhanced')
          .insert(transformedUser);
          
        if (error) {
          summary.errors.push(`User import error: ${error.message}`);
        } else {
          summary.totalImported++;
        }
      } catch (err) {
        summary.errors.push(`User transformation error: ${err.message}`);
      }
    }
    
    summary.tables.push({
      name: 'users_enhanced (from users)',
      imported: userData.length,
      source: usersFile
    });
    
    console.log(`  ✅ Imported ${userData.length} users from user.db`);
  }
  
  // Import parents from parents.db
  const parentsFile = path.join(exportDir, 'parents_parents.json');
  if (fs.existsSync(parentsFile)) {
    const parentsData = JSON.parse(fs.readFileSync(parentsFile, 'utf8'));
    
    for (const parent of parentsData) {
      try {
        const transformedParent = {
          id: generateUUIDFromId(parent.id, 'parent'), // Convert integer ID to UUID with prefix
          email: parent.email || `${parent.username}@futurelearner.com`,
          username: parent.username,
          role: 'parent',
          password_hash: parent.password,
          full_name: parent.full_name,
          account_status: 'active',
          created_at: parent.created_at || new Date().toISOString(),
          updated_at: parent.updated_at || new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('users_enhanced')
          .insert(transformedParent);
          
        if (error) {
          summary.errors.push(`Parent import error: ${error.message}`);
        } else {
          summary.totalImported++;
        }
      } catch (err) {
        summary.errors.push(`Parent transformation error: ${err.message}`);
      }
    }
    
    summary.tables.push({
      name: 'users_enhanced (from parents)',
      imported: parentsData.length,
      source: parentsFile
    });
    
    console.log(`  ✅ Imported ${parentsData.length} parents from parents.db`);
  }
}

async function importQuizResults(supabase, exportDir, summary) {
  console.log('\n📊 Importing quiz results...');
  
  const quizResultsFile = path.join(exportDir, 'user_quiz_results.json');
  if (!fs.existsSync(quizResultsFile)) {
    console.log('  ⚠️  No quiz results file found');
    return;
  }
  
  const quizResultsData = JSON.parse(fs.readFileSync(quizResultsFile, 'utf8'));
  
  for (const result of quizResultsData) {
    try {
      const transformedResult = {
        id: generateUUIDFromId(result.id, 'quiz_result'),
        user_id: generateUUIDFromId(result.user_id),
        score: result.score,
        correct_answers: result.correct_answers,
        total_questions: result.total_questions,
        completed_at: result.completed_at || new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('quiz_results')
        .insert(transformedResult);
        
      if (error) {
        summary.errors.push(`Quiz result import error: ${error.message}`);
      } else {
        summary.totalImported++;
      }
    } catch (err) {
      summary.errors.push(`Quiz result transformation error: ${err.message}`);
    }
  }
  
  summary.tables.push({
    name: 'quiz_results',
    imported: quizResultsData.length,
    source: quizResultsFile
  });
  
  console.log(`  ✅ Imported ${quizResultsData.length} quiz results`);
}

async function importQuizAnswers(supabase, exportDir, summary) {
  console.log('\n📝 Importing quiz answers...');
  
  const quizAnswersFile = path.join(exportDir, 'user_quiz_answers.json');
  if (!fs.existsSync(quizAnswersFile)) {
    console.log('  ⚠️  No quiz answers file found');
    return;
  }
  
  const quizAnswersData = JSON.parse(fs.readFileSync(quizAnswersFile, 'utf8'));
  
  for (const answer of quizAnswersData) {
    try {
      const transformedAnswer = {
        id: generateUUIDFromId(answer.id, 'quiz_answer'),
        quiz_result_id: generateUUIDFromId(answer.quiz_result_id, 'quiz_result'),
        question_text: answer.question_text,
        selected_answer: answer.selected_answer,
        correct_answer: answer.correct_answer,
        is_correct: answer.is_correct
      };
      
      const { error } = await supabase
        .from('quiz_answers')
        .insert(transformedAnswer);
        
      if (error) {
        summary.errors.push(`Quiz answer import error: ${error.message}`);
      } else {
        summary.totalImported++;
      }
    } catch (err) {
      summary.errors.push(`Quiz answer transformation error: ${err.message}`);
    }
  }
  
  summary.tables.push({
    name: 'quiz_answers',
    imported: quizAnswersData.length,
    source: quizAnswersFile
  });
  
  console.log(`  ✅ Imported ${quizAnswersData.length} quiz answers`);
}

async function importIncorrectAnswers(supabase, exportDir, summary) {
  console.log('\n❌ Importing incorrect answers...');
  
  const incorrectAnswersFile = path.join(exportDir, 'quiz_incorrect_answers.json');
  if (!fs.existsSync(incorrectAnswersFile)) {
    console.log('  ⚠️  No incorrect answers file found');
    return;
  }
  
  const incorrectAnswersData = JSON.parse(fs.readFileSync(incorrectAnswersFile, 'utf8'));
  
  for (const answer of incorrectAnswersData) {
    try {
      const transformedAnswer = {
        id: generateUUIDFromId(answer.id, 'incorrect_answer'),
        user_id: generateUUIDFromId(answer.user_id),
        question_id: answer.question_id ? generateUUIDFromId(answer.question_id, 'question') : null,
        question_text: answer.question_text,
        selected_answer: answer.selected_answer,
        correct_answer: answer.correct_answer,
        created_at: answer.created_at || new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('incorrect_answers')
        .insert(transformedAnswer);
        
      if (error) {
        summary.errors.push(`Incorrect answer import error: ${error.message}`);
      } else {
        summary.totalImported++;
      }
    } catch (err) {
      summary.errors.push(`Incorrect answer transformation error: ${err.message}`);
    }
  }
  
  summary.tables.push({
    name: 'incorrect_answers',
    imported: incorrectAnswersData.length,
    source: incorrectAnswersFile
  });
  
  console.log(`  ✅ Imported ${incorrectAnswersData.length} incorrect answers`);
}

async function createParentChildRelationships(supabase, exportDir, summary) {
  console.log('\n👨‍👩‍👧‍👦 Creating parent-child relationships...');
  
  // This would need to be based on your specific business logic
  // For now, we'll create a placeholder implementation
  console.log('  ⚠️  Parent-child relationships need to be created based on business logic');
  console.log('  💡 This should be implemented based on your specific requirements');
  
  summary.tables.push({
    name: 'parent_child_relationships',
    imported: 0,
    note: 'Requires business logic implementation'
  });
}

// Helper function to generate consistent UUIDs from integer IDs
function generateUUIDFromId(id, prefix = '') {
  const crypto = require('crypto');
  const input = `${prefix}_${id}`;
  const hash = crypto.createHash('md5').update(input).digest('hex');
  
  // Format as UUID v4
  return [
    hash.substr(0, 8),
    hash.substr(8, 4),
    '4' + hash.substr(13, 3), // Version 4
    ((parseInt(hash.substr(16, 1), 16) & 0x3) | 0x8).toString(16) + hash.substr(17, 3), // Variant bits
    hash.substr(20, 12)
  ].join('-');
}

// Run the import if this script is executed directly
if (require.main === module) {
  importToSupabase()
    .then((summary) => {
      console.log('\n✅ Import completed!');
      console.log(`📊 Total records imported: ${summary.totalImported}`);
      console.log(`❌ Errors: ${summary.errors.length}`);
      console.log(`📋 Summary saved to: ./migration-data/import-summary.json`);
      
      if (summary.errors.length > 0) {
        console.log('\n⚠️  Some errors occurred during import. Check the summary file for details.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    });
}

module.exports = { importToSupabase };