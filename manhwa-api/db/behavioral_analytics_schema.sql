-- Behavioral Analytics Schema
-- PostgreSQL / snake_case / UTC timestamps

DO $$ BEGIN
    CREATE TYPE reader_archetype_enum AS ENUM ('binge_reader', 'daily_reader', 'casual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE engagement_profile_enum AS ENUM ('lurker', 'critic', 'social');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE time_slot_enum AS ENUM ('madrugada', 'manana', 'tarde', 'noche');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE reading_speed_enum AS ENUM ('lector_real', 'scrolleador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS user_behavior_reading_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    chapter_number INTEGER,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    client_local_timestamp TIMESTAMPTZ,
    duration_seconds INTEGER,
    chapters_read_in_session INTEGER NOT NULL DEFAULT 0,
    total_progress_events INTEGER NOT NULL DEFAULT 0,
    scroll_depth_max NUMERIC(5,2) NOT NULL DEFAULT 0,
    exit_reason VARCHAR(40),
    page_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT user_behavior_reading_sessions_duration_non_negative CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    CONSTRAINT user_behavior_reading_sessions_scroll_depth_check CHECK (scroll_depth_max >= 0 AND scroll_depth_max <= 100)
);

CREATE INDEX IF NOT EXISTS idx_ub_reading_sessions_user_started_at ON user_behavior_reading_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_reading_sessions_series_started_at ON user_behavior_reading_sessions (series_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_reading_sessions_chapter_id ON user_behavior_reading_sessions (chapter_id);
CREATE INDEX IF NOT EXISTS idx_ub_reading_sessions_timezone ON user_behavior_reading_sessions (timezone);

CREATE TABLE IF NOT EXISTS user_behavior_chapter_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    session_id UUID REFERENCES user_behavior_reading_sessions(session_id) ON DELETE SET NULL,
    chapter_number INTEGER,
    progress_percent NUMERIC(5,2),
    scroll_depth_percent NUMERIC(5,2),
    seconds_on_page INTEGER,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    local_timestamp TIMESTAMPTZ,
    page_url TEXT,
    arrived_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT user_behavior_chapter_progress_progress_check CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
    CONSTRAINT user_behavior_chapter_progress_scroll_check CHECK (scroll_depth_percent IS NULL OR (scroll_depth_percent >= 0 AND scroll_depth_percent <= 100)),
    CONSTRAINT user_behavior_chapter_progress_seconds_check CHECK (seconds_on_page IS NULL OR seconds_on_page >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ub_chapter_progress_session ON user_behavior_chapter_progress (user_id, series_id, chapter_id, session_id);
CREATE INDEX IF NOT EXISTS idx_ub_chapter_progress_user_series ON user_behavior_chapter_progress (user_id, series_id, arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_chapter_progress_completed_at ON user_behavior_chapter_progress (completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_chapter_progress_timezone ON user_behavior_chapter_progress (timezone);

CREATE TABLE IF NOT EXISTS user_behavior_work_abandonments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    last_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    last_chapter_number INTEGER,
    abandoned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    days_without_activity INTEGER NOT NULL DEFAULT 7,
    abandonment_source VARCHAR(24) NOT NULL DEFAULT 'cron',
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_ub_work_abandonments_user_abandoned_at ON user_behavior_work_abandonments (user_id, abandoned_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_work_abandonments_series_id ON user_behavior_work_abandonments (series_id);

CREATE TABLE IF NOT EXISTS user_behavior_reader_archetypes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reader_archetype reader_archetype_enum NOT NULL,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0,
    classification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    session_count INTEGER NOT NULL DEFAULT 0,
    weekend_session_count INTEGER NOT NULL DEFAULT 0,
    binge_session_count INTEGER NOT NULL DEFAULT 0,
    daily_active_days INTEGER NOT NULL DEFAULT 0,
    avg_chapters_per_session NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT user_behavior_reader_archetypes_confidence_range CHECK (confidence >= 0 AND confidence <= 1),
    UNIQUE(user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_ub_reader_archetypes_user_week ON user_behavior_reader_archetypes (user_id, week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_ub_reader_archetypes_classification_date ON user_behavior_reader_archetypes (classification_date DESC);

CREATE TABLE IF NOT EXISTS user_behavior_engagement_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    engagement_profile engagement_profile_enum NOT NULL,
    total_comments_30d INTEGER NOT NULL DEFAULT 0,
    total_ratings_30d INTEGER NOT NULL DEFAULT 0,
    reply_interactions_30d INTEGER NOT NULL DEFAULT 0,
    classification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, classification_date)
);

CREATE INDEX IF NOT EXISTS idx_ub_engagement_profiles_user_date ON user_behavior_engagement_profiles (user_id, classification_date DESC);

CREATE TABLE IF NOT EXISTS user_behavior_prime_time_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    prime_time_slot time_slot_enum NOT NULL,
    frequency_count INTEGER NOT NULL DEFAULT 0,
    classification_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, classification_date)
);

CREATE INDEX IF NOT EXISTS idx_ub_prime_time_user_date ON user_behavior_prime_time_profiles (user_id, classification_date DESC);

CREATE TABLE IF NOT EXISTS user_behavior_reading_speed_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    average_chapter_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
    samples_count INTEGER NOT NULL DEFAULT 0,
    reading_speed reading_speed_enum NOT NULL DEFAULT 'scrolleador',
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS user_behavior_work_reading_speed_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    average_chapter_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
    samples_count INTEGER NOT NULL DEFAULT 0,
    reading_speed reading_speed_enum NOT NULL DEFAULT 'scrolleador',
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, series_id)
);

CREATE TABLE IF NOT EXISTS user_behavior_search_queries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    query_normalized TEXT NOT NULL,
    result_clicked_series_id UUID REFERENCES series(id) ON DELETE SET NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    searched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ub_search_queries_user_searched_at ON user_behavior_search_queries (user_id, searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_search_queries_normalized ON user_behavior_search_queries (query_normalized);
CREATE INDEX IF NOT EXISTS idx_ub_search_queries_clicked_series ON user_behavior_search_queries (result_clicked_series_id);

CREATE TABLE IF NOT EXISTS global_behavior_search_queries (
    query_normalized TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    search_count INTEGER NOT NULL DEFAULT 1,
    click_count INTEGER NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ub_global_search_last_seen ON global_behavior_search_queries (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS user_behavior_recommendation_impressions (
    id BIGSERIAL PRIMARY KEY,
    impression_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommended_series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    source_algorithm VARCHAR(80) NOT NULL,
    banner_position INTEGER,
    shown_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    recommendation_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    clicked_at TIMESTAMPTZ,
    converted BOOLEAN NOT NULL DEFAULT FALSE,
    converted_at TIMESTAMPTZ,
    chapters_read_post_conversion INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ub_reco_impressions_user_shown_at ON user_behavior_recommendation_impressions (user_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_reco_impressions_series_id ON user_behavior_recommendation_impressions (recommended_series_id);
CREATE INDEX IF NOT EXISTS idx_ub_reco_impressions_algorithm_position ON user_behavior_recommendation_impressions (source_algorithm, banner_position);

CREATE TABLE IF NOT EXISTS user_behavior_recommendation_clicks (
    id BIGSERIAL PRIMARY KEY,
    impression_id UUID NOT NULL UNIQUE REFERENCES user_behavior_recommendation_impressions(impression_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommended_series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    chapters_read_post_conversion INTEGER NOT NULL DEFAULT 0,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ub_reco_clicks_user_clicked_at ON user_behavior_recommendation_clicks (user_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_reco_clicks_series_id ON user_behavior_recommendation_clicks (recommended_series_id);

CREATE TABLE IF NOT EXISTS user_behavior_recommendation_conversions (
    id BIGSERIAL PRIMARY KEY,
    impression_id UUID NOT NULL UNIQUE REFERENCES user_behavior_recommendation_impressions(impression_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommended_series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    converted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    chapters_read_post_conversion INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ub_reco_conversions_user_converted_at ON user_behavior_recommendation_conversions (user_id, converted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ub_reco_conversions_series_id ON user_behavior_recommendation_conversions (recommended_series_id);

CREATE TABLE IF NOT EXISTS user_behavior_summary (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reader_archetype reader_archetype_enum DEFAULT 'casual',
    reader_archetype_confidence NUMERIC(3,2) DEFAULT 0,
    reader_archetype_classified_at TIMESTAMPTZ,
    engagement_profile engagement_profile_enum DEFAULT 'lurker',
    engagement_profile_classified_at TIMESTAMPTZ,
    prime_time_slot time_slot_enum,
    prime_time_timezone VARCHAR(64),
    prime_time_frequency_count INTEGER DEFAULT 0,
    prime_time_classified_at TIMESTAMPTZ,
    reading_speed reading_speed_enum DEFAULT 'scrolleador',
    average_chapter_seconds NUMERIC(10,2) DEFAULT 0,
    speed_samples_count INTEGER DEFAULT 0,
    speed_classified_at TIMESTAMPTZ,
    top_genres JSONB NOT NULL DEFAULT '[]'::jsonb,
    top_tropes JSONB NOT NULL DEFAULT '[]'::jsonb,
    abandoned_works JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendation_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    session_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT user_behavior_summary_reader_archetype_confidence_range CHECK (reader_archetype_confidence >= 0 AND reader_archetype_confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_ub_summary_reader_archetype ON user_behavior_summary (reader_archetype);
CREATE INDEX IF NOT EXISTS idx_ub_summary_engagement_profile ON user_behavior_summary (engagement_profile);
CREATE INDEX IF NOT EXISTS idx_ub_summary_prime_time_slot ON user_behavior_summary (prime_time_slot);
CREATE INDEX IF NOT EXISTS idx_ub_summary_reading_speed ON user_behavior_summary (reading_speed);

DROP TRIGGER IF EXISTS trg_user_behavior_reading_sessions_updated_at ON user_behavior_reading_sessions;
CREATE TRIGGER trg_user_behavior_reading_sessions_updated_at BEFORE UPDATE ON user_behavior_reading_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_chapter_progress_updated_at ON user_behavior_chapter_progress;
CREATE TRIGGER trg_user_behavior_chapter_progress_updated_at BEFORE UPDATE ON user_behavior_chapter_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_work_abandonments_updated_at ON user_behavior_work_abandonments;
CREATE TRIGGER trg_user_behavior_work_abandonments_updated_at BEFORE UPDATE ON user_behavior_work_abandonments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_reader_archetypes_updated_at ON user_behavior_reader_archetypes;
CREATE TRIGGER trg_user_behavior_reader_archetypes_updated_at BEFORE UPDATE ON user_behavior_reader_archetypes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_engagement_profiles_updated_at ON user_behavior_engagement_profiles;
CREATE TRIGGER trg_user_behavior_engagement_profiles_updated_at BEFORE UPDATE ON user_behavior_engagement_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_prime_time_profiles_updated_at ON user_behavior_prime_time_profiles;
CREATE TRIGGER trg_user_behavior_prime_time_profiles_updated_at BEFORE UPDATE ON user_behavior_prime_time_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_reading_speed_profiles_updated_at ON user_behavior_reading_speed_profiles;
CREATE TRIGGER trg_user_behavior_reading_speed_profiles_updated_at BEFORE UPDATE ON user_behavior_reading_speed_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_work_reading_speed_profiles_updated_at ON user_behavior_work_reading_speed_profiles;
CREATE TRIGGER trg_user_behavior_work_reading_speed_profiles_updated_at BEFORE UPDATE ON user_behavior_work_reading_speed_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_search_queries_updated_at ON user_behavior_search_queries;
CREATE TRIGGER trg_user_behavior_search_queries_updated_at BEFORE UPDATE ON user_behavior_search_queries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_global_behavior_search_queries_updated_at ON global_behavior_search_queries;
CREATE TRIGGER trg_global_behavior_search_queries_updated_at BEFORE UPDATE ON global_behavior_search_queries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_recommendation_impressions_updated_at ON user_behavior_recommendation_impressions;
CREATE TRIGGER trg_user_behavior_recommendation_impressions_updated_at BEFORE UPDATE ON user_behavior_recommendation_impressions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_recommendation_clicks_updated_at ON user_behavior_recommendation_clicks;
CREATE TRIGGER trg_user_behavior_recommendation_clicks_updated_at BEFORE UPDATE ON user_behavior_recommendation_clicks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_recommendation_conversions_updated_at ON user_behavior_recommendation_conversions;
CREATE TRIGGER trg_user_behavior_recommendation_conversions_updated_at BEFORE UPDATE ON user_behavior_recommendation_conversions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_behavior_summary_updated_at ON user_behavior_summary;
CREATE TRIGGER trg_user_behavior_summary_updated_at BEFORE UPDATE ON user_behavior_summary FOR EACH ROW EXECUTE FUNCTION set_updated_at();
