-- Fix token field lengths in login_sessions table
-- JWT tokens can be longer than 255 characters

-- Increase token field length to accommodate JWT tokens
ALTER TABLE login_sessions 
ALTER COLUMN token TYPE VARCHAR(1000);

-- Increase refresh_token field length to accommodate JWT refresh tokens  
ALTER TABLE login_sessions 
ALTER COLUMN refresh_token TYPE VARCHAR(1000);

-- Also increase ip_address field if needed (IPv6 can be up to 45 characters)
ALTER TABLE login_sessions 
ALTER COLUMN ip_address TYPE VARCHAR(100);

-- Increase login_method field if needed
ALTER TABLE login_sessions 
ALTER COLUMN login_method TYPE VARCHAR(100);