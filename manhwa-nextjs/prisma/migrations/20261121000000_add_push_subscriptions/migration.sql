CREATE TABLE "push_subscriptions" (
  "id" UUID NOT NULL,
  "user_id" TEXT,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

CREATE TABLE "push_follows" (
  "subscription_id" UUID NOT NULL,
  "manhwa_slug" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_follows_pkey" PRIMARY KEY ("subscription_id", "manhwa_slug"),
  CONSTRAINT "push_follows_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "push_subscriptions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "push_follows_manhwa_slug_idx" ON "push_follows"("manhwa_slug");
