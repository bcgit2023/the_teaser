-- Check existing users and create admin/user accounts if they don't exist

-- First, let's see what users currently exist
SELECT id, email, username, role, account_status, password_hash 
FROM users_enhanced 
WHERE username IN ('admin', 'user') OR email IN ('admin@example.com', 'user@example.com');

-- Create admin user if it doesn't exist
INSERT INTO users_enhanced (
    email, 
    username, 
    role, 
    account_status, 
    password_hash,
    email_verified,
    first_name,
    last_name,
    full_name
) 
SELECT 
    'admin@example.com',
    'admin',
    'admin',
    'active',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash for 'admin'
    true,
    'Admin',
    'User',
    'Admin User'
WHERE NOT EXISTS (
    SELECT 1 FROM users_enhanced WHERE username = 'admin' OR email = 'admin@example.com'
);

-- Create regular user if it doesn't exist
INSERT INTO users_enhanced (
    email, 
    username, 
    role, 
    account_status, 
    password_hash,
    email_verified,
    first_name,
    last_name,
    full_name
) 
SELECT 
    'user@example.com',
    'user',
    'student',
    'active',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash for 'user'
    true,
    'Regular',
    'User',
    'Regular User'
WHERE NOT EXISTS (
    SELECT 1 FROM users_enhanced WHERE username = 'user' OR email = 'user@example.com'
);

-- Show final results
SELECT id, email, username, role, account_status, 
       CASE WHEN password_hash IS NOT NULL THEN 'SET' ELSE 'NULL' END as password_status
FROM users_enhanced 
WHERE username IN ('admin', 'user') OR email IN ('admin@example.com', 'user@example.com')
ORDER BY username;