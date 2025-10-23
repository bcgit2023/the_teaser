-- Create login_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_enhanced(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  refresh_token VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activity TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  login_method VARCHAR(50) DEFAULT 'password'
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_login_sessions_token ON login_sessions(token);
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_expires_at ON login_sessions(expires_at);

-- Enable RLS
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

-- Create test user for authentication testing
INSERT INTO users_enhanced (
  id,
  email,
  username,
  role,
  account_status,
  password_hash,
  email_verified,
  first_name,
  last_name,
  full_name,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  'testuser',
  'student',
  'active',
  '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', -- password: password123
  true,
  'Test',
  'User',
  'Test User',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- Create admin user for testing admin functionality
INSERT INTO users_enhanced (
  id,
  email,
  username,
  role,
  account_status,
  password_hash,
  email_verified,
  first_name,
  last_name,
  full_name,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@example.com',
  'admin',
  'admin',
  'active',
  '$2b$10$rOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQqQqQqQqOzJqQqQqQqQqQ', -- password: password123
  true,
  'Admin',
  'User',
  'Admin User',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- Grant permissions to anon and authenticated roles for users_enhanced table
GRANT SELECT ON users_enhanced TO anon;
GRANT ALL PRIVILEGES ON users_enhanced TO authenticated;

-- Grant permissions for login_sessions table
GRANT SELECT, INSERT, UPDATE, DELETE ON login_sessions TO anon;
GRANT ALL PRIVILEGES ON login_sessions TO authenticated;

-- Grant permissions for quiz_results table
GRANT SELECT, INSERT, UPDATE, DELETE ON quiz_results TO anon;
GRANT ALL PRIVILEGES ON quiz_results TO authenticated;

-- Grant permissions for incorrect_answers table
GRANT SELECT, INSERT, UPDATE, DELETE ON incorrect_answers TO anon;
GRANT ALL PRIVILEGES ON incorrect_answers TO authenticated;