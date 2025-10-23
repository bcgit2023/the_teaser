-- Update test users with correct password hashes
-- Password for both users: password123

-- Update test user
UPDATE users_enhanced 
SET password_hash = '$2b$10$3i0JiXLHzfhL6GncJTZwxu6fTsA/9b8Nnd/Cw83jYh//L5ao8keR2'
WHERE email = 'test@example.com';

-- Update admin user  
UPDATE users_enhanced 
SET password_hash = '$2b$10$3i0JiXLHzfhL6GncJTZwxu6fTsA/9b8Nnd/Cw83jYh//L5ao8keR2'
WHERE email = 'admin@example.com';