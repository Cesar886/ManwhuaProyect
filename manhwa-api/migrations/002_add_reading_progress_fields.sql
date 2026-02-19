-- Migración: Agregar campos de progreso de lectura detallado
-- Fecha: 2026-02-12
-- Descripción: Agrega campos para sincronizar progreso de lectura entre dispositivos

-- Agregar columnas de progreso a reading_history (si no existen)
ALTER TABLE reading_history
ADD COLUMN IF NOT EXISTS scroll_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS device_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Actualizar índices para mejorar performance de queries de progreso
CREATE INDEX IF NOT EXISTS idx_reading_history_user_series_chapter
ON reading_history(user_id, series_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_reading_history_synced_at
ON reading_history(user_id, synced_at DESC);

-- Crear tabla para tracking de dispositivos (opcional, para estadísticas)
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'mobile', 'tablet', 'desktop'
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id
ON user_devices(user_id);

-- Comentarios de las nuevas columnas
COMMENT ON COLUMN reading_history.scroll_position IS 'Posición de scroll en pixels';
COMMENT ON COLUMN reading_history.progress_percentage IS 'Progreso de lectura en porcentaje (0-100)';
COMMENT ON COLUMN reading_history.total_pages IS 'Número total de páginas del capítulo';
COMMENT ON COLUMN reading_history.device_id IS 'ID único del dispositivo que guardó el progreso';
COMMENT ON COLUMN reading_history.synced_at IS 'Última vez que se sincronizó el progreso';

COMMENT ON TABLE user_devices IS 'Tabla para tracking de dispositivos de usuarios';
