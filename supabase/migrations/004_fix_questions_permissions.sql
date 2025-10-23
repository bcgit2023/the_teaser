-- Fix permissions for questions table

-- First, check current permissions
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'questions' 
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- Grant basic permissions to anon and authenticated roles
GRANT SELECT ON questions TO anon;
GRANT ALL PRIVILEGES ON questions TO authenticated;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read questions" ON questions;
DROP POLICY IF EXISTS "Allow admins to manage questions" ON questions;

-- Create new RLS policies that allow public read access
CREATE POLICY "Allow public read access to questions" ON questions
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users full access to questions" ON questions
    FOR ALL USING (auth.role() = 'authenticated');

-- Ensure RLS is enabled
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;