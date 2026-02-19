-- Migration 004: Create chapter_votes using (series_slug, chapter_number)
-- The old chapter_ratings table is owned by postgres and cannot be dropped by the app user.
-- The chapters table is empty (chapters are served from DigitalOcean Spaces),
-- so chapter_id FK is useless. Using slug+number avoids the dependency on chapters table.

CREATE TABLE IF NOT EXISTS chapter_votes (
    id SERIAL PRIMARY KEY,
    series_slug    VARCHAR(300) NOT NULL,
    chapter_number DECIMAL(8,2) NOT NULL,
    visitor_id     VARCHAR(255) NOT NULL,
    rating         INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(series_slug, chapter_number, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_chapter_votes_slug_num ON chapter_votes(series_slug, chapter_number);
CREATE INDEX IF NOT EXISTS idx_chapter_votes_visitor  ON chapter_votes(visitor_id);
