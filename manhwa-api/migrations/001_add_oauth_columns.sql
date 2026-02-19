-- Migration: Add OAuth columns for Google (and future providers)
-- Run this migration manually: psql -d manhwa_db -f migrations/001_add_oauth_columns.sql

-- Add OAuth provider columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255) DEFAULT NULL;

-- Create unique index for OAuth login (prevents duplicate OAuth accounts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_provider_id
ON users (oauth_provider, oauth_id)
WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;

-- Add index for faster OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users (oauth_provider) WHERE oauth_provider IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider name: google, discord, etc.';
COMMENT ON COLUMN users.oauth_id IS 'Unique user ID from the OAuth provider';
