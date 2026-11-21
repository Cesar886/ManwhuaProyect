ALTER TABLE users
    ADD COLUMN IF NOT EXISTS show_active_reader BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users
SET show_active_reader = TRUE
WHERE show_active_reader IS NULL;

COMMENT ON COLUMN users.show_active_reader IS 'Whether the user appears in real-time reader presence rooms';
