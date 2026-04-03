/**
 * MIGRATION 005: Behavioral Tracking System
 * 
 * Sistema completo de recolección silenciosa de behavioral data para análisis de preferencias,
 * engagement y paterns de lectura.
 * 
 * Tablas:
 * - user_genre_preferences: Géneros dominantes por usuario (ponderado por tiempo)
 * - user_trope_preferences: Tropos/tags favoritos por usuario
 * - reading_sessions: Sesiones de lectura con scroll depth y tiempo
 * - chapter_progress: Progreso de lectura por capítulo
 * - work_completion_stats: Estadísticas de finalización por obra y usuario
 * - work_abandonment: Detección y registro de obras abandonadas
 * - work_rereads: Tracking de obras re-leídas
 * - user_behavior_events: Log de eventos raw para análisis
 */

-- ============================================
-- Tabla 1: Preferencias de Género por Usuario
-- ============================================
CREATE TABLE IF NOT EXISTS user_genre_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    
    -- Métricas ponderadas
    total_time_minutes DECIMAL(10,2) DEFAULT 0,        -- Tiempo total de lectura en este género
    weighted_score DECIMAL(8,4) DEFAULT 0,              -- Score ponderado por tiempo (0-1)
    view_count INTEGER DEFAULT 0,                       -- Número de veces que accedió al género
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Control de actualización
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_user_genre_preferences_user_id ON user_genre_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_genre_preferences_genre_id ON user_genre_preferences(genre_id);
CREATE INDEX IF NOT EXISTS idx_user_genre_preferences_weighted_score ON user_genre_preferences(user_id, weighted_score DESC);


-- ============================================
-- Tabla 2: Preferencias de Tropos/Tags por Usuario
-- ============================================
CREATE TABLE IF NOT EXISTS user_trope_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trope_name VARCHAR(100) NOT NULL,                   -- Ej: "Protagonista OP", "Venganza", etc
    
    -- Métricas de afinidad
    appearance_count INTEGER DEFAULT 0,                 -- Número de obras con este tropo que visitó
    total_time_minutes DECIMAL(10,2) DEFAULT 0,        -- Tiempo invertido en obras con este tropo
    afinidad_score DECIMAL(8,4) DEFAULT 0,              -- Score de afinidad (0-1)
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Control
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, trope_name)
);

CREATE INDEX IF NOT EXISTS idx_user_trope_preferences_user_id ON user_trope_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trope_preferences_afinidad_score ON user_trope_preferences(user_id, afinidad_score DESC);


-- ============================================
-- Tabla 3: Sesiones de Lectura
-- ============================================
CREATE TABLE IF NOT EXISTS reading_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    
    -- Duración y engagement
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    duration_seconds INTEGER,                           -- Duración total de la sesión
    scroll_depth_percent DECIMAL(5,2),                  -- Porcentaje de scroll en la página (0-100)
    
    -- Eventos
    total_interactions INTEGER DEFAULT 0,               -- Clics, scrolls, etc
    is_completed BOOLEAN DEFAULT FALSE,                 -- ¿Completó la lectura?
    exit_reason VARCHAR(50),                            -- 'completed', 'tab_closed', 'inactive', 'user_left'
    
    -- Control
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_id ON reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_work_id ON reading_sessions(work_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_chapter_id ON reading_sessions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_created_at ON reading_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_work ON reading_sessions(user_id, work_id, created_at DESC);


-- ============================================
-- Tabla 4: Progreso de Lectura por Capítulo
-- ============================================
CREATE TABLE IF NOT EXISTS chapter_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    
    -- Progreso
    chapters_read_count INTEGER DEFAULT 0,              -- Capítulos leídos de esta obra
    is_current_reading BOOLEAN DEFAULT FALSE,           -- ¿Es la lectura actual?
    last_read_chapter_number INTEGER,                   -- Número del último capítulo leído
    
    -- Estado
    status VARCHAR(50) DEFAULT 'reading',               -- 'reading', 'completed', 'abandoned'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Timestamps de abandono (para logic posterior)
    abandoned_at TIMESTAMP,
    days_without_activity INTEGER,                      -- Calculado: dias sin actividad en esta obra
    
    -- Control
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, work_id)
);

CREATE INDEX IF NOT EXISTS idx_chapter_progress_user_id ON chapter_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_work_id ON chapter_progress(work_id);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_status ON chapter_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_last_read_at ON chapter_progress(user_id, last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapter_progress_abandoned ON chapter_progress(user_id, status, last_read_at) WHERE status = 'abandoned';


-- ============================================
-- Tabla 5: Estadísticas de Finalización por Obra
-- ============================================
CREATE TABLE IF NOT EXISTS work_completion_stats (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    
    -- Estadísticas de finalización
    total_chapters_available INTEGER NOT NULL,          -- Total de capítulos disponibles en la obra
    chapters_read INTEGER DEFAULT 0,                    -- Capítulos leídos por el usuario
    completion_percentage DECIMAL(5,2) DEFAULT 0,       -- Porcentaje de finalización (0-100)
    completion_ratio DECIMAL(3,2) DEFAULT 0,            -- Ratio flotante (0.0-1.0)
    
    -- Timeline
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    total_time_minutes DECIMAL(10,2) DEFAULT 0,        -- Tiempo total invertido en la obra
    
    -- Estado actual
    is_completed BOOLEAN DEFAULT FALSE,
    is_current BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'reading',
    
    -- Control
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, work_id)
);

CREATE INDEX IF NOT EXISTS idx_work_completion_stats_user_id ON work_completion_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_work_completion_stats_work_id ON work_completion_stats(work_id);
CREATE INDEX IF NOT EXISTS idx_work_completion_stats_completion ON work_completion_stats(user_id, completion_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_work_completion_stats_status ON work_completion_stats(user_id, status);


-- ============================================
-- Tabla 6: Obras Abandonadas (Drop-off Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS work_abandonment (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    
    -- Punto de abandono
    last_chapter_read UUID REFERENCES chapters(id) ON DELETE SET NULL,
    last_chapter_number INTEGER NOT NULL DEFAULT 0,     -- Número del capítulo donde paró
    total_chapters_available INTEGER NOT NULL,          -- Total de capítulos disponibles al momento
    abandonment_percentage DECIMAL(5,2),                -- Porcentaje leído cuando abandonó
    
    -- Timeline
    started_at TIMESTAMP NOT NULL,
    last_access TIMESTAMP NOT NULL,
    days_without_activity INTEGER DEFAULT 0,            -- 7+ días sin actividad se considera abandono
    detection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Fecha en que se detectó el abandono
    
    -- Razón probable (extraída de comportamiento)
    abandonment_reason VARCHAR(100),                    -- 'long_gap', 'slope_change', 'quality_drop'
    confidence_score DECIMAL(3,2) DEFAULT 0.5,          -- Confianza en que fue realmente abandonado
    
    -- Control
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, work_id)
);

CREATE INDEX IF NOT EXISTS idx_work_abandonment_user_id ON work_abandonment(user_id);
CREATE INDEX IF NOT EXISTS idx_work_abandonment_work_id ON work_abandonment(work_id);
CREATE INDEX IF NOT EXISTS idx_work_abandonment_last_access ON work_abandonment(user_id, last_access DESC);
CREATE INDEX IF NOT EXISTS idx_work_abandonment_detection ON work_abandonment(user_id, detection_date DESC);


-- ============================================
-- Tabla 7: Obras Re-leídas
-- ============================================
CREATE TABLE IF NOT EXISTS work_rereads (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    
    -- Relectura
    first_completion_date TIMESTAMP NOT NULL,           -- Primera vez que completó la obra
    reread_count INTEGER DEFAULT 0,                     -- Número de veces re-leída (sin contar primera)
    
    -- Timeline de relecturas
    last_reread_date TIMESTAMP,                         -- Última fecha de reenganche
    days_since_first_completion INTEGER,                -- Días entre primer completion y ahora
    avg_days_between_rereads DECIMAL(8,2),              -- Promedio de días entre relecturas
    
    -- Control
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, work_id)
);

CREATE INDEX IF NOT EXISTS idx_work_rereads_user_id ON work_rereads(user_id);
CREATE INDEX IF NOT EXISTS idx_work_rereads_work_id ON work_rereads(work_id);
CREATE INDEX IF NOT EXISTS idx_work_rereads_last_reread ON work_rereads(user_id, last_reread_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_rereads_reread_count ON work_rereads(user_id, reread_count DESC);


-- ============================================
-- Tabla 8: Log Raw de Eventos de Comportamiento
-- (Para análisis posteriores y debugging)
-- ============================================
CREATE TABLE IF NOT EXISTS user_behavior_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_id UUID REFERENCES series(id) ON DELETE SET NULL,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    
    -- Evento
    event_type VARCHAR(50) NOT NULL,                    -- 'page_load', 'scroll', 'chapter_change', 'session_end', 'tab_close'
    event_metadata JSONB,                               -- Datos adicionales del evento (flexible)
    
    -- Contexto
    session_id VARCHAR(100),                            -- ID de sesión para correlacionar eventos
    user_agent_hash VARCHAR(64),                        -- Hash del user agent (sin datos sensibles)
    
    -- Control
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Para análisis históricos (usar particionamiento si crece mucho)
    CONSTRAINT event_type_valid CHECK (event_type IN (
        'page_load', 'scroll', 'chapter_change', 'session_start', 'session_end', 
        'tab_close', 'inactivity', 'progress_update'
    ))
);

CREATE INDEX IF NOT EXISTS idx_user_behavior_events_user_id ON user_behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_work_id ON user_behavior_events(work_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_created_at ON user_behavior_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_session_id ON user_behavior_events(session_id);


-- ============================================
-- VISTA: Resumen de Preferencias por Usuario (Top 3 géneros)
-- ============================================
CREATE OR REPLACE VIEW user_top_genres AS
SELECT 
    user_id,
    genre_id,
    weighted_score,
    view_count,
    total_time_minutes,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY weighted_score DESC) as rank
FROM user_genre_preferences
WHERE user_id IS NOT NULL;


-- ============================================
-- VISTA: Resumen de Tropos por Usuario (Top 5)
-- ============================================
CREATE OR REPLACE VIEW user_top_tropes AS
SELECT 
    user_id,
    trope_name,
    afinidad_score,
    appearance_count,
    total_time_minutes,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY afinidad_score DESC) as rank
FROM user_trope_preferences
WHERE user_id IS NOT NULL;


-- ============================================
-- VISTA: Obras Completadas vs Abandonadas por Usuario
-- ============================================
CREATE OR REPLACE VIEW user_work_status_summary AS
SELECT 
    user_id,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_works,
    COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_works,
    COUNT(*) FILTER (WHERE status = 'reading') as reading_works,
    AVG(completion_percentage) FILTER (WHERE status = 'completed') as avg_completion_completed,
    AVG(completion_percentage) FILTER (WHERE status = 'abandoned') as avg_completion_abandoned
FROM work_completion_stats
GROUP BY user_id;


-- ============================================
-- Comentario de Versionado
-- ============================================
/*
VERSION: 1.0
AUTHOR: Analytics Team
DATE: 2026-04-03
DESCRIPTION: Sistema completo de behavioral tracking para análisis de preferencias,
             engagement y patrones de lectura. Optimizado para queries rápidas (<100ms).
             
PERFORMANCE TARGETS:
- Event ingestion: <100ms (POST endpoints)
- Query agregaciones: <500ms
- Index coverage: 100% de queries de filtrado
*/
