-- ============================================
-- ÍNDICES OPTIMIZADOS PARA MANHWA API
-- ============================================
-- Ejecutar: psql -d manhwa_db -f optimize_queries.sql
-- O desde pgAdmin/DBeaver

-- ============================================
-- 1. ÍNDICES PARA AUTENTICACIÓN (Críticos)
-- ============================================
-- Las queries de auth son las más frecuentes
-- Objetivo: < 50ms por query

-- Índice principal para búsqueda por ID (usado en JWT validation)
CREATE INDEX IF NOT EXISTS idx_users_id_active 
ON users(id) 
WHERE deleted_at IS NULL;

-- Índice para login por email
CREATE INDEX IF NOT EXISTS idx_users_email_active 
ON users(email) 
WHERE deleted_at IS NULL;

-- Índice para login por username
CREATE INDEX IF NOT EXISTS idx_users_username_active 
ON users(username) 
WHERE deleted_at IS NULL;

-- Índice compuesto para verificación de estado + premium
CREATE INDEX IF NOT EXISTS idx_users_status_premium 
ON users(status, is_premium) 
WHERE deleted_at IS NULL;

-- ============================================
-- 2. ÍNDICES PARA SERIES
-- ============================================

-- Búsqueda por slug (muy frecuente)
CREATE INDEX IF NOT EXISTS idx_series_slug 
ON series(slug);

-- Listado de series populares
CREATE INDEX IF NOT EXISTS idx_series_view_count 
ON series(view_count DESC) 
WHERE status = 'ongoing';

-- Series por fecha de actualización
CREATE INDEX IF NOT EXISTS idx_series_last_chapter
ON series(last_chapter_at DESC NULLS LAST);

-- Fallback query: ORDER BY updated_at DESC WHERE deleted_at IS NULL
-- Elimina full table scan + sort en listManhwasFromDatabase y getSeriesFromDatabase
CREATE INDEX IF NOT EXISTS idx_series_updated_at
ON series(updated_at DESC)
WHERE deleted_at IS NULL;

-- Búsqueda por título (full-text search preparado)
CREATE INDEX IF NOT EXISTS idx_series_title_trgm 
ON series USING gin(title gin_trgm_ops);

-- Para que funcione el índice trigram:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 3. ÍNDICES PARA CAPÍTULOS
-- ============================================

-- Listado de capítulos por serie
CREATE INDEX IF NOT EXISTS idx_chapters_series_number 
ON chapters(series_id, number DESC) 
WHERE is_published = true;

-- Búsqueda por slug de capítulo
CREATE INDEX IF NOT EXISTS idx_chapters_slug 
ON chapters(slug);

-- Capítulos recientes
CREATE INDEX IF NOT EXISTS idx_chapters_published_at 
ON chapters(published_at DESC) 
WHERE is_published = true;

-- ============================================
-- 4. ÍNDICES PARA PÁGINAS DE CAPÍTULO
-- ============================================

-- Páginas ordenadas por número
CREATE INDEX IF NOT EXISTS idx_chapter_pages_order 
ON chapter_pages(chapter_id, page_number);

-- ============================================
-- 5. ÍNDICES PARA COMENTARIOS
-- ============================================

-- Comentarios por serie
CREATE INDEX IF NOT EXISTS idx_comments_series 
ON comments(series_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Comentarios por capítulo
CREATE INDEX IF NOT EXISTS idx_comments_chapter 
ON comments(chapter_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Comentarios por usuario
CREATE INDEX IF NOT EXISTS idx_comments_user 
ON comments(user_id, created_at DESC);

-- ============================================
-- 6. ÍNDICES PARA BOOKMARKS
-- ============================================

-- Bookmarks por usuario
CREATE INDEX IF NOT EXISTS idx_bookmarks_user 
ON bookmarks(user_id, created_at DESC);

-- Verificación de bookmark existente
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_series 
ON bookmarks(user_id, series_id);

-- ============================================
-- 7. ÍNDICES PARA COLECCIONES
-- ============================================

-- Colecciones por usuario
CREATE INDEX IF NOT EXISTS idx_collections_user 
ON collections(user_id, created_at DESC);

-- Series en colección
CREATE INDEX IF NOT EXISTS idx_collection_series 
ON collection_series(collection_id, series_id);

-- ============================================
-- 8. ÍNDICES PARA SOLICITUDES (REQUESTS)
-- ============================================

-- Solicitudes pendientes
CREATE INDEX IF NOT EXISTS idx_requests_status 
ON requests(status, created_at DESC);

-- Solicitudes por usuario
CREATE INDEX IF NOT EXISTS idx_requests_user 
ON requests(user_id, created_at DESC);

-- ============================================
-- 9. ÍNDICES PARA GÉNEROS
-- ============================================

-- Géneros por serie
CREATE INDEX IF NOT EXISTS idx_series_genres 
ON series_genres(series_id);

CREATE INDEX IF NOT EXISTS idx_genres_series 
ON series_genres(genre_id);

-- ============================================
-- 10. ÍNDICES PARA SESIONES/TOKENS
-- ============================================

-- Tokens de refresh por usuario
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user 
ON refresh_tokens(user_id) 
WHERE revoked_at IS NULL;

-- Limpieza de tokens expirados
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires 
ON refresh_tokens(expires_at) 
WHERE revoked_at IS NULL;

-- ============================================
-- OPTIMIZACIONES ADICIONALES
-- ============================================

-- Actualizar estadísticas para el planificador
ANALYZE users;
ANALYZE series;
ANALYZE chapters;
ANALYZE chapter_pages;
ANALYZE comments;
ANALYZE bookmarks;

-- ============================================
-- VERIFICACIÓN DE ÍNDICES
-- ============================================
-- Ejecutar después de crear índices para verificar

-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_indexes 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;

-- ============================================
-- MONITOREO DE QUERIES LENTAS
-- ============================================
-- Configurar en postgresql.conf:
-- 
-- log_min_duration_statement = 100  # Log queries > 100ms
-- shared_preload_libraries = 'pg_stat_statements'
-- 
-- Luego:
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- 
-- Ver queries lentas:
-- SELECT 
--     calls,
--     mean_exec_time::numeric(10,2) as avg_ms,
--     total_exec_time::numeric(10,2) as total_ms,
--     query
-- FROM pg_stat_statements 
-- ORDER BY mean_exec_time DESC 
-- LIMIT 20;
