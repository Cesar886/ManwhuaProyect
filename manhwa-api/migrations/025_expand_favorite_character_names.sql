ALTER TABLE public.user_favorite_characters
    ALTER COLUMN name TYPE varchar(25);

ALTER TABLE public.user_favorite_characters
    DROP CONSTRAINT IF EXISTS user_favorite_characters_name_length_check;

ALTER TABLE public.user_favorite_characters
    ADD CONSTRAINT user_favorite_characters_name_length_check
    CHECK (char_length(trim(name)) BETWEEN 1 AND 25);
