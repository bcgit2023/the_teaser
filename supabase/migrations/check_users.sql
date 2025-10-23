-- Check existing users in the database
SELECT id, email, username, role, account_status, password_hash, created_at, last_login
FROM users_enhanced
ORDER BY created_at;