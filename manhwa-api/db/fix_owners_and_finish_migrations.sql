-- Ejecutar como superusuario postgres
-- Objetivo: asignar ownership al usuario de app para evitar bloqueos en migraciones/índices

-- 1) Transferir ownership de tablas que bloquearon migraciones e índices
ALTER TABLE IF EXISTS public.users OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.reading_history OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.chapter_ratings OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.series OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.chapters OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.comments OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.bookmarks OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.series_genres OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.collections OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.collection_series OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.refresh_tokens OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.chapter_pages OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.poll_options OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.user_genre_preferences OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.user_trope_preferences OWNER TO manhwa_app;
ALTER TABLE IF EXISTS public.user_devices OWNER TO manhwa_app;

-- 2) (Opcional recomendado) ownership de secuencias asociadas
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO manhwa_app', r.sequence_schema, r.sequence_name);
  END LOOP;
END $$;

-- 3) Re-aplicar migraciones históricas (idempotentes)
\i /home/daniel/ManwhuasProyect/manhwa-api/migrations/001_add_oauth_columns.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/migrations/002_add_reading_progress_fields.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/migrations/003_add_chapter_ratings.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/migrations/004_rebuild_chapter_ratings.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/migrations/005_behavioral_tracking_system.sql

-- 4) Aplicar SQL de db (los de índices/optimizaciones)
\i /home/daniel/ManwhuasProyect/manhwa-api/db/add_polls.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/db/apply_indexes.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/db/optimize_indexes.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/db/optimize_queries.sql
\i /home/daniel/ManwhuasProyect/manhwa-api/db/behavioral_analytics_schema.sql

-- 5) Verificación rápida
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN (
    'users','reading_history','chapter_ratings','series','chapters','comments','bookmarks',
    'series_genres','collections','collection_series','refresh_tokens','chapter_pages',
    'poll_options','user_genre_preferences','user_trope_preferences','user_devices'
  )
ORDER BY tablename;
