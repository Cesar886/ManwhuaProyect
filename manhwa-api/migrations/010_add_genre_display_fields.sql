BEGIN;

ALTER TABLE genres
    ADD COLUMN IF NOT EXISTS icon VARCHAR(100),
    ADD COLUMN IF NOT EXISTS color VARCHAR(20);


CREATE TABLE IF NOT EXISTS ratings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_series_id ON ratings(series_id);

CREATE TABLE IF NOT EXISTS series_ratings (
    id BIGSERIAL PRIMARY KEY,
    visitor_id VARCHAR(255) NOT NULL,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (series_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_series_ratings_series_id ON series_ratings(series_id);


ALTER TABLE series_views
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);

CREATE TABLE IF NOT EXISTS merch_afiliados (
    id BIGSERIAL PRIMARY KEY,
    serie_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    img_url TEXT,
    link_afiliado TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merch_afiliados_serie_id ON merch_afiliados(serie_id);

COMMIT;
