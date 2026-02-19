-- ============================================
-- SCRIPT DE OPTIMIZACIÓN DE ÍNDICES
-- Para mejorar rendimiento de queries frecuentes
-- ============================================

-- Índice para autenticación de usuarios (query más frecuente)
-- Optimiza: SELECT ... FROM users WHERE id = $1 AND deleted_at IS NULL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_deleted 
ON users (id) 
WHERE deleted_at IS NULL;

-- Índice para búsqueda por username/email (login y registro)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_lower 
ON users (LOWER(username)) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users (LOWER(email)) 
WHERE deleted_at IS NULL;

-- Índice compuesto para usuarios activos (autenticación opcional)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active 
ON users (id) 
WHERE deleted_at IS NULL AND status = 'active';

-- ============================================
-- ÍNDICES PARA SERIES (consultas de listado)
-- ============================================

-- Índice para ordenamiento por última actualización
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_last_chapter 
ON series (last_chapter_at DESC NULLS LAST) 
WHERE deleted_at IS NULL;

-- Índice para búsqueda por slug
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_slug 
ON series (slug) 
WHERE deleted_at IS NULL;

-- Índice para series publicadas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_series_published 
ON series (id) 
WHERE is_published = true AND deleted_at IS NULL;

-- ============================================
-- ÍNDICES PARA CAPÍTULOS
-- ============================================

-- Índice para capítulos por serie
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_series_published 
ON chapters (series_id, number DESC) 
WHERE is_published = true;

-- Índice para búsqueda de capítulo específico
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_series_number 
ON chapters (series_id, number);

-- ============================================
-- ÍNDICES PARA COMENTARIOS
-- ============================================

-- Índice para comentarios por serie/capítulo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_series 
ON comments (series_id, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_chapter 
ON comments (chapter_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- ============================================
-- ÍNDICES PARA BOOKMARKS
-- ============================================

-- Índice para bookmarks por usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_user 
ON bookmarks (user_id, created_at DESC);

-- ============================================
-- CONFIGURACIÓN DE POSTGRESQL
-- Ejecutar con superusuario
-- ============================================

-- Aumentar work_mem para operaciones de ordenamiento
-- ALTER SYSTEM SET work_mem = '256MB';

-- Aumentar shared_buffers (requiere restart)
-- ALTER SYSTEM SET shared_buffers = '1GB';

-- Estadísticas más precisas para el planificador
-- ALTER SYSTEM SET default_statistics_target = 200;

-- Aplicar cambios de configuración (sin restart)
-- SELECT pg_reload_conf();

-- ============================================
-- VERIFICAR ÍNDICES CREADOS
-- ============================================
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('users', 'series', 'chapters', 'comments', 'bookmarks')
-- ORDER BY tablename, indexname;

-- ============================================
-- ANALIZAR TABLAS DESPUÉS DE CREAR ÍNDICES
-- ============================================
ANALYZE users;
ANALYZE series;
ANALYZE chapters;
ANALYZE comments;
ANALYZE bookmarks;
