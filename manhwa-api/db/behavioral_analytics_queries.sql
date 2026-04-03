-- Ready-to-use aggregation queries for behavioral analytics

SELECT
    s.*,
    r.reader_archetype,
    r.reader_archetype_confidence,
    e.engagement_profile,
    p.prime_time_slot,
    p.timezone AS prime_time_timezone,
    sp.reading_speed,
    sp.average_chapter_seconds,
    sp.samples_count,
    w.average_chapter_seconds AS work_average_chapter_seconds,
    w.reading_speed AS work_reading_speed
FROM user_behavior_summary s
LEFT JOIN LATERAL (
    SELECT reader_archetype, reader_archetype_confidence
    FROM user_behavior_reader_archetypes
    WHERE user_id = s.user_id
    ORDER BY week_start_date DESC
    LIMIT 1
) r ON TRUE
LEFT JOIN LATERAL (
    SELECT engagement_profile
    FROM user_behavior_engagement_profiles
    WHERE user_id = s.user_id
    ORDER BY classification_date DESC
    LIMIT 1
) e ON TRUE
LEFT JOIN LATERAL (
    SELECT prime_time_slot, timezone
    FROM user_behavior_prime_time_profiles
    WHERE user_id = s.user_id
    ORDER BY classification_date DESC
    LIMIT 1
) p ON TRUE
LEFT JOIN user_behavior_reading_speed_profiles sp ON sp.user_id = s.user_id
LEFT JOIN LATERAL (
    SELECT average_chapter_seconds, reading_speed
    FROM user_behavior_work_reading_speed_profiles
    WHERE user_id = s.user_id
    ORDER BY samples_count DESC, updated_at DESC
    LIMIT 1
) w ON TRUE
WHERE s.user_id = $1;

SELECT top_genres, top_tropes
FROM user_behavior_summary
WHERE user_id = $1;

SELECT
    s.user_id,
    COALESCE(p.prime_time_slot, s.prime_time_slot) AS prime_time_slot,
    COALESCE(r.reader_archetype, s.reader_archetype) AS reader_archetype,
    COALESCE(r.reader_archetype_confidence, s.reader_archetype_confidence) AS confidence
FROM user_behavior_summary s
LEFT JOIN LATERAL (
    SELECT prime_time_slot
    FROM user_behavior_prime_time_profiles
    WHERE user_id = s.user_id
    ORDER BY classification_date DESC
    LIMIT 1
) p ON TRUE
LEFT JOIN LATERAL (
    SELECT reader_archetype, reader_archetype_confidence
    FROM user_behavior_reader_archetypes
    WHERE user_id = s.user_id
    ORDER BY week_start_date DESC
    LIMIT 1
) r ON TRUE
WHERE s.user_id = $1;

SELECT
    wa.series_id,
    wa.last_chapter_id,
    wa.last_chapter_number,
    wa.days_without_activity,
    wa.abandoned_at,
    s.title,
    s.slug,
    c.title AS chapter_title,
    c.number AS chapter_number
FROM user_behavior_work_abandonments wa
JOIN series s ON s.id = wa.series_id
LEFT JOIN chapters c ON c.id = wa.last_chapter_id
WHERE wa.user_id = $1
ORDER BY wa.abandoned_at DESC;

SELECT
    ri.user_id,
    ri.recommended_series_id,
    ri.source_algorithm,
    ri.banner_position,
    COUNT(*) AS impressions,
    COUNT(rc.id) AS clicks,
    COUNT(conv.id) AS conversions,
    ROUND((COUNT(rc.id)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS click_rate_pct,
    ROUND((COUNT(conv.id)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS conversion_rate_pct,
    ROUND(AVG(COALESCE(conv.chapters_read_post_conversion, 0))::numeric, 2) AS avg_chapters_post_conversion
FROM user_behavior_recommendation_impressions ri
LEFT JOIN user_behavior_recommendation_clicks rc ON rc.impression_id = ri.impression_id
LEFT JOIN user_behavior_recommendation_conversions conv ON conv.impression_id = ri.impression_id
WHERE ri.user_id = $1
GROUP BY ri.user_id, ri.recommended_series_id, ri.source_algorithm, ri.banner_position
ORDER BY conversions DESC, clicks DESC, impressions DESC;

SELECT
    source_algorithm,
    banner_position,
    COUNT(*) AS impressions,
    COUNT(*) FILTER (WHERE converted) AS conversions,
    ROUND((COUNT(*) FILTER (WHERE converted)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS conversion_rate_pct
FROM user_behavior_recommendation_impressions
GROUP BY source_algorithm, banner_position
ORDER BY conversion_rate_pct DESC, impressions DESC;

SELECT
    s.user_id,
    s.reader_archetype,
    s.reader_archetype_confidence,
    s.engagement_profile,
    s.prime_time_slot,
    s.reading_speed,
    s.average_chapter_seconds,
    s.top_genres,
    s.top_tropes,
    s.abandoned_works,
    s.recommendation_stats,
    s.search_stats,
    s.session_stats,
    s.last_activity_at
FROM user_behavior_summary s
WHERE s.user_id = $1;