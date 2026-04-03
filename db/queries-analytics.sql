/**
 * QUERIES DE ANALYTICS - Ejemplos Útiles
 * 
 * Queries SQL listos para copiar/ejecutar directamente en psql
 * para análisis, debugging y exploración de datos
 * 
 * Ejecutar con: psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f queries.sql
 */

-- ============================================
-- 1. VERIFICAR DATOS CAPTURADOS
-- ============================================

-- Contar eventos totales por usuario (últimos 7 días)
SELECT 
    user_id,
    COUNT(*) as event_count,
    COUNT(DISTINCT event_type) as event_types,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event
FROM user_behavior_events
WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days')
GROUP BY user_id
ORDER BY event_count DESC
LIMIT 20;


-- Tipo de eventos más comunes
SELECT 
    event_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM user_behavior_events
GROUP BY event_type
ORDER BY count DESC;


-- Sesiones de lectura por usuario (últimos 7 días)
SELECT 
    user_id,
    COUNT(*) as sessions,
    ROUND(AVG(duration_seconds)::numeric / 60, 1) as avg_duration_minutes,
    ROUND(AVG(scroll_depth_percent)::numeric, 1) as avg_scroll_depth,
    COUNT(*) FILTER (WHERE is_completed) as completed_sessions,
    MAX(created_at) as last_session
FROM reading_sessions
WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days')
GROUP BY user_id
ORDER BY sessions DESC
LIMIT 20;


-- ============================================
-- 2. PREFERENCIAS DE USUARIO
-- ============================================

-- Top 5 géneros por usuario con scores detallados
SELECT 
    user_id,
    genre_id,
    (SELECT name FROM genres WHERE id = genre_id) as genre_name,
    weighted_score,
    total_time_minutes,
    view_count,
    ROUND((total_time_minutes::numeric / SUM(total_time_minutes) OVER (PARTITION BY user_id) * 100), 2) as pct_of_user_time
FROM user_genre_preferences
WHERE user_id = 'uuid-del-usuario-aqui'
ORDER BY weighted_score DESC;


-- Tropos favoritos por usuario
SELECT 
    user_id,
    trope_name,
    afinidad_score,
    appearance_count,
    total_time_minutes,
    ROUND((total_time_minutes::numeric / SUM(total_time_minutes) OVER (PARTITION BY user_id) * 100), 2) as pct_of_time
FROM user_trope_preferences
WHERE user_id = 'uuid-del-usuario-aqui'
ORDER BY afinidad_score DESC;


-- ============================================
-- 3. ANÁLISIS DE FINALIZACIÓN
-- ============================================

-- Distribución de tasas de finalización
SELECT 
    CASE 
        WHEN completion_percentage < 25 THEN '0-25%'
        WHEN completion_percentage < 50 THEN '25-50%'
        WHEN completion_percentage < 75 THEN '50-75%'
        WHEN completion_percentage < 100 THEN '75-99%'
        ELSE '100%'
    END as completion_bucket,
    COUNT(*) as work_count,
    ROUND(AVG(total_time_minutes)::numeric, 2) as avg_time_invested,
    ROUND(AVG(completion_percentage)::numeric, 2) as avg_completion
FROM work_completion_stats
GROUP BY completion_bucket
ORDER BY completion_bucket;


-- Top 10 obras por tasa de finalización
SELECT 
    wcs.work_id,
    s.title,
    s.slug,
    COUNT(DISTINCT wcs.user_id) as num_readers,
    ROUND(AVG(wcs.completion_percentage)::numeric, 2) as avg_completion,
    COUNT(*) FILTER (WHERE wcs.is_completed) as completions,
    ROUND(
        (COUNT(*) FILTER (WHERE wcs.is_completed)::numeric / COUNT(*) * 100)::numeric, 2
    ) as completion_rate
FROM work_completion_stats wcs
JOIN series s ON wcs.work_id = s.id
GROUP BY wcs.work_id, s.title, s.slug
HAVING COUNT(DISTINCT wcs.user_id) >= 3  -- Al menos 3 lectores
ORDER BY completion_rate DESC
LIMIT 10;


-- ============================================
-- 4. ANÁLISIS DE ABANDONO
-- ============================================

-- Obras con mayor tasa de abandono
SELECT 
    wa.work_id,
    s.title,
    COUNT(DISTINCT wa.user_id) as users_abandoned,
    ROUND(AVG(wa.abandonment_percentage)::numeric, 2) as avg_abandon_point,
    ROUND(AVG(wa.days_without_activity)::numeric, 0) as avg_days_inactive,
    -- Comparar con intentos totales
    (
        SELECT COUNT(DISTINCT user_id)
        FROM chapter_progress
        WHERE work_id = wa.work_id
    ) as total_readers,
    ROUND(
        (COUNT(DISTINCT wa.user_id)::numeric / 
         (SELECT COUNT(DISTINCT user_id) FROM chapter_progress WHERE work_id = wa.work_id)
         * 100)::numeric, 2
    ) as abandonment_rate
FROM work_abandonment wa
JOIN series s ON wa.work_id = s.id
GROUP BY wa.work_id, s.title
HAVING COUNT(DISTINCT wa.user_id) >= 2
ORDER BY abandonment_rate DESC
LIMIT 10;


-- Patrones de abandono (en qué capítulo caen)
SELECT 
    wa.last_chapter_number,
    COUNT(DISTINCT wa.user_id) as users_abandoned_here,
    ROUND(AVG(wa.abandonment_percentage)::numeric, 2) as avg_progression
FROM work_abandonment wa
GROUP BY wa.last_chapter_number
ORDER BY users_abandoned_here DESC
LIMIT 20;


-- ============================================
-- 5. ANÁLISIS DE RELECTURA
-- ============================================

-- Obras con mayor potencial de relectura
SELECT 
    wr.work_id,
    s.title,
    wr.reread_count,
    ROUND(wr.avg_days_between_rereads::numeric, 0) as days_between_rereads,
    wr.last_reread_date,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - wr.last_reread_date))::integer as days_since_reread
FROM work_rereads wr
JOIN series s ON wr.work_id = s.id
ORDER BY wr.reread_count DESC
LIMIT 15;


-- Usuarios más fieles (releer obras)
SELECT 
    user_id,
    COUNT(*) as rereads_total,
    AVG(reread_count) as avg_rereads_per_work,
    MAX(reread_count) as max_rereads_single_work
FROM work_rereads
GROUP BY user_id
ORDER BY rereads_total DESC
LIMIT 10;


-- ============================================
-- 6. ANÁLISIS DE TIEMPO INVERTIDO
-- ============================================

-- Usuarios más activos (tiempo total)
SELECT 
    cp.user_id,
    COUNT(DISTINCT cp.work_id) as works_reading,
    ROUND(SUM(wcs.total_time_minutes)::numeric / 60, 1) as total_hours,
    ROUND(AVG(wcs.total_time_minutes)::numeric, 1) as avg_minutes_per_work,
    MAX(cp.last_read_at) as last_activity
FROM chapter_progress cp
LEFT JOIN work_completion_stats wcs ON cp.user_id = wcs.user_id AND cp.work_id = wcs.work_id
GROUP BY cp.user_id
HAVING COUNT(DISTINCT cp.work_id) >= 2
ORDER BY total_hours DESC
LIMIT 20;


-- Tiempo promedio por género para este usuario
SELECT 
    (SELECT name FROM genres g WHERE g.id = ugp.genre_id) as genre,
    ugp.total_time_minutes,
    ugp.view_count,
    ROUND((ugp.total_time_minutes::numeric / ugp.view_count), 1) as avg_minutes_per_view
FROM user_genre_preferences ugp
WHERE ugp.user_id = 'uuid-aqui'
ORDER BY ugp.total_time_minutes DESC;


-- ============================================
-- 7. ENGAGEMENT SCORING
-- ============================================

-- Calcular "Engagement Score" por usuario
SELECT 
    wcs.user_id,
    -- Número de obras terminadas
    COUNT(DISTINCT wcs.work_id) FILTER (WHERE wcs.is_completed) as works_completed,
    -- Proporción de finalización promedio
    ROUND(AVG(wcs.completion_percentage)::numeric, 2) as avg_completion,
    -- Tiempo invertido
    ROUND(SUM(wcs.total_time_minutes)::numeric / 60, 1) as total_hours,
    -- Relecturas (bonus engagement)
    COALESCE((SELECT COUNT(*) FROM work_rereads WHERE user_id = wcs.user_id), 0) as reread_works,
    -- ENGAGEMENT SCORE FINAL (0-100)
    ROUND(
        (
            LEAST(COUNT(DISTINCT wcs.work_id) FILTER (WHERE wcs.is_completed), 10) * 2 +  -- Max 20pts
            AVG(wcs.completion_percentage) +  -- 0-100pts
            LEAST(SUM(wcs.total_time_minutes) / 60, 50) +  -- Max 50pts (50h)
            COALESCE((SELECT COUNT(*) FROM work_rereads WHERE user_id = wcs.user_id), 0) * 5  -- 5pts per reread
        ) / 1.75
        ::numeric, 2)
    )::float as engagement_score
FROM work_completion_stats wcs
GROUP BY wcs.user_id
ORDER BY engagement_score DESC
LIMIT 20;


-- ============================================
-- 8. COHORT ANALYSIS (Segmentación de usuarios)
-- ============================================

-- Segmentar usuarios por comportamiento
WITH user_segments AS (
    SELECT 
        cp.user_id,
        COUNT(DISTINCT cp.work_id) as works_reading,
        COUNT(DISTINCT cp.work_id) FILTER (WHERE cp.status = 'completed') as works_completed,
        ROUND(AVG(wcs.completion_percentage)::numeric, 2) as avg_completion,
        MAX(cp.last_read_at) as last_activity
    FROM chapter_progress cp
    LEFT JOIN work_completion_stats wcs ON cp.user_id = wcs.user_id AND cp.work_id = wcs.work_id
    GROUP BY cp.user_id
)
SELECT 
    CASE 
        WHEN works_completed >= 20 AND avg_completion >= 80 THEN 'High Loyalty'
        WHEN works_completed >= 10 AND avg_completion >= 60 THEN 'Regular'
        WHEN works_reading >= 5 THEN 'Active Explorer'
        WHEN (CURRENT_TIMESTAMP - last_activity) > INTERVAL '30 days' THEN 'Dormant'
        ELSE 'Casual'
    END as user_segment,
    COUNT(*) as user_count,
    ROUND(AVG(works_reading)::numeric, 1) as avg_works_reading,
    ROUND(AVG(works_completed)::numeric, 1) as avg_works_completed,
    ROUND(AVG(avg_completion)::numeric, 2) as avg_completion_pct
FROM user_segments
GROUP BY user_segment
ORDER BY user_count DESC;


-- ============================================
-- 9. QUALITY SIGNALS (Detectar problemas en obras)
-- ============================================

-- Obras con posible drop de calidad (abandono aumentando)
SELECT 
    s.id,
    s.title,
    COUNT(DISTINCT wa.user_id) as users_abandoned,
    ROUND(AVG(wa.last_chapter_number)::numeric, 1) as avg_abandon_chapter,
    ROUND(AVG(wa.abandonment_percentage)::numeric, 2) as avg_progress,
    -- Si muchos abandonan en el mismo capítulo ≈ problema de calidad
    STDDEV_POP(wa.last_chapter_number) as stddev_abandon_point
FROM work_abandonment wa
JOIN series s ON wa.work_id = s.id
GROUP BY s.id, s.title
HAVING COUNT(DISTINCT wa.user_id) >= 3 AND STDDEV_POP(wa.last_chapter_number) < 5  -- Abandonan en punto similar
ORDER BY users_abandoned DESC
LIMIT 10;


-- ============================================
-- 10. PERFORMANCE MONITORING
-- ============================================

-- Tamaño de tablas de tracking
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    (SELECT count(*) FROM pg_class WHERE oid = (schemaname||'.'||tablename)::regclass) as row_count
FROM pg_tables
WHERE tablename LIKE '%behavioral%' 
   OR tablename LIKE '%progress%' 
   OR tablename LIKE '%abandonment%'
   OR tablename LIKE '%reread%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;


-- Índices disponibles y su tamaño
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%tracking%'
   OR indexname LIKE '%progress%'
   OR indexname LIKE '%genre%'
   OR indexname LIKE '%trope%'
ORDER BY pg_relation_size(indexrelid) DESC;


-- ============================================
-- 11. QUERIES PARA DEBUGGING
-- ============================================

-- Verificar completitud de datos (últimas 24h)
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT work_id) as works_involved,
    COUNT(DISTINCT event_type) as event_types
FROM user_behavior_events
WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '24 hours')
GROUP BY hour
ORDER BY hour DESC;


-- Verificar que reading_sessions se está guardando correctamente
SELECT 
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE is_completed) as completed,
    ROUND(AVG(duration_seconds)::numeric / 60, 1) as avg_duration_min,
    ROUND(AVG(scroll_depth_percent)::numeric, 1) as avg_scroll_depth,
    MAX(created_at) as last_session
FROM reading_sessions
WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '24 hours');


-- Datos más recientes de un usuario específico
SELECT 
    'reading_sessions' as table_name,
    MAX(created_at) as last_data,
    COUNT(*) as record_count
FROM reading_sessions
WHERE user_id = 'uuid-aqui'
UNION ALL
SELECT 
    'chapter_progress',
    MAX(updated_at),
    COUNT(*)
FROM chapter_progress
WHERE user_id = 'uuid-aqui'
UNION ALL
SELECT 
    'user_behavior_events',
    MAX(created_at),
    COUNT(*)
FROM user_behavior_events
WHERE user_id = 'uuid-aqui';


-- ============================================
-- 12. MANTENIMIENTO
-- ============================================

-- Limpiar eventos viejos (> 6 meses)
-- DELETE FROM user_behavior_events
-- WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '6 months');

-- Vacuum y analyze para optimizar
-- VACUUM ANALYZE user_genre_preferences, user_trope_preferences, chapter_progress;

-- Recalcular estadísticas si los scores se vuelven inconsistentes
-- Ejecutar el comando de backend: POST /tracking/detect-abandoned y /tracking/detect-rereads
