-- Restore the complete comments subsystem.
--
-- This migration is intentionally idempotent.  Comments use UUID identifiers in
-- the API, while poll rows use compact integer identifiers internally.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_type varchar(20) NOT NULL,
    target_id uuid NOT NULL,
    parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
    root_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
    content text NOT NULL DEFAULT '',
    rating smallint,
    is_spoiler boolean NOT NULL DEFAULT false,
    is_pinned boolean NOT NULL DEFAULT false,
    status varchar(20) NOT NULL DEFAULT 'visible',
    likes_count integer NOT NULL DEFAULT 0,
    dislikes_count integer NOT NULL DEFAULT 0,
    replies_count integer NOT NULL DEFAULT 0,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    edited_at timestamptz,
    deleted_at timestamptz,
    CONSTRAINT comments_target_type_check
        CHECK (target_type IN ('series', 'chapter', 'collection', 'request')),
    CONSTRAINT comments_rating_check
        CHECK (rating IS NULL OR rating BETWEEN 1 AND 10),
    CONSTRAINT comments_status_check
        CHECK (status IN ('visible', 'hidden', 'deleted')),
    CONSTRAINT comments_likes_count_check CHECK (likes_count >= 0),
    CONSTRAINT comments_dislikes_count_check CHECK (dislikes_count >= 0),
    CONSTRAINT comments_replies_count_check CHECK (replies_count >= 0)
);

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE TABLE IF NOT EXISTS public.comment_votes (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    vote_type smallint NOT NULL CHECK (vote_type IN (-1, 1)),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS public.comment_polls (
    id bigserial PRIMARY KEY,
    comment_id uuid NOT NULL UNIQUE REFERENCES public.comments(id) ON DELETE CASCADE,
    question varchar(300) NOT NULL,
    total_votes integer NOT NULL DEFAULT 0 CHECK (total_votes >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id bigserial PRIMARY KEY,
    poll_id bigint NOT NULL REFERENCES public.comment_polls(id) ON DELETE CASCADE,
    option_text varchar(150) NOT NULL,
    option_order smallint NOT NULL,
    vote_count integer NOT NULL DEFAULT 0 CHECK (vote_count >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (poll_id, option_order)
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id bigserial PRIMARY KEY,
    poll_id bigint NOT NULL REFERENCES public.comment_polls(id) ON DELETE CASCADE,
    option_id bigint NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_target
    ON public.comments (target_type, target_id, created_at DESC)
    WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS idx_comments_parent
    ON public.comments (parent_id, created_at ASC)
    WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS idx_comments_root
    ON public.comments (root_id);
CREATE INDEX IF NOT EXISTS idx_comments_user
    ON public.comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment
    ON public.comment_votes (comment_id, vote_type);
CREATE INDEX IF NOT EXISTS idx_comment_polls_comment
    ON public.comment_polls (comment_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll
    ON public.poll_options (poll_id, option_order);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user
    ON public.poll_votes (user_id);

