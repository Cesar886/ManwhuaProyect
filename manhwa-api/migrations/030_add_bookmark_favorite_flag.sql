-- Los registros previos conservan su comportamiento de Favoritos.
-- El historial nuevo podrá crear un bookmark sin marcarlo como favorito.
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT true;
