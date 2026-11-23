-- Add referential and feed constraints for the global wall.
-- This migration is intentionally reversible.

ALTER TABLE public.comments
    DROP CONSTRAINT IF EXISTS comments_wall_target_id_check;

ALTER TABLE public.comments
    ADD CONSTRAINT comments_wall_target_id_check
    CHECK (
        target_type <> 'wall'
        OR target_id = '00000000-0000-0000-0000-000000000000'::uuid
    ) NOT VALID;

ALTER TABLE public.comments
    VALIDATE CONSTRAINT comments_wall_target_id_check;

CREATE INDEX IF NOT EXISTS idx_comments_wall_feed_created_at
    ON public.comments (created_at DESC)
    WHERE target_type = 'wall'
      AND parent_id IS NULL
      AND status = 'visible';
