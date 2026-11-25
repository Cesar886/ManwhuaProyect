ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS recommended_series_id uuid,
    ADD COLUMN IF NOT EXISTS recommended_series_title text,
    ADD COLUMN IF NOT EXISTS recommended_series_cover_url text;

CREATE INDEX IF NOT EXISTS idx_comments_recommended_series
    ON public.comments (recommended_series_id)
    WHERE recommended_series_id IS NOT NULL;
