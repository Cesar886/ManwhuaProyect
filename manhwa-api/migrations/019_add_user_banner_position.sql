ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS banner_position_x integer NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS banner_position_y integer NOT NULL DEFAULT 50;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_banner_position_x_range'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_banner_position_x_range
            CHECK (banner_position_x BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_banner_position_y_range'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_banner_position_y_range
            CHECK (banner_position_y BETWEEN 0 AND 100);
    END IF;
END $$;
