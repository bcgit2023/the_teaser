-- Fix permissions for login_sessions table
-- Grant necessary permissions to anon and authenticated roles

-- Grant permissions to anon role (for login session creation)
GRANT INSERT, SELECT ON login_sessions TO anon;

-- Grant full permissions to authenticated role
GRANT ALL PRIVILEGES ON login_sessions TO authenticated;

-- Create RLS policies for login_sessions table

-- Policy for anon users to create sessions during login
CREATE POLICY "anon_can_create_sessions" ON login_sessions
FOR INSERT TO anon
WITH CHECK (true);

-- Policy for authenticated users to read their own sessions
CREATE POLICY "users_can_read_own_sessions" ON login_sessions
FOR SELECT TO authenticated
USING (user_id = auth.uid()::uuid);

-- Policy for authenticated users to update their own sessions
CREATE POLICY "users_can_update_own_sessions" ON login_sessions
FOR UPDATE TO authenticated
USING (user_id = auth.uid()::uuid);

-- Policy for authenticated users to delete their own sessions
CREATE POLICY "users_can_delete_own_sessions" ON login_sessions
FOR DELETE TO authenticated
USING (user_id = auth.uid()::uuid);

-- Policy for admin users to have full access
CREATE POLICY "admin_full_access_sessions" ON login_sessions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_enhanced 
    WHERE id = auth.uid()::uuid 
    AND role = 'admin'
  )
);