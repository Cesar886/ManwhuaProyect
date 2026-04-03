const cron = require('node-cron');
const { query } = require('../src/config/database');

const schedule = '0 3 * * 1';

async function runJob() {
    const startedAt = Date.now();
    let processed = 0;
    console.log('[classify-reader-archetype] start');

    try {
        const result = await query(`
            WITH stats AS (
                SELECT
                    user_id,
                    date_trunc('week', started_at)::date AS week_start_date,
                    COUNT(*) AS session_count,
                    COUNT(*) FILTER (WHERE EXTRACT(ISODOW FROM started_at AT TIME ZONE COALESCE(timezone, 'UTC')) IN (6, 7)) AS weekend_session_count,
                    COUNT(DISTINCT (started_at AT TIME ZONE COALESCE(timezone, 'UTC'))::date) AS active_days,
                    AVG(GREATEST(chapters_read_in_session, 1)) AS avg_chapters_per_session,
                    SUM(CASE WHEN chapters_read_in_session >= 20 THEN 1 ELSE 0 END) AS binge_session_count
                FROM user_behavior_reading_sessions
                WHERE started_at >= NOW() - INTERVAL '7 days'
                GROUP BY user_id, date_trunc('week', started_at)::date
            )
            SELECT * FROM stats
        `);

        for (const row of result.rows) {
            const sessionCount = Number(row.session_count || 0);
            const weekendCount = Number(row.weekend_session_count || 0);
            const activeDays = Number(row.active_days || 0);
            const avgChapters = Number(row.avg_chapters_per_session || 0);
            const bingeSessions = Number(row.binge_session_count || 0);
            const weekendRatio = sessionCount > 0 ? weekendCount / sessionCount : 0;

            let archetype = 'casual';
            let confidence = 0.35;

            if (avgChapters >= 20 || bingeSessions > 0 || (weekendRatio >= 0.6 && avgChapters >= 15)) {
                archetype = 'binge_reader';
                confidence = Math.min(1, 0.55 + weekendRatio * 0.25 + Math.min(1, avgChapters / 40) * 0.2);
            } else if (activeDays >= 5 && avgChapters <= 5) {
                archetype = 'daily_reader';
                confidence = Math.min(1, 0.55 + (activeDays / 7) * 0.25 + (1 - Math.min(1, avgChapters / 5)) * 0.2);
            }

            await query(`
                INSERT INTO user_behavior_reader_archetypes
                    (user_id, reader_archetype, confidence, classification_date, week_start_date, week_end_date,
                     session_count, weekend_session_count, binge_session_count, daily_active_days, avg_chapters_per_session)
                VALUES ($1, $2, $3, CURRENT_DATE, $4, ($4 + INTERVAL '6 days')::date, $5, $6, $7, $8, $9)
                ON CONFLICT (user_id, week_start_date) DO UPDATE SET
                    reader_archetype = EXCLUDED.reader_archetype,
                    confidence = EXCLUDED.confidence,
                    classification_date = EXCLUDED.classification_date,
                    week_end_date = EXCLUDED.week_end_date,
                    session_count = EXCLUDED.session_count,
                    weekend_session_count = EXCLUDED.weekend_session_count,
                    binge_session_count = EXCLUDED.binge_session_count,
                    daily_active_days = EXCLUDED.daily_active_days,
                    avg_chapters_per_session = EXCLUDED.avg_chapters_per_session,
                    updated_at = timezone('utc', now())
            `, [
                row.user_id,
                archetype,
                confidence,
                row.week_start_date,
                sessionCount,
                weekendCount,
                bingeSessions,
                activeDays,
                avgChapters,
            ]);

            await query(`
                INSERT INTO user_behavior_summary
                    (user_id, reader_archetype, reader_archetype_confidence, reader_archetype_classified_at, updated_at)
                VALUES ($1, $2, $3, timezone('utc', now()), timezone('utc', now()))
                ON CONFLICT (user_id) DO UPDATE SET
                    reader_archetype = EXCLUDED.reader_archetype,
                    reader_archetype_confidence = EXCLUDED.reader_archetype_confidence,
                    reader_archetype_classified_at = EXCLUDED.reader_archetype_classified_at,
                    updated_at = EXCLUDED.updated_at
            `, [row.user_id, archetype, confidence]);

            processed += 1;
        }
    } catch (error) {
        console.error('[classify-reader-archetype] error', error);
    } finally {
        console.log('[classify-reader-archetype] end', { processed, duration_ms: Date.now() - startedAt });
    }

    return processed;
}

if (require.main === module) {
    cron.schedule(schedule, runJob, { timezone: 'UTC' });
    runJob();
}

module.exports = { runJob, schedule };