BEGIN;

ALTER TABLE public.genres
    ADD COLUMN IF NOT EXISTS icon varchar(100),
    ADD COLUMN IF NOT EXISTS color varchar(20);

ALTER TABLE public.series_views
    ADD COLUMN IF NOT EXISTS user_agent text,
    ADD COLUMN IF NOT EXISTS country_code varchar(2);

CREATE TABLE IF NOT EXISTS public.merch_afiliados (
    id bigserial PRIMARY KEY,
    serie_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    nombre varchar(255) NOT NULL,
    img_url text,
    link_afiliado text NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merch_afiliados_serie_id
    ON public.merch_afiliados (serie_id);

ALTER TABLE public.chapter_votes
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chapter_votes_user_id
    ON public.chapter_votes (user_id)
    WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_achievements (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    achievement_type varchar(50) NOT NULL,
    level integer NOT NULL CHECK (level > 0),
    unlocked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_type_level
    ON public.user_achievements (achievement_type, level DESC);

CREATE TABLE IF NOT EXISTS public.achievement_progress (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    achievement_type varchar(50) NOT NULL,
    current_value bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, achievement_type)
);

COMMIT;
