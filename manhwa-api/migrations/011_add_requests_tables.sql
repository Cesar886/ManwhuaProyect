BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(500) NOT NULL,
    original_title varchar(500),
    description text,
    cover_url text,
    genres jsonb NOT NULL DEFAULT '[]'::jsonb,
    status varchar(30) NOT NULL DEFAULT 'pending',
    priority varchar(20) NOT NULL DEFAULT 'media',
    progress integer NOT NULL DEFAULT 0,
    votes_count integer NOT NULL DEFAULT 0,
    comments_count integer NOT NULL DEFAULT 0,
    requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id uuid REFERENCES series(id) ON DELETE SET NULL,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason varchar(500),
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT requests_status_check
        CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    CONSTRAINT requests_progress_check CHECK (progress BETWEEN 0 AND 100),
    CONSTRAINT requests_votes_count_check CHECK (votes_count >= 0),
    CONSTRAINT requests_comments_count_check CHECK (comments_count >= 0)
);

CREATE TABLE IF NOT EXISTS request_votes (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_requests_status_votes
    ON requests (status, votes_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_requested_by
    ON requests (requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_series_id
    ON requests (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_description
    ON requests (description) WHERE description IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_votes_request_id
    ON request_votes (request_id);

COMMIT;
