-- =============================================
-- APLICAR ÍNDICES CRÍTICOS - ejecutar como postgres
-- psql -h 173.249.49.125 -U postgres -d manhwa_db -f db/apply_indexes.sql
-- =============================================

-- Serie por slug (lookup más frecuente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_slug
ON series(slug);

-- Fallback query + ORDER BY updated_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_updated_at
ON series(updated_at DESC)
WHERE deleted_at IS NULL;

-- Géneros por serie (LATERAL JOIN en seriesToArray y getManhwaFromSpaces)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_genres
ON series_genres(series_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_genres_series
ON series_genres(genre_id);

-- Series por último capítulo (listSeries ORDER BY)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_last_chapter
ON series(last_chapter_at DESC NULLS LAST);

-- Capítulos publicados por serie
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_series_number
ON chapters(series_id, number DESC)
WHERE is_published = true;

-- Actualizar estadísticas del planificador
ANALYZE series;
ANALYZE series_genres;
ANALYZE genres;
ANALYZE chapters;

SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN (
  'idx_series_slug', 'idx_series_updated_at',
  'idx_series_genres', 'idx_genres_series',
  'idx_series_last_chapter', 'idx_chapters_series_number'
)
ORDER BY tablename, indexname;
