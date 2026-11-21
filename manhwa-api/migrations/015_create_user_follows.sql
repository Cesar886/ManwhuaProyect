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
