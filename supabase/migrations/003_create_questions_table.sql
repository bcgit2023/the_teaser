-- ============================================================================
-- QUESTIONS TABLE MIGRATION
-- ============================================================================
-- This migration creates the questions table in Supabase to match the SQLite schema

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  correct_word TEXT NOT NULL,
  position INTEGER NOT NULL,
  option_1 TEXT,
  option_2 TEXT,
  option_3 TEXT,
  option_4 TEXT,
  correct_option INTEGER,
  type TEXT,
  difficulty_level INTEGER,
  new_category_id INTEGER,
  new_difficulty_id INTEGER,
  uuid TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_questions_difficulty_level ON questions(difficulty_level);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_position ON questions(position);
CREATE INDEX idx_questions_uuid ON questions(uuid);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read questions
CREATE POLICY "Authenticated users can view questions" ON questions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow admins to manage questions
CREATE POLICY "Admins can manage questions" ON questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users_enhanced 
            WHERE users_enhanced.id = auth.uid()::uuid 
            AND users_enhanced.role = 'admin'
        )
    );

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT ON questions TO authenticated;
GRANT SELECT ON questions TO anon;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();