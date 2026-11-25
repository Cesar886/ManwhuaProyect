CREATE TABLE IF NOT EXISTS ai_usage_daily (
    usage_date date NOT NULL,
    subject_key text NOT NULL,
    count integer NOT NULL DEFAULT 0,
    PRIMARY KEY (usage_date, subject_key)
);
