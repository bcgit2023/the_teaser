-- Fix permissions for users_enhanced table to allow authentication
-- This migration grants necessary permissions for the anon role to authenticate users

-- Grant SELECT permission to anon role for authentication
GRANT SELECT ON users_enhanced TO anon;

-- Grant ALL permissions to authenticated role for full access
GRANT ALL PRIVILEGES ON users_enhanced TO authenticated;

-- Create RLS policy to allow anon users to read user data for authentication
-- This is needed for login functionality
CREATE POLICY "Allow anon to read users for authentication" ON users_enhanced
    FOR SELECT
    TO anon
    USING (true);

-- Create RLS policy to allow authenticated users to read their own data
CREATE POLICY "Users can read their own data" ON users_enhanced
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = id::text);

-- Create RLS policy to allow authenticated users to update their own data
CREATE POLICY "Users can update their own data" ON users_enhanced
    FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = id::text);

-- Create RLS policy for admin users to have full access
CREATE POLICY "Admin users have full access" ON users_enhanced
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users_enhanced 
            WHERE id::text = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- Check current permissions
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'users_enhanced' 
AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;