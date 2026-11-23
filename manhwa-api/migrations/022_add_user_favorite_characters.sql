CREATE TABLE IF NOT EXISTS public.user_favorite_characters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type varchar(10) NOT NULL,
    name varchar(10) NOT NULL,
    color varchar(7) NOT NULL,
    position integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_favorite_characters_type_check
        CHECK (type IN ('waifu', 'husband')),
    CONSTRAINT user_favorite_characters_name_length_check
        CHECK (char_length(trim(name)) BETWEEN 1 AND 10),
    CONSTRAINT user_favorite_characters_color_format_check
        CHECK (color ~* '^#[0-9A-F]{6}$'),
    CONSTRAINT user_favorite_characters_position_check
        CHECK (position BETWEEN 0 AND 2),
    CONSTRAINT user_favorite_characters_user_position_unique
        UNIQUE (user_id, position)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_characters_user_position
    ON public.user_favorite_characters (user_id, position);
