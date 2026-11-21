BEGIN;

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'comments'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%target_type%'
    LOOP
        EXECUTE format('ALTER TABLE public.comments DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.comments
    ADD CONSTRAINT comments_target_type_check
    CHECK (target_type IN ('series', 'chapter', 'collection', 'request'));

COMMIT;
