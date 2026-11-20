-- Add timestamps required by progress, streak, and achievement queries.
-- Existing rows keep their historical created/updated timestamps.

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS first_read_at TIMESTAMP WITH TIME ZONE;

UPDATE reading_history
SET read_at = COALESCE(read_at, updated_at, created_at, NOW()),
    first_read_at = COALESCE(first_read_at, created_at, read_at, NOW())
WHERE read_at IS NULL OR first_read_at IS NULL;

ALTER TABLE reading_history
    ALTER COLUMN read_at SET DEFAULT NOW(),
    ALTER COLUMN read_at SET NOT NULL,
    ALTER COLUMN first_read_at SET DEFAULT NOW(),
    ALTER COLUMN first_read_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reading_history_user_read_at
    ON reading_history(user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_reading_history_user_first_read_at
    ON reading_history(user_id, first_read_at DESC);

COMMENT ON COLUMN reading_history.read_at IS 'Most recent time the chapter was read';
COMMENT ON COLUMN reading_history.first_read_at IS 'First read time, preserved for streak and XP calculations';
