-- Add profile fields required by the auth and user controllers.
-- Safe to run more than once and safe for databases that already contain some fields.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banner_url TEXT,
    ADD COLUMN IF NOT EXISTS location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS theme_primary_color VARCHAR(20),
    ADD COLUMN IF NOT EXISTS theme_accent_color VARCHAR(20),
    ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(20) DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

UPDATE users
SET theme_mode = COALESCE(theme_mode, 'system'),
    preferences = COALESCE(preferences, '{}'::jsonb)
WHERE theme_mode IS NULL OR preferences IS NULL;

ALTER TABLE users
    ALTER COLUMN theme_mode SET DEFAULT 'system',
    ALTER COLUMN theme_mode SET NOT NULL,
    ALTER COLUMN preferences SET DEFAULT '{}'::jsonb,
    ALTER COLUMN preferences SET NOT NULL;

COMMENT ON COLUMN users.theme_mode IS 'Preferred color scheme: light, dark, or system';
COMMENT ON COLUMN users.preferences IS 'User interface and account preferences';
