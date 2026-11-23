CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid NOT NULL,
    user_id text,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
    ON public.push_subscriptions (endpoint);

CREATE TABLE IF NOT EXISTS public.push_follows (
    subscription_id uuid NOT NULL,
    manhwa_slug text NOT NULL,
    created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT push_follows_pkey PRIMARY KEY (subscription_id, manhwa_slug),
    CONSTRAINT push_follows_subscription_id_fkey
        FOREIGN KEY (subscription_id) REFERENCES public.push_subscriptions(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS push_follows_manhwa_slug_idx
    ON public.push_follows (manhwa_slug);
