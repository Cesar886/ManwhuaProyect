const cron = require('node-cron');
const { query } = require('../src/config/database');

const schedule = '0 4 * * *';

async function runJob() {
    const startedAt = Date.now();
    let processed = 0;
    console.log('[detect-abandonment] start');

    try {
        const result = await query(`
            WITH last_progress AS (
                SELECT DISTINCT ON (user_id, series_id)
                    user_id,
                    series_id,
                    chapter_id,
                    chapter_number,
                    completed_at,
                    COALESCE(local_timestamp, arrived_at, created_at) AS activity_at
                FROM user_behavior_chapter_progress
                ORDER BY user_id, series_id, COALESCE(completed_at, local_timestamp, arrived_at, created_at) DESC
            )
            SELECT *
            FROM last_progress
            WHERE completed_at IS NULL
              AND activity_at < (timezone('utc', now()) - INTERVAL '7 days')
        `);

        for (const row of result.rows) {
            await query(`
                INSERT INTO user_behavior_work_abandonments
                    (user_id, series_id, last_chapter_id, last_chapter_number, abandoned_at, days_without_activity, abandonment_source, timezone)
                VALUES ($1, $2, $3, $4, timezone('utc', now()), 7, 'cron', 'UTC')
                ON CONFLICT (user_id, series_id) DO UPDATE SET
                    last_chapter_id = EXCLUDED.last_chapter_id,
                    last_chapter_number = EXCLUDED.last_chapter_number,
                    abandoned_at = EXCLUDED.abandoned_at,
                    days_without_activity = EXCLUDED.days_without_activity,
                    abandonment_source = EXCLUDED.abandonment_source,
                    updated_at = timezone('utc', now())
            `, [row.user_id, row.series_id, row.chapter_id, row.chapter_number]);

            await query(`
                UPDATE user_behavior_summary
                SET abandoned_works = COALESCE(abandoned_works, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                    'series_id', $2,
                    'chapter_id', $3,
                    'chapter_number', $4,
                    'days_without_activity', 7,
                    'abandoned_at', timezone('utc', now())
                )),
                updated_at = timezone('utc', now())
                WHERE user_id = $1
            `, [row.user_id, row.series_id, row.chapter_id, row.chapter_number]);

            processed += 1;
        }
    } catch (error) {
        console.error('[detect-abandonment] error', error);
    } finally {
        console.log('[detect-abandonment] end', { processed, duration_ms: Date.now() - startedAt });
    }

    return processed;
}

if (require.main === module) {
    cron.schedule(schedule, runJob, { timezone: 'UTC' });
    runJob();
}

module.exports = { runJob, schedule };