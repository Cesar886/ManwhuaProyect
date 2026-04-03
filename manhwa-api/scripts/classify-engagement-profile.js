const cron = require('node-cron');
const { query } = require('../src/config/database');

const schedule = '0 2 * * 0';

async function runJob() {
    const startedAt = Date.now();
    let processed = 0;
    console.log('[classify-engagement-profile] start');

    try {
        const result = await query(`
            WITH comments_agg AS (
                SELECT
                    c.user_id,
                    COUNT(*) AS comments_30d
                FROM comments c
                WHERE c.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY c.user_id
            ), ratings_agg AS (
                SELECT
                    r.user_id,
                    COUNT(*) AS ratings_30d
                FROM ratings r
                WHERE r.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY r.user_id
            ), replies_agg AS (
                SELECT
                    parent_comment.user_id,
                    COUNT(DISTINCT reply.id) AS reply_interactions_30d
                FROM comments parent_comment
                JOIN comments reply
                    ON reply.parent_id = parent_comment.id
                   AND reply.user_id <> parent_comment.user_id
                   AND reply.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY parent_comment.user_id
            ), activity AS (
                SELECT
                    u.id AS user_id,
                    COALESCE(c.comments_30d, 0) AS comments_30d,
                    COALESCE(r.ratings_30d, 0) AS ratings_30d,
                    COALESCE(rep.reply_interactions_30d, 0) AS reply_interactions_30d
                FROM users u
                LEFT JOIN comments_agg c ON c.user_id = u.id
                LEFT JOIN ratings_agg r ON r.user_id = u.id
                LEFT JOIN replies_agg rep ON rep.user_id = u.id
            )
            SELECT * FROM activity
        `);

        for (const row of result.rows) {
            const comments = Number(row.comments_30d || 0);
            const ratings = Number(row.ratings_30d || 0);
            const replies = Number(row.reply_interactions_30d || 0);

            let profile = 'lurker';
            if (comments === 0 && ratings === 0) {
                profile = 'lurker';
            } else if (ratings > 0 && comments < 2) {
                profile = 'critic';
            } else if (comments >= 2 && replies > 0) {
                profile = 'social';
            } else if (ratings > 0) {
                profile = 'critic';
            }

            await query(`
                INSERT INTO user_behavior_engagement_profiles
                    (user_id, engagement_profile, total_comments_30d, total_ratings_30d, reply_interactions_30d, classification_date)
                VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
                ON CONFLICT (user_id, classification_date) DO UPDATE SET
                    engagement_profile = EXCLUDED.engagement_profile,
                    total_comments_30d = EXCLUDED.total_comments_30d,
                    total_ratings_30d = EXCLUDED.total_ratings_30d,
                    reply_interactions_30d = EXCLUDED.reply_interactions_30d,
                    updated_at = timezone('utc', now())
            `, [row.user_id, profile, comments, ratings, replies]);

            await query(`
                INSERT INTO user_behavior_summary
                    (user_id, engagement_profile, engagement_profile_classified_at, updated_at)
                VALUES ($1, $2, timezone('utc', now()), timezone('utc', now()))
                ON CONFLICT (user_id) DO UPDATE SET
                    engagement_profile = EXCLUDED.engagement_profile,
                    engagement_profile_classified_at = EXCLUDED.engagement_profile_classified_at,
                    updated_at = EXCLUDED.updated_at
            `, [row.user_id, profile]);

            processed += 1;
        }
    } catch (error) {
        console.error('[classify-engagement-profile] error', error);
    } finally {
        console.log('[classify-engagement-profile] end', { processed, duration_ms: Date.now() - startedAt });
    }

    return processed;
}

if (require.main === module) {
    cron.schedule(schedule, runJob, { timezone: 'UTC' });
    runJob();
}

module.exports = { runJob, schedule };