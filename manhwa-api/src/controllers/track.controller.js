const { randomUUID } = require('crypto');
const { z } = require('zod');
const { query } = require('../config/database');
const { queueBehaviorTask } = require('../services/trackQueue');

const nowUtc = () => new Date().toISOString();
const toInt = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const toFloat = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const uuid = z.string().uuid();
const tz = z.string().trim().min(2).max(64).optional();
const ts = z.union([z.string().datetime({ offset: true }), z.string().min(1), z.number()]).optional();

const schemas = {
    sessionStart: z.object({ session_id: z.string().uuid().optional(), series_id: uuid, chapter_id: uuid.optional(), chapter_number: z.union([z.string(), z.number()]).optional(), timezone: tz, started_at: ts, page_url: z.string().url().optional(), local_timestamp: ts }).passthrough(),
    chapterProgress: z.object({ session_id: z.string().uuid().optional(), series_id: uuid, chapter_id: uuid, chapter_number: z.union([z.string(), z.number()]).optional(), progress_percent: z.union([z.string(), z.number()]).optional(), scroll_depth_percent: z.union([z.string(), z.number()]).optional(), seconds_on_page: z.union([z.string(), z.number()]).optional(), timezone: tz, local_timestamp: ts, page_url: z.string().url().optional() }).passthrough(),
    chapterComplete: z.object({ session_id: z.string().uuid().optional(), series_id: uuid, chapter_id: uuid, chapter_number: z.union([z.string(), z.number()]).optional(), progress_percent: z.union([z.string(), z.number()]).optional(), scroll_depth_percent: z.union([z.string(), z.number()]).optional(), seconds_on_page: z.union([z.string(), z.number()]).optional(), chapters_read_in_session: z.union([z.string(), z.number()]).optional(), timezone: tz, local_timestamp: ts, recommendation_impression_id: z.string().uuid().optional(), source_algorithm: z.string().trim().max(80).optional() }).passthrough(),
    workAbandon: z.object({ series_id: uuid, chapter_id: uuid.optional(), chapter_number: z.union([z.string(), z.number()]).optional(), days_without_activity: z.union([z.string(), z.number()]).optional(), timezone: tz, local_timestamp: ts, reason: z.string().trim().max(120).optional() }).passthrough(),
    searchQuery: z.object({ query_text: z.string().trim().min(1).max(300).optional(), query_texto: z.string().trim().min(1).max(300).optional(), result_clicked_series_id: z.string().uuid().nullable().optional(), timezone: tz, local_timestamp: ts }).passthrough(),
    recoImpression: z.object({ recommendation_impression_id: z.string().uuid().optional(), recommended_series_id: uuid, algoritmo_origen: z.string().trim().min(1).max(80), mostrado_en: ts, banner_position: z.union([z.string(), z.number()]).optional(), source_series_id: z.string().uuid().nullable().optional(), timezone: tz, recommendation_context: z.record(z.any()).optional() }).passthrough(),
    recoClick: z.object({ recommendation_impression_id: z.string().uuid(), recommended_series_id: uuid, algoritmo_origen: z.string().trim().min(1).max(80), clicked_at: ts, chapters_read_post_conversion: z.union([z.string(), z.number()]).optional(), timezone: tz }).passthrough(),
    sessionEnd: z.object({ session_id: z.string().uuid(), series_id: uuid, chapter_id: uuid.optional(), chapter_number: z.union([z.string(), z.number()]).optional(), duration_seconds: z.union([z.string(), z.number()]).optional(), scroll_depth_percent: z.union([z.string(), z.number()]).optional(), chapters_read_in_session: z.union([z.string(), z.number()]).optional(), exit_reason: z.string().trim().max(40).optional(), timezone: tz, ended_at: ts }).passthrough(),
};

const parseBody = (schema, req, res) => {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: 'Body inválido',
            errors: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
        return null;
    }
    return parsed.data;
};

const queueWrite = (task) => queueBehaviorTask(task);

const touchSummary = (userId, payload) => queueWrite(async () => {
    await query(
        `INSERT INTO user_behavior_summary (user_id, summary_payload, last_activity_at, updated_at)
         VALUES ($1, COALESCE($2::jsonb, '{}'::jsonb), timezone('utc', now()), timezone('utc', now()))
         ON CONFLICT (user_id) DO UPDATE SET
            last_activity_at = GREATEST(COALESCE(user_behavior_summary.last_activity_at, timezone('utc', now())), EXCLUDED.last_activity_at),
            summary_payload = COALESCE(user_behavior_summary.summary_payload, '{}'::jsonb) || EXCLUDED.summary_payload,
            updated_at = EXCLUDED.updated_at`,
        [userId, JSON.stringify(payload || {})]
    );
});

const upsertSpeed = async (userId, seriesId, seconds) => {
    if (seconds === null || seconds === undefined || seconds < 5) return;

    await query(
        `INSERT INTO user_behavior_reading_speed_profiles
            (user_id, average_chapter_seconds, samples_count, reading_speed, last_calculated_at)
         VALUES ($1, $2, 1, CASE WHEN $2 > 45 THEN 'lector_real' ELSE 'scrolleador' END, timezone('utc', now()))
         ON CONFLICT (user_id) DO UPDATE SET
            average_chapter_seconds = ((user_behavior_reading_speed_profiles.average_chapter_seconds * user_behavior_reading_speed_profiles.samples_count) + EXCLUDED.average_chapter_seconds) / (user_behavior_reading_speed_profiles.samples_count + 1),
            samples_count = user_behavior_reading_speed_profiles.samples_count + 1,
            reading_speed = CASE WHEN (((user_behavior_reading_speed_profiles.average_chapter_seconds * user_behavior_reading_speed_profiles.samples_count) + EXCLUDED.average_chapter_seconds) / (user_behavior_reading_speed_profiles.samples_count + 1)) > 45 THEN 'lector_real' ELSE 'scrolleador' END,
            last_calculated_at = timezone('utc', now()),
            updated_at = timezone('utc', now())`,
        [userId, seconds]
    );

    await query(
        `INSERT INTO user_behavior_work_reading_speed_profiles
            (user_id, series_id, average_chapter_seconds, samples_count, reading_speed, last_calculated_at)
         VALUES ($1, $2, $3, 1, CASE WHEN $3 > 45 THEN 'lector_real' ELSE 'scrolleador' END, timezone('utc', now()))
         ON CONFLICT (user_id, series_id) DO UPDATE SET
            average_chapter_seconds = ((user_behavior_work_reading_speed_profiles.average_chapter_seconds * user_behavior_work_reading_speed_profiles.samples_count) + EXCLUDED.average_chapter_seconds) / (user_behavior_work_reading_speed_profiles.samples_count + 1),
            samples_count = user_behavior_work_reading_speed_profiles.samples_count + 1,
            reading_speed = CASE WHEN (((user_behavior_work_reading_speed_profiles.average_chapter_seconds * user_behavior_work_reading_speed_profiles.samples_count) + EXCLUDED.average_chapter_seconds) / (user_behavior_work_reading_speed_profiles.samples_count + 1)) > 45 THEN 'lector_real' ELSE 'scrolleador' END,
            last_calculated_at = timezone('utc', now()),
            updated_at = timezone('utc', now())`,
        [userId, seriesId, seconds]
    );

    const profile = await query(
        `SELECT average_chapter_seconds, samples_count, reading_speed
         FROM user_behavior_reading_speed_profiles
         WHERE user_id = $1`,
        [userId]
    );

    const row = profile.rows[0] || {};
    await query(
        `INSERT INTO user_behavior_summary
            (user_id, reading_speed, average_chapter_seconds, speed_samples_count, speed_classified_at, updated_at)
         VALUES ($1, $2, $3, $4, timezone('utc', now()), timezone('utc', now()))
         ON CONFLICT (user_id) DO UPDATE SET
            reading_speed = EXCLUDED.reading_speed,
            average_chapter_seconds = EXCLUDED.average_chapter_seconds,
            speed_samples_count = EXCLUDED.speed_samples_count,
            speed_classified_at = EXCLUDED.speed_classified_at,
            updated_at = EXCLUDED.updated_at`,
        [userId, row.reading_speed || (seconds > 45 ? 'lector_real' : 'scrolleador'), Number(row.average_chapter_seconds || seconds), Number(row.samples_count || 1)]
    );
};

exports.trackSessionStart = async (req, res) => {
    const body = parseBody(schemas.sessionStart, req, res); if (!body) return;
    const userId = req.user.id;
    const sessionId = body.session_id || randomUUID();
    const timezone = body.timezone || req.user.timezone || 'UTC';
    const startedAt = body.started_at || body.local_timestamp || nowUtc();

    queueWrite(async () => {
        await query(
            `INSERT INTO user_behavior_reading_sessions
                (session_id, user_id, series_id, chapter_id, chapter_number, timezone, started_at, client_local_timestamp, page_url, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (session_id) DO UPDATE SET
                series_id = EXCLUDED.series_id,
                chapter_id = COALESCE(EXCLUDED.chapter_id, user_behavior_reading_sessions.chapter_id),
                chapter_number = COALESCE(EXCLUDED.chapter_number, user_behavior_reading_sessions.chapter_number),
                timezone = EXCLUDED.timezone,
                started_at = LEAST(user_behavior_reading_sessions.started_at, EXCLUDED.started_at),
                client_local_timestamp = EXCLUDED.client_local_timestamp,
                page_url = COALESCE(EXCLUDED.page_url, user_behavior_reading_sessions.page_url),
                updated_at = timezone('utc', now())`,
            [sessionId, userId, body.series_id, body.chapter_id || null, toInt(body.chapter_number), timezone, startedAt, body.local_timestamp || startedAt, body.page_url || null]
        );
    });

    touchSummary(userId, { last_session_id: sessionId, last_series_id: body.series_id });
    return res.status(202).json({ success: true, queued: true, session_id: sessionId, timestamp: nowUtc() });
};

exports.trackChapterProgress = async (req, res) => {
    const body = parseBody(schemas.chapterProgress, req, res); if (!body) return;
    const userId = req.user.id;
    const sessionId = body.session_id || randomUUID();
    const timezone = body.timezone || req.user.timezone || 'UTC';
    const timestamp = body.local_timestamp || nowUtc();

    queueWrite(async () => {
        await query(
            `INSERT INTO user_behavior_chapter_progress
                (user_id, series_id, chapter_id, session_id, chapter_number, progress_percent, scroll_depth_percent, seconds_on_page, timezone, local_timestamp, page_url, arrived_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, timezone('utc', now()), timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (user_id, series_id, chapter_id, session_id) DO UPDATE SET
                chapter_number = COALESCE(EXCLUDED.chapter_number, user_behavior_chapter_progress.chapter_number),
                progress_percent = GREATEST(COALESCE(user_behavior_chapter_progress.progress_percent, 0), COALESCE(EXCLUDED.progress_percent, 0)),
                scroll_depth_percent = GREATEST(COALESCE(user_behavior_chapter_progress.scroll_depth_percent, 0), COALESCE(EXCLUDED.scroll_depth_percent, 0)),
                seconds_on_page = GREATEST(COALESCE(user_behavior_chapter_progress.seconds_on_page, 0), COALESCE(EXCLUDED.seconds_on_page, 0)),
                timezone = EXCLUDED.timezone,
                local_timestamp = EXCLUDED.local_timestamp,
                page_url = COALESCE(EXCLUDED.page_url, user_behavior_chapter_progress.page_url),
                updated_at = timezone('utc', now())`,
            [userId, body.series_id, body.chapter_id, sessionId, toInt(body.chapter_number), toFloat(body.progress_percent), toFloat(body.scroll_depth_percent), toInt(body.seconds_on_page), timezone, timestamp, body.page_url || null]
        );

        await query(
            `UPDATE user_behavior_reading_sessions
             SET chapters_read_in_session = GREATEST(COALESCE(chapters_read_in_session, 0), COALESCE($2, 0)),
                 scroll_depth_max = GREATEST(COALESCE(scroll_depth_max, 0), COALESCE($3, 0)),
                 total_progress_events = COALESCE(total_progress_events, 0) + 1,
                 updated_at = timezone('utc', now())
             WHERE session_id = $1`,
            [sessionId, toInt(body.chapter_number), toFloat(body.scroll_depth_percent)]
        );
    });

    touchSummary(userId, { last_series_id: body.series_id, last_chapter_id: body.chapter_id });
    return res.status(202).json({ success: true, queued: true, timestamp: nowUtc() });
};

exports.trackChapterComplete = async (req, res) => {
    const body = parseBody(schemas.chapterComplete, req, res); if (!body) return;
    const userId = req.user.id;
    const sessionId = body.session_id || randomUUID();
    const timezone = body.timezone || req.user.timezone || 'UTC';
    const timestamp = body.local_timestamp || nowUtc();
    const secondsOnPage = toInt(body.seconds_on_page, null);

    queueWrite(async () => {
        await query(
            `INSERT INTO user_behavior_chapter_progress
                (user_id, series_id, chapter_id, session_id, chapter_number, progress_percent, scroll_depth_percent, seconds_on_page, timezone, local_timestamp, completed_at, is_completed, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, timezone('utc', now()), true, timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (user_id, series_id, chapter_id, session_id) DO UPDATE SET
                chapter_number = COALESCE(EXCLUDED.chapter_number, user_behavior_chapter_progress.chapter_number),
                progress_percent = GREATEST(COALESCE(user_behavior_chapter_progress.progress_percent, 0), COALESCE(EXCLUDED.progress_percent, 0)),
                scroll_depth_percent = GREATEST(COALESCE(user_behavior_chapter_progress.scroll_depth_percent, 0), COALESCE(EXCLUDED.scroll_depth_percent, 0)),
                seconds_on_page = GREATEST(COALESCE(user_behavior_chapter_progress.seconds_on_page, 0), COALESCE(EXCLUDED.seconds_on_page, 0)),
                timezone = EXCLUDED.timezone,
                local_timestamp = EXCLUDED.local_timestamp,
                completed_at = timezone('utc', now()),
                is_completed = true,
                updated_at = timezone('utc', now())`,
            [userId, body.series_id, body.chapter_id, sessionId, toInt(body.chapter_number), toFloat(body.progress_percent), toFloat(body.scroll_depth_percent), secondsOnPage, timezone, timestamp]
        );

        await query(
            `UPDATE user_behavior_reading_sessions
             SET chapters_read_in_session = GREATEST(COALESCE(chapters_read_in_session, 0), COALESCE($2, 0)),
                 scroll_depth_max = GREATEST(COALESCE(scroll_depth_max, 0), COALESCE($3, 0)),
                 total_progress_events = COALESCE(total_progress_events, 0) + 1,
                 ended_at = COALESCE(ended_at, timezone('utc', now())),
                 exit_reason = COALESCE(exit_reason, 'completed'),
                 duration_seconds = CASE WHEN $4 IS NULL OR $4 < 5 THEN duration_seconds ELSE GREATEST(COALESCE(duration_seconds, 0), $4) END,
                 updated_at = timezone('utc', now())
             WHERE session_id = $1`,
            [sessionId, toInt(body.chapter_number), toFloat(body.scroll_depth_percent), secondsOnPage]
        );

        if (secondsOnPage !== null && secondsOnPage >= 5) {
            await upsertSpeed(userId, body.series_id, secondsOnPage);
        }

        if (body.recommendation_impression_id) {
            await query(
                `UPDATE user_behavior_recommendation_impressions
                 SET converted = true, converted_at = timezone('utc', now()), chapters_read_post_conversion = GREATEST(COALESCE(chapters_read_post_conversion, 0), COALESCE($2, 1)), updated_at = timezone('utc', now())
                 WHERE impression_id = $1`,
                [body.recommendation_impression_id, toInt(body.chapters_read_in_session, 1)]
            );

            await query(
                `INSERT INTO user_behavior_recommendation_conversions
                    (impression_id, user_id, recommended_series_id, converted_at, chapters_read_post_conversion, created_at, updated_at)
                 VALUES ($1, $2, $3, timezone('utc', now()), $4, timezone('utc', now()), timezone('utc', now()))
                 ON CONFLICT (impression_id) DO UPDATE SET
                    converted_at = EXCLUDED.converted_at,
                    chapters_read_post_conversion = EXCLUDED.chapters_read_post_conversion,
                    updated_at = EXCLUDED.updated_at`,
                [body.recommendation_impression_id, userId, body.series_id, toInt(body.chapters_read_in_session, 1)]
            );
        }
    });

    touchSummary(userId, { last_series_id: body.series_id, last_chapter_id: body.chapter_id, last_complete: true });
    return res.status(202).json({ success: true, queued: true, timestamp: nowUtc() });
};

exports.trackWorkAbandon = async (req, res) => {
    const body = parseBody(schemas.workAbandon, req, res); if (!body) return;
    const userId = req.user.id;
    const timezone = body.timezone || req.user.timezone || 'UTC';

    queueWrite(async () => {
        await query(
            `INSERT INTO user_behavior_work_abandonments
                (user_id, series_id, last_chapter_id, last_chapter_number, abandoned_at, days_without_activity, abandonment_source, timezone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, timezone('utc', now()), $5, 'client', $6, timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (user_id, series_id) DO UPDATE SET
                last_chapter_id = EXCLUDED.last_chapter_id,
                last_chapter_number = EXCLUDED.last_chapter_number,
                abandoned_at = EXCLUDED.abandoned_at,
                days_without_activity = EXCLUDED.days_without_activity,
                abandonment_source = EXCLUDED.abandonment_source,
                timezone = EXCLUDED.timezone,
                updated_at = EXCLUDED.updated_at`,
            [userId, body.series_id, body.chapter_id || null, toInt(body.chapter_number), toInt(body.days_without_activity, 7), timezone]
        );
    });

    touchSummary(userId, { last_series_id: body.series_id, abandoned: true });
    return res.status(202).json({ success: true, queued: true, timestamp: nowUtc() });
};

exports.trackSearchQuery = async (req, res) => {
    const body = parseBody(schemas.searchQuery, req, res); if (!body) return;
    const userId = req.user.id;
    const queryText = body.query_text || body.query_texto;
    if (!queryText) return res.status(400).json({ success: false, message: 'query_text es requerido' });
    const normalized = queryText.trim().toLowerCase();
    const timezone = body.timezone || req.user.timezone || 'UTC';

    queueWrite(async () => {
        await query(
            `INSERT INTO user_behavior_search_queries (user_id, query_text, query_normalized, result_clicked_series_id, timezone, searched_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, timezone('utc', now()), timezone('utc', now()), timezone('utc', now()))`,
            [userId, queryText, normalized, body.result_clicked_series_id || null, timezone]
        );

        await query(
            `INSERT INTO global_behavior_search_queries (query_text, query_normalized, search_count, click_count, first_seen_at, last_seen_at, created_at, updated_at)
             VALUES ($1, $2, 1, CASE WHEN $3 IS NULL THEN 0 ELSE 1 END, timezone('utc', now()), timezone('utc', now()), timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (query_normalized) DO UPDATE SET
                query_text = EXCLUDED.query_text,
                search_count = global_behavior_search_queries.search_count + 1,
                click_count = global_behavior_search_queries.click_count + CASE WHEN EXCLUDED.click_count > 0 THEN 1 ELSE 0 END,
                last_seen_at = EXCLUDED.last_seen_at,
                updated_at = EXCLUDED.updated_at`,
            [queryText, normalized, body.result_clicked_series_id || null]
        );
    });

    touchSummary(userId, { last_search_query: queryText });
    return res.status(202).json({ success: true, queued: true, timestamp: nowUtc() });
};

exports.trackRecommendationImpression = async (req, res) => {
    const body = parseBody(schemas.recoImpression, req, res); if (!body) return;
    const userId = req.user.id;
    const impressionId = body.recommendation_impression_id || randomUUID();
    const shownAt = body.mostrado_en || nowUtc();
    const timezone = body.timezone || req.user.timezone || 'UTC';

    queueWrite(async () => {
        await query(
            `INSERT INTO user_behavior_recommendation_impressions
                (impression_id, user_id, recommended_series_id, source_algorithm, banner_position, shown_at, timezone, recommendation_context, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::jsonb, '{}'::jsonb), timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (impression_id) DO UPDATE SET
                recommended_series_id = EXCLUDED.recommended_series_id,
                source_algorithm = EXCLUDED.source_algorithm,
                banner_position = EXCLUDED.banner_position,
                shown_at = EXCLUDED.shown_at,
                timezone = EXCLUDED.timezone,
                recommendation_context = COALESCE(EXCLUDED.recommendation_context, user_behavior_recommendation_impressions.recommendation_context),
                updated_at = EXCLUDED.updated_at`,
            [impressionId, userId, body.recommended_series_id, body.algoritmo_origen, toInt(body.banner_position), shownAt, timezone, body.recommendation_context ? JSON.stringify(body.recommendation_context) : null]
        );
    });

    touchSummary(userId, { last_recommendation_impression_id: impressionId });
    return res.status(202).json({ success: true, queued: true, impression_id: impressionId, timestamp: nowUtc() });
};

exports.trackRecommendationClick = async (req, res) => {
    const body = parseBody(schemas.recoClick, req, res); if (!body) return;
    const userId = req.user.id;
    const clickedAt = body.clicked_at || nowUtc();
    const timezone = body.timezone || req.user.timezone || 'UTC';

    queueWrite(async () => {
        await query(
            `INSERT INTO user_behavior_recommendation_clicks
                (impression_id, user_id, recommended_series_id, clicked_at, chapters_read_post_conversion, timezone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (impression_id) DO UPDATE SET
                clicked_at = EXCLUDED.clicked_at,
                chapters_read_post_conversion = GREATEST(COALESCE(user_behavior_recommendation_clicks.chapters_read_post_conversion, 0), EXCLUDED.chapters_read_post_conversion),
                timezone = EXCLUDED.timezone,
                updated_at = EXCLUDED.updated_at`,
            [body.recommendation_impression_id, userId, body.recommended_series_id, clickedAt, toInt(body.chapters_read_post_conversion, 0), timezone]
        );

        await query(
            `UPDATE user_behavior_recommendation_impressions
             SET clicked_at = COALESCE(clicked_at, $2), updated_at = timezone('utc', now())
             WHERE impression_id = $1`,
            [body.recommendation_impression_id, clickedAt]
        );
    });

    touchSummary(userId, { last_recommendation_click_id: body.recommendation_impression_id });
    return res.status(202).json({ success: true, queued: true, timestamp: nowUtc() });
};

exports.getRecommendationFeedbackSummary = async (req, res) => {
    try {
        const userId = req.user.id;
        const rawQueries = String(req.query.queries || '').trim();

        if (!rawQueries) {
            return res.json({ success: true, feedback: {} });
        }

        const normalizedQueries = Array.from(new Set(
            rawQueries
                .split(',')
                .map((q) => String(q || '').trim().toLowerCase())
                .filter(Boolean)
                .slice(0, 30)
        ));

        if (normalizedQueries.length === 0) {
            return res.json({ success: true, feedback: {} });
        }

        const statsResult = await query(
            `WITH base AS (
                SELECT
                    lower(trim(recommendation_context->>'carousel_query')) AS query_norm,
                    shown_at,
                    clicked_at,
                    created_at
                FROM user_behavior_recommendation_impressions
                WHERE user_id = $1
                  AND recommendation_context IS NOT NULL
                  AND recommendation_context ? 'carousel_query'
                  AND lower(trim(recommendation_context->>'carousel_query')) = ANY($2::text[])
            ),
            ranked AS (
                SELECT
                    query_norm,
                    clicked_at,
                    row_number() OVER (PARTITION BY query_norm ORDER BY shown_at DESC NULLS LAST, created_at DESC) AS rn
                FROM base
            )
            SELECT
                b.query_norm,
                COUNT(*)::int AS impressions,
                COUNT(b.clicked_at)::int AS clicks,
                MAX(b.shown_at) AS last_shown_at,
                MAX(b.clicked_at) AS last_clicked_at,
                SUM(CASE WHEN r.rn <= 3 AND r.clicked_at IS NULL THEN 1 ELSE 0 END)::int AS no_click_last3,
                SUM(CASE WHEN r.rn <= 3 THEN 1 ELSE 0 END)::int AS recent_sample
            FROM base b
            LEFT JOIN ranked r ON r.query_norm = b.query_norm
            GROUP BY b.query_norm`,
            [userId, normalizedQueries]
        );

        const feedback = {};
        for (let i = 0; i < statsResult.rows.length; i++) {
            const row = statsResult.rows[i];
            const queryNorm = String(row.query_norm || '').trim().toLowerCase();
            if (!queryNorm) continue;

            const impressions = Number(row.impressions) || 0;
            const clicks = Number(row.clicks) || 0;
            const ctr = impressions > 0 ? (clicks / impressions) : 0;

            feedback[queryNorm] = {
                impressions,
                clicks,
                ctr,
                noClickLast3: Number(row.no_click_last3) || 0,
                recentSample: Number(row.recent_sample) || 0,
                lastShownAt: row.last_shown_at || null,
                lastClickedAt: row.last_clicked_at || null,
            };
        }

        return res.json({ success: true, feedback });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'No se pudo obtener feedback de recomendaciones' });
    }
};

exports.trackSessionEnd = async (req, res) => {
    const body = parseBody(schemas.sessionEnd, req, res); if (!body) return;
    const userId = req.user.id;
    const timezone = body.timezone || req.user.timezone || 'UTC';
    const endedAt = body.ended_at || nowUtc();
    const durationSeconds = toInt(body.duration_seconds, null);

    queueWrite(async () => {
        await query(
            `UPDATE user_behavior_reading_sessions
             SET ended_at = COALESCE(ended_at, $2),
                 duration_seconds = CASE WHEN $3 IS NULL THEN duration_seconds ELSE GREATEST(COALESCE(duration_seconds, 0), $3) END,
                 scroll_depth_max = GREATEST(COALESCE(scroll_depth_max, 0), COALESCE($4, 0)),
                 chapters_read_in_session = GREATEST(COALESCE(chapters_read_in_session, 0), COALESCE($5, 0)),
                 exit_reason = COALESCE($6, exit_reason),
                 timezone = COALESCE($7, timezone),
                 updated_at = timezone('utc', now())
             WHERE session_id = $1`,
            [body.session_id, endedAt, durationSeconds, toFloat(body.scroll_depth_percent), toInt(body.chapters_read_in_session), body.exit_reason || null, timezone]
        );

        if (durationSeconds !== null && durationSeconds >= 5 && body.series_id && body.chapter_id) {
            const alreadyCompleted = await query(
                `SELECT 1
                 FROM user_behavior_chapter_progress
                 WHERE user_id = $1
                   AND series_id = $2
                   AND chapter_id = $3
                   AND session_id = $4
                   AND is_completed = true
                 LIMIT 1`,
                [userId, body.series_id, body.chapter_id, body.session_id]
            );

            if (alreadyCompleted.rowCount === 0) {
                await upsertSpeed(userId, body.series_id, durationSeconds);
            }
        }
    });

    touchSummary(userId, { last_session_end: body.session_id, last_series_id: body.series_id });
    return res.status(202).json({ success: true, queued: true, timestamp: nowUtc() });
};
