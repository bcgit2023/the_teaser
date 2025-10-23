-- Create user_question_history table for smart question tracking
CREATE TABLE IF NOT EXISTS user_question_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users_enhanced(id) ON DELETE CASCADE,
  question_uuid TEXT NOT NULL,
  question_text TEXT NOT NULL,
  user_answer TEXT,
  correct_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  response_time_ms INTEGER,
  difficulty_level INTEGER,
  category TEXT DEFAULT 'general',
  presented_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  times_seen INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  priority_score DECIMAL(5,3) DEFAULT 1.0,
  mastery_level DECIMAL(5,3) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_question_history_user_id ON user_question_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_history_question_uuid ON user_question_history(question_uuid);
CREATE INDEX IF NOT EXISTS idx_user_question_history_user_question ON user_question_history(user_id, question_uuid);
CREATE INDEX IF NOT EXISTS idx_user_question_history_last_seen ON user_question_history(last_seen);
CREATE INDEX IF NOT EXISTS idx_user_question_history_priority_score ON user_question_history(priority_score);

-- Enable RLS
ALTER TABLE user_question_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own question history" ON user_question_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own question history" ON user_question_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own question history" ON user_question_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_question_history_updated_at 
  BEFORE UPDATE ON user_question_history 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();