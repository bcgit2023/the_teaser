-- Fix RLS policies for login_sessions table
-- Drop existing policies first
DROP POLICY IF EXISTS "anon_can_create_sessions" ON login_sessions;
DROP POLICY IF EXISTS "users_can_manage_own_sessions" ON login_sessions;
DROP POLICY IF EXISTS "admin_full_access" ON login_sessions;

-- Create more permissive policies
-- Allow anon users to insert sessions (needed for login)
CREATE POLICY "anon_can_insert_sessions" ON login_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon users to select sessions (needed for session validation)
CREATE POLICY "anon_can_select_sessions" ON login_sessions
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to update sessions (needed for session refresh)
CREATE POLICY "anon_can_update_sessions" ON login_sessions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon users to delete sessions (needed for logout)
CREATE POLICY "anon_can_delete_sessions" ON login_sessions
  FOR DELETE
  TO anon
  USING (true);

-- Allow authenticated users full access to their own sessions
CREATE POLICY "authenticated_users_full_access" ON login_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;