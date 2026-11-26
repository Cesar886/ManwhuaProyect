-- Additive upgrade: existing collections and bookmarks remain intact.
CREATE OR REPLACE FUNCTION public.collection_public_id() RETURNS varchar(8)
LANGUAGE plpgsql AS $$
DECLARE
    alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    bytes bytea;
    candidate text;
    i integer;
BEGIN
    LOOP
        bytes := gen_random_bytes(8);
        candidate := '';
        FOR i IN 0..7 LOOP
            candidate := candidate || substr(alphabet, (get_byte(bytes, i) % 62) + 1, 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.collections WHERE public_id = candidate);
    END LOOP;
    RETURN candidate;
END;
$$;

ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS public_id varchar(8);
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS type varchar(20) NOT NULL DEFAULT 'normal';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS visibility varchar(20) NOT NULL DEFAULT 'private';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS copied_from_id uuid REFERENCES public.collections(id) ON DELETE SET NULL;

-- All pre-existing collections start private, including previously public ones.
UPDATE public.collections SET visibility = 'private', is_public = false WHERE public_id IS NULL;
ALTER TABLE public.collections ADD CONSTRAINT collections_public_id_unique UNIQUE (public_id);
DO $$
DECLARE row_id uuid;
BEGIN
    FOR row_id IN SELECT id FROM public.collections WHERE public_id IS NULL LOOP
        UPDATE public.collections SET public_id = public.collection_public_id() WHERE id = row_id;
    END LOOP;
END;
$$;
ALTER TABLE public.collections ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE public.collections ALTER COLUMN public_id SET DEFAULT public.collection_public_id();
ALTER TABLE public.collections ADD CONSTRAINT collections_public_id_format CHECK (public_id ~ '^[A-Za-z0-9]{8}$');
ALTER TABLE public.collections ADD CONSTRAINT collections_type_check CHECK (type IN ('normal', 'favorites'));
ALTER TABLE public.collections ADD CONSTRAINT collections_visibility_check CHECK (visibility IN ('private', 'unlisted', 'public'));
CREATE UNIQUE INDEX collections_one_favorites_per_user ON public.collections (creator_id) WHERE type = 'favorites';
CREATE INDEX collections_public_list ON public.collections (created_at DESC) WHERE visibility = 'public' AND deleted_at IS NULL;

-- A favorites row exists for every current user. The old bookmarks remain the source
-- used by reading history and by the heart; the trigger keeps collection_items in sync.
DO $$
DECLARE owner_id uuid; inserted boolean;
BEGIN
    FOR owner_id IN SELECT id FROM public.users LOOP
        IF NOT EXISTS (SELECT 1 FROM public.collections WHERE creator_id = owner_id AND type = 'favorites') THEN
            LOOP
                INSERT INTO public.collections (creator_id, name, slug, type, visibility, is_public, public_id)
                VALUES (owner_id, 'Favoritos', 'favorites-' || replace(owner_id::text, '-', ''),
                        'favorites', 'private', false, public.collection_public_id())
                ON CONFLICT DO NOTHING RETURNING true INTO inserted;
                EXIT WHEN inserted;
            END LOOP;
        END IF;
    END LOOP;
END;
$$;

INSERT INTO public.collection_items (collection_id, series_id, order_index, added_by, added_at)
SELECT c.id, b.series_id,
       (row_number() OVER (PARTITION BY c.id ORDER BY b.updated_at DESC, b.series_id) - 1)::integer,
       b.user_id, b.created_at
FROM public.bookmarks b
JOIN public.collections c ON c.creator_id = b.user_id AND c.type = 'favorites'
WHERE b.is_favorite = true
ON CONFLICT (collection_id, series_id) DO NOTHING;

UPDATE public.collections c SET manhwas_count = (
    SELECT COUNT(*) FROM public.collection_items ci WHERE ci.collection_id = c.id
) WHERE c.type = 'favorites';
UPDATE public.collections c SET likes_count = (
    SELECT COUNT(*) FROM public.collection_likes cl WHERE cl.collection_id = c.id
);

CREATE OR REPLACE FUNCTION public.create_user_favorites_collection() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE inserted boolean;
BEGIN
    LOOP
        INSERT INTO public.collections (creator_id, name, slug, type, visibility, is_public)
        VALUES (NEW.id, 'Favoritos', 'favorites-' || replace(NEW.id::text, '-', ''), 'favorites', 'private', false)
        ON CONFLICT DO NOTHING RETURNING true INTO inserted;
        EXIT WHEN inserted;
    END LOOP;
    RETURN NEW;
END;
$$;
CREATE TRIGGER users_create_favorites_collection
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.create_user_favorites_collection();

CREATE OR REPLACE FUNCTION public.sync_favorites_collection() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    owner_id uuid;
    title_id uuid;
    favorite_id uuid;
    should_add boolean;
BEGIN
    IF TG_OP = 'DELETE' THEN
        owner_id := OLD.user_id;
        title_id := OLD.series_id;
        should_add := false;
    ELSE
        owner_id := NEW.user_id;
        title_id := NEW.series_id;
        should_add := NEW.is_favorite;
    END IF;
    IF should_add THEN
        INSERT INTO public.collections (creator_id, name, slug, type, visibility, is_public)
        VALUES (owner_id, 'Favoritos', 'favorites-' || replace(owner_id::text, '-', ''), 'favorites', 'private', false)
        ON CONFLICT DO NOTHING;
    END IF;
    SELECT id INTO favorite_id FROM public.collections
    WHERE creator_id = owner_id AND type = 'favorites';
    IF favorite_id IS NOT NULL THEN
        IF should_add THEN
            INSERT INTO public.collection_items (collection_id, series_id, order_index, added_by)
            VALUES (favorite_id, title_id,
                    (SELECT COALESCE(MAX(order_index) + 1, 0) FROM public.collection_items WHERE collection_id = favorite_id), owner_id)
            ON CONFLICT (collection_id, series_id) DO NOTHING;
        ELSE
            DELETE FROM public.collection_items WHERE collection_id = favorite_id AND series_id = title_id;
        END IF;
        UPDATE public.collections SET manhwas_count =
            (SELECT COUNT(*) FROM public.collection_items WHERE collection_id = favorite_id), updated_at = now()
        WHERE id = favorite_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER bookmarks_sync_favorites
AFTER INSERT OR UPDATE OF is_favorite OR DELETE ON public.bookmarks
FOR EACH ROW EXECUTE FUNCTION public.sync_favorites_collection();

-- Even a soft delete must not remove the one special collection.
CREATE OR REPLACE FUNCTION public.protect_favorites_collection() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.type = 'favorites' AND (TG_OP = 'DELETE' OR NEW.deleted_at IS NOT NULL OR NEW.type <> 'favorites' OR NEW.creator_id <> OLD.creator_id) THEN
        RAISE EXCEPTION 'Favorites collection cannot be deleted or changed';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER collections_protect_favorites
BEFORE UPDATE OR DELETE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.protect_favorites_collection();
