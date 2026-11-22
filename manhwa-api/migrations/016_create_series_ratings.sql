CREATE TABLE IF NOT EXISTS public.ratings (
    id bigserial PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    score smallint NOT NULL CHECK (score BETWEEN 1 AND 10),
    review text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_series_id
    ON public.ratings (series_id);

CREATE TABLE IF NOT EXISTS public.series_ratings (
    id bigserial PRIMARY KEY,
    visitor_id varchar(255) NOT NULL,
    series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (series_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_series_ratings_series_id
    ON public.series_ratings (series_id);
CREATE INDEX IF NOT EXISTS idx_series_ratings_visitor_id
    ON public.series_ratings (visitor_id);
