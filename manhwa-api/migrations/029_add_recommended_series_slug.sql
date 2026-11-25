ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS recommended_series_slug text;

CREATE INDEX IF NOT EXISTS idx_comments_recommended_series_slug
    ON public.comments (recommended_series_slug)
    WHERE recommended_series_slug IS NOT NULL;
