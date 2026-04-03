const cron = require('node-cron');
const { query } = require('../src/config/database');

const schedule = '0 1 * * *';

async function runJob() {
    const startedAt = Date.now();
    let processed = 0;
    console.log('[calculate-prime-time] start');

    try {
        const result = await query(`
            WITH slot_counts AS (
                SELECT
                    user_id,
                    COALESCE(timezone, 'UTC') AS timezone,
                    CASE
                        WHEN EXTRACT(HOUR FROM started_at AT TIME ZONE COALESCE(timezone, 'UTC')) < 6 THEN 'madrugada'
                        WHEN EXTRACT(HOUR FROM started_at AT TIME ZONE COALESCE(timezone, 'UTC')) < 12 THEN 'manana'
                        WHEN EXTRACT(HOUR FROM started_at AT TIME ZONE COALESCE(timezone, 'UTC')) < 18 THEN 'tarde'
                        ELSE 'noche'
                    END AS time_slot,
                    COUNT(*) AS slot_count
                FROM user_behavior_reading_sessions
                GROUP BY user_id, COALESCE(timezone, 'UTC'),
                    CASE
                        WHEN EXTRACT(HOUR FROM started_at AT TIME ZONE COALESCE(timezone, 'UTC')) < 6 THEN 'madrugada'
                        WHEN EXTRACT(HOUR FROM started_at AT TIME ZONE COALESCE(timezone, 'UTC')) < 12 THEN 'manana'
                        WHEN EXTRACT(HOUR FROM started_at AT TIME ZONE COALESCE(timezone, 'UTC')) < 18 THEN 'tarde'
                        ELSE 'noche'
                    END
            ), ranked AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY slot_count DESC, time_slot) AS rn
                FROM slot_counts
            )
            SELECT user_id, timezone, time_slot, slot_count
            FROM ranked
            WHERE rn = 1
        `);

        for (const row of result.rows) {
            await query(`
                INSERT INTO user_behavior_prime_time_profiles
                    (user_id, timezone, prime_time_slot, frequency_count, classification_date)
                VALUES ($1, $2, $3, $4, CURRENT_DATE)
                ON CONFLICT (user_id, classification_date) DO UPDATE SET
                    timezone = EXCLUDED.timezone,
                    prime_time_slot = EXCLUDED.prime_time_slot,
                    frequency_count = EXCLUDED.frequency_count,
                    updated_at = timezone('utc', now())
            `, [row.user_id, row.timezone, row.time_slot, Number(row.slot_count || 0)]);

            await query(`
                INSERT INTO user_behavior_summary
                    (user_id, prime_time_slot, prime_time_timezone, prime_time_frequency_count, prime_time_classified_at, updated_at)
                VALUES ($1, $2, $3, $4, timezone('utc', now()), timezone('utc', now()))
                ON CONFLICT (user_id) DO UPDATE SET
                    prime_time_slot = EXCLUDED.prime_time_slot,
                    prime_time_timezone = EXCLUDED.prime_time_timezone,
                    prime_time_frequency_count = EXCLUDED.prime_time_frequency_count,
                    prime_time_classified_at = EXCLUDED.prime_time_classified_at,
                    updated_at = EXCLUDED.updated_at
            `, [row.user_id, row.time_slot, row.timezone, Number(row.slot_count || 0)]);

            processed += 1;
        }
    } catch (error) {
        console.error('[calculate-prime-time] error', error);
    } finally {
        console.log('[calculate-prime-time] end', { processed, duration_ms: Date.now() - startedAt });
    }

    return processed;
}

if (require.main === module) {
    cron.schedule(schedule, runJob, { timezone: 'UTC' });
    runJob();
}

module.exports = { runJob, schedule };