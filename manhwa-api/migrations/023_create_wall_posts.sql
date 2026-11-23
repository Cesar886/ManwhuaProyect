-- The wall uses the existing comments subsystem. This migration only enables
-- the 'wall' target type and adds no parallel post tables.
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_target_type_check;

ALTER TABLE public.comments
    ADD CONSTRAINT comments_target_type_check
    CHECK (target_type IN ('series', 'chapter', 'collection', 'request', 'wall'));
