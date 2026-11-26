-- Colecciones personales y públicas usadas por /api/collections.
CREATE TABLE IF NOT EXISTS public.collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name varchar(200) NOT NULL,
    slug varchar(255) NOT NULL UNIQUE,
    description text,
    cover_url text,
    category varchar(100),
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_public boolean NOT NULL DEFAULT true,
    is_verified boolean NOT NULL DEFAULT false,
    manhwas_count integer NOT NULL DEFAULT 0,
    followers_count integer NOT NULL DEFAULT 0,
    likes_count integer NOT NULL DEFAULT 0,
    views_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_collections_creator_active
    ON public.collections (creator_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_collections_public_active
    ON public.collections (created_at DESC) WHERE is_public = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.collection_items (
    collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    order_index integer NOT NULL DEFAULT 0,
    added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    note text,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_items_order
    ON public.collection_items (collection_id, order_index);
CREATE INDEX IF NOT EXISTS idx_collection_items_series
    ON public.collection_items (series_id);

CREATE TABLE IF NOT EXISTS public.collection_follows (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_follows_collection
    ON public.collection_follows (collection_id);

CREATE TABLE IF NOT EXISTS public.collection_likes (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_likes_collection
    ON public.collection_likes (collection_id);
