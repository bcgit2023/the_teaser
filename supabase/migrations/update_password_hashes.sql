-- Update password hashes for admin and user accounts with correct bcrypt hashes

-- Update admin user password hash
UPDATE users_enhanced 
SET password_hash = '$2b$10$MSqr47ymp4.KsC5TPaV6P.J4dnMLWWUHw24Ss8ASVU.zsCZrlpVYC',
    updated_at = now()
WHERE username = 'admin' OR email = 'admin@example.com';

-- Update user password hash  
UPDATE users_enhanced 
SET password_hash = '$2b$10$HGCoZOg3ZCGyN1YKbWUI4.t8Bq/2/68pyuMNQvIYevNeXfrsojlCe',
    updated_at = now()
WHERE username = 'user' OR email = 'user@example.com';

-- Show updated users
SELECT id, email, username, role, account_status, 
       CASE WHEN password_hash IS NOT NULL THEN 'SET' ELSE 'NULL' END as password_status,
       CASE 
         WHEN username = 'admin' THEN 'admin/admin'
         WHEN username = 'user' THEN 'user/user'
         ELSE 'unknown'
       END as credentials
FROM users_enhanced 
WHERE username IN ('admin', 'user')