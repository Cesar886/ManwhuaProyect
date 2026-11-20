-- Store the import metadata sent by the Selenium scrapers.
-- Idempotent so it is safe to run on an already prepared database.

ALTER TABLE series
    ADD COLUMN IF NOT EXISTS in_spaces BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS origins TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- chapter_count already belongs to the canonical schema. Keep this migration
-- compatible with older installations that may not have it yet.
ALTER TABLE series
    ADD COLUMN IF NOT EXISTS chapter_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_series_in_spaces
    ON series (in_spaces)
    WHERE in_spaces = TRUE;

CREATE INDEX IF NOT EXISTS idx_series_origins_gin
    ON series USING GIN (origins);

COMMENT ON COLUMN series.in_spaces IS 'Whether the scraper uploaded the series chapter assets to object storage';
COMMENT ON COLUMN series.origins IS 'Source sites that supplied metadata or chapter assets for the series';
