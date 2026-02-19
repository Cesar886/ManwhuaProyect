-- Migration: Add chapter ratings system
-- Tabla para votos de capítulos individuales (1-5 estrellas)
-- Usa visitor_id (FingerprintJS) para identificación sin login

-- Tabla de ratings de capítulos
CREATE TABLE IF NOT EXISTS chapter_ratings (
    id SERIAL PRIMARY KEY,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    visitor_id VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chapter_id, visitor_id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_chapter_ratings_chapter_id ON chapter_ratings(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_ratings_visitor_id ON chapter_ratings(visitor_id);

-- Agregar columnas de rating a la tabla de capítulos (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chapters' AND column_name = 'rating'
    ) THEN
        ALTER TABLE chapters ADD COLUMN rating DECIMAL(3,2) DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chapters' AND column_name = 'rating_count'
    ) THEN
        ALTER TABLE chapters ADD COLUMN rating_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- También asegurar que series_ratings existe con visitor_id (para votación sin login)
CREATE TABLE IF NOT EXISTS series_ratings (
    id SERIAL PRIMARY KEY,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    visitor_id VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(series_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_series_ratings_series_id ON series_ratings(series_id);
CREATE INDEX IF NOT EXISTS idx_series_ratings_visitor_id ON series_ratings(visitor_id);
