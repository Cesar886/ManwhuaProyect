CREATE TABLE IF NOT EXISTS public.user_follows (
    follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT user_follows_not_self_check CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_following_created
    ON public.user_follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_created
    ON public.user_follows (follower_id, created_at DESC);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.update_user_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        UPDATE public.users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        RETURN NEW;
    END IF;

    UPDATE public.users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE public.users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS user_follows_update_counts ON public.user_follows;
CREATE TRIGGER user_follows_update_counts
AFTER INSERT OR DELETE ON public.user_follows
FOR EACH ROW EXECUTE FUNCTION public.update_user_follow_counts();

UPDATE public.users u
SET followers_count = (
        SELECT COUNT(*) FROM public.user_follows f WHERE f.following_id = u.id
    ),
    following_count = (
        SELECT COUNT(*) FROM public.user_follows f WHERE f.follower_id = u.id
    );
