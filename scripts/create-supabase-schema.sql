-- ============================================================================
-- Supabase Database Schema Creation Script
-- Based on Master Registry Schema Management Document
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS_ENHANCED TABLE (Primary table - must be created first)
-- ============================================================================

CREATE TABLE users_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
  account_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER NOT NULL DEFAULT 0,
  password_hash VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP WITH TIME ZONE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone VARCHAR(20),
  avatar_url TEXT,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  full_name VARCHAR(100),
  date_of_birth DATE,
  grade_level VARCHAR(20),
  subject_specialization JSONB,
  bio TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================================
-- 2. QUIZ_RESULTS TABLE
-- ============================================================================

CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  score DECIMAL(5,2),
  correct_answers INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_quiz_results_user_id 
    FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. QUIZ_ANSWERS TABLE
-- ============================================================================

CREATE TABLE quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_result_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  selected_answer TEXT,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  CONSTRAINT fk_quiz_answers_quiz_result_id 
    FOREIGN KEY (quiz_result_id) REFERENCES quiz_results(id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. PARENT_CHILD_RELATIONSHIPS TABLE
-- ============================================================================

CREATE TABLE parent_child_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  child_id UUID NOT NULL,
  relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('parent', 'guardian', 'caregiver')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_parent_child_parent_id 
    FOREIGN KEY (parent_id) REFERENCES users_enhanced(id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_child_child_id 
    FOREIGN KEY (child_id) REFERENCES users_enhanced(id) ON DELETE CASCADE,
  UNIQUE(parent_id, child_id)
);

-- ============================================================================
-- 5. INCORRECT_ANSWERS TABLE
-- ============================================================================

CREATE TABLE incorrect_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID,
  question_text TEXT NOT NULL,
  selected_answer TEXT,
  correct_answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_incorrect_answers_user_id 
    FOREIGN KEY (user_id) REFERENCES users_enhanced(id) ON DELETE CASCADE
);

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users_enhanced(email);
CREATE INDEX idx_users_username ON users_enhanced(username);
CREATE INDEX idx_users_role ON users_enhanced(role);
CREATE INDEX idx_users_account_status ON users_enhanced(account_status);
CREATE INDEX idx_users_created_at ON users_enhanced(created_at DESC);

-- Quiz results indexes
CREATE INDEX idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_completed_at ON quiz_results(completed_at DESC);
CREATE INDEX idx_quiz_results_score ON quiz_results(score DESC);

-- Quiz answers indexes
CREATE INDEX idx_quiz_answers_quiz_result_id ON quiz_answers(quiz_result_id);
CREATE INDEX idx_quiz_answers_is_correct ON quiz_answers(is_correct);

-- Parent-child relationships indexes
CREATE INDEX idx_parent_child_parent_id ON parent_child_relationships(parent_id);
CREATE INDEX idx_parent_child_child_id ON parent_child_relationships(child_id);
CREATE INDEX idx_parent_child_is_active ON parent_child_relationships(is_active);
CREATE INDEX idx_parent_child_is_primary ON parent_child_relationships(is_primary);

-- Incorrect answers indexes
CREATE INDEX idx_incorrect_answers_user_id ON incorrect_answers(user_id);
CREATE INDEX idx_incorrect_answers_created_at ON incorrect_answers(created_at DESC);

-- ============================================================================
-- 7. CREATE UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_enhanced_updated_at 
    BEFORE UPDATE ON users_enhanced 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parent_child_relationships_updated_at 
    BEFORE UPDATE ON parent_child_relationships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_child_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE incorrect_answers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. CREATE BASIC RLS POLICIES
-- ============================================================================

-- Users table policies
CREATE POLICY "Users can view their own profile" ON users_enhanced
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile" ON users_enhanced
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Quiz results policies
CREATE POLICY "Users can view their own quiz results" ON quiz_results
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own quiz results" ON quiz_results
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Quiz answers policies
CREATE POLICY "Users can view their own quiz answers" ON quiz_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM quiz_results 
            WHERE quiz_results.id = quiz_answers.quiz_result_id 
            AND auth.uid()::text = quiz_results.user_id::text
        )
    );

CREATE POLICY "Users can insert their own quiz answers" ON quiz_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM quiz_results 
            WHERE quiz_results.id = quiz_answers.quiz_result_id 
            AND auth.uid()::text = quiz_results.user_id::text
        )
    );

-- Parent-child relationships policies
CREATE POLICY "Parents can view their relationships" ON parent_child_relationships
    FOR SELECT USING (
        auth.uid()::text = parent_id::text OR 
        auth.uid()::text = child_id::text
    );

CREATE POLICY "Parents can manage their relationships" ON parent_child_relationships
    FOR ALL USING (auth.uid()::text = parent_id::text);

-- Incorrect answers policies
CREATE POLICY "Users can view their own incorrect answers" ON incorrect_answers
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own incorrect answers" ON incorrect_answers
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- ============================================================================
-- 10. GRANT PERMISSIONS TO AUTHENTICATED USERS
-- ============================================================================

-- Grant basic permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON users_enhanced TO authenticated;
GRANT SELECT, INSERT, UPDATE ON quiz_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON quiz_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parent_child_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON incorrect_answers TO authenticated;

-- Grant permissions to anon role for public access (limited)
GRANT SELECT ON users_enhanced TO anon;

-- ============================================================================
-- 11. CREATE UTILITY FUNCTIONS
-- ============================================================================

-- Function to get user by email
CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE(
    id UUID,
    email VARCHAR(255),
    username VARCHAR(50),
    role VARCHAR(20),
    account_status VARCHAR(20),
    full_name VARCHAR(100)
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.username,
        u.role,
        u.account_status,
        u.full_name
    FROM users_enhanced u
    WHERE u.email = user_email;
END;
$$ LANGUAGE plpgsql;

-- Function to get user quiz statistics
CREATE OR REPLACE FUNCTION get_user_quiz_stats(user_uuid UUID)
RETURNS TABLE(
    total_quizzes INTEGER,
    average_score DECIMAL(5,2),
    total_questions INTEGER,
    total_correct INTEGER
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_quizzes,
        AVG(qr.score) as average_score,
        SUM(qr.total_questions)::INTEGER as total_questions,
        SUM(qr.correct_answers)::INTEGER as total_correct
    FROM quiz_results qr
    WHERE qr.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA CREATION COMPLETED
-- ============================================================================

-- Insert a comment to track schema version
COMMENT ON SCHEMA public IS 'FutureLearner Schema v1.0 - SQLite to Supabase Migration';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Supabase schema creation completed successfully!';
    RAISE NOTICE 'Tables created: users_enhanced, quiz_results, quiz_answers, parent_child_relationships, incorrect_answers';
    RAISE NOTICE 'Indexes created: % indexes for performance optimization', 15;
    RAISE NOTICE 'RLS enabled and policies configured for all tables';
    RAISE NOTICE 'Utility functions created for common operations';
END $$;