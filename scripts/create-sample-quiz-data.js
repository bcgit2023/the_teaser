const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSampleQuizData() {
  try {
    console.log('Starting to create sample quiz data...');
    
    // Get users from the database
    console.log('Fetching users...');
    const { data: users, error: usersError } = await supabase
      .from('users_enhanced')
      .select('id, username')
      .limit(5);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    console.log('Found users:', users?.length || 0);
    if (!users || users.length === 0) {
      console.log('No users found in database');
      return;
    }

    // Get questions from the database
    console.log('Fetching questions...');
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, question_text, correct_option')
      .limit(10);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return;
    }

    console.log('Found questions:', questions?.length || 0);
    if (!questions || questions.length === 0) {
      console.log('No questions found in database');
      return;
    }

    console.log('Creating quiz results and answers...');
    
    // Create sample quiz results for each user
    for (const user of users) {
      // Create 2-3 quiz results per user
      const numQuizzes = Math.floor(Math.random() * 2) + 2; // 2-3 quizzes
      
      for (let i = 0; i < numQuizzes; i++) {
        const score = Math.floor(Math.random() * 100) + 1; // 1-100
        const totalQuestions = 5; // Fixed to match actual tutorial quiz format (5 questions)
        const correctAnswers = Math.floor((score / 100) * totalQuestions);
        
        // Create quiz result
        const { data: quizResult, error: quizError } = await supabase
          .from('quiz_results')
          .insert({
            user_id: user.id,
            score: score,
            total_questions: totalQuestions,
            correct_answers: correctAnswers,
            completed_at: new Date().toISOString()
          })
          .select()
          .single();

        if (quizError) {
          console.error('Error creating quiz result:', quizError);
          continue;
        }

        console.log(`Created quiz result for ${user.username}: ${score}%`);

        // Create quiz answers for this result
        const selectedQuestions = questions.slice(0, totalQuestions);
        
        for (let j = 0; j < selectedQuestions.length; j++) {
          const question = selectedQuestions[j];
          const isCorrect = j < correctAnswers; // First N answers are correct
          const selectedAnswer = isCorrect ? `Option ${question.correct_option}` : `Option ${(question.correct_option % 4) + 1}`;
          const correctAnswer = `Option ${question.correct_option}`;
          
          const { error: answerError } = await supabase
            .from('quiz_answers')
            .insert({
              quiz_result_id: quizResult.id,
              question_text: question.question_text,
              selected_answer: selectedAnswer,
              correct_answer: correctAnswer,
              is_correct: isCorrect
            });

          if (answerError) {
            console.error('Error creating quiz answer:', answerError);
          }
        }
      }
    }

    console.log('Sample quiz data created successfully!');
    
    // Verify the data was created
    const { data: resultCount } = await supabase
      .from('quiz_results')
      .select('id', { count: 'exact' });
    
    const { data: answerCount } = await supabase
      .from('quiz_answers')
      .select('id', { count: 'exact' });

    console.log(`Created ${resultCount?.length || 0} quiz results`);
    console.log(`Created ${answerCount?.length || 0} quiz answers`);

  } catch (error) {
    console.error('Error creating sample quiz data:', error);
  }
}

// Run the function
createSampleQuizData().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});