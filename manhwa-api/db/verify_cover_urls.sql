-- ============================================
-- Script para verificar y corregir cover_url
-- ============================================

-- 1. Ver el estado actual de las cover_url
SELECT 
    id, 
    slug, 
    title,
    CASE 
        WHEN cover_url IS NULL THEN '❌ NULL'
        WHEN cover_url LIKE 'https://%' THEN '✅ URL completa'
        WHEN cover_url LIKE 'http://%' THEN '⚠️ HTTP (no HTTPS)'
        ELSE '❌ Ruta relativa'
    END as estado,
    LENGTH(cover_url) as longitud_url,
    cover_url
FROM series 
WHERE deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 20;

-- 2. Contar por tipo de URL
SELECT 
    CASE 
        WHEN cover_url IS NULL THEN 'NULL'
        WHEN cover_url LIKE 'https://%' THEN 'URL completa (HTTPS)'
        WHEN cover_url LIKE 'http://%' THEN 'URL completa (HTTP)'
        ELSE 'Ruta relativa o incompleta'
    END as tipo,
    COUNT(*) as cantidad
FROM series 
WHERE deleted_at IS NULL
GROUP BY 
    CASE 
        WHEN cover_url IS NULL THEN 'NULL'
        WHEN cover_url LIKE 'https://%' THEN 'URL completa (HTTPS)'
        WHEN cover_url LIKE 'http://%' THEN 'URL completa (HTTP)'
        ELSE 'Ruta relativa o incompleta'
    END;

-- 3. Verificar estructura de la tabla
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'series' 
AND column_name IN ('cover_url', 'id', 'slug', 'title');

-- 4. [OPCIONAL] Corregir URLs relativas si las hay
-- IMPORTANTE: Ajustar el dominio y la ruta según tu configuración
-- Descomenta las siguientes líneas si necesitas ejecutar la corrección:

/*
UPDATE series 
SET cover_url = 'https://manwhaimperial.sfo3.digitaloceanspaces.com/' || cover_url
WHERE cover_url IS NOT NULL 
    AND cover_url NOT LIKE 'http%'
    AND deleted_at IS NULL;
*/

-- 5. Ver series con portada actualizada recientemente
SELECT 
    id,
    slug,
    title,
    cover_url,
    updated_at,
    created_at
FROM series
WHERE deleted_at IS NULL
    AND cover_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
