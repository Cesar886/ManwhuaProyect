/**
 * Agregaciones y Queries para Analytics
 * 
 * Funciones SQL y utilidades para:
 * - Extraer top géneros/tropos
 * - Calcular tasas de finalización
 * - Detectar patrones de abandono
 * - Encontrar obras re-leídas
 * - Generar recomendaciones
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// 1. TOP GÉNEROS (Top 3 por usuario)
// ============================================
exports.getUserTopGenres = async (userId, limit = 3) => {
    const sql = `
        SELECT 
            g.id,
            g.name,
            g.slug,
            ugp.weighted_score,
            ugp.total_time_minutes,
            ugp.view_count,
            ugp.last_interaction,
            RANK() OVER (ORDER BY ugp.weighted_score DESC) as rank
        FROM user_genre_preferences ugp
        JOIN genres g ON ugp.genre_id = g.id
        WHERE ugp.user_id = $1
        ORDER BY ugp.weighted_score DESC
        LIMIT $2
    `;

    try {
        const result = await query(sql, [userId, limit]);
        return result.rows;
    } catch (error) {
        logger.error('Error getting top genres:', error);
        throw error;
    }
};

// ============================================
// 2. TOP TROPOS (Top 5 por usuario)
// ============================================
exports.getUserTopTropes = async (userId, limit = 5) => {
    const sql = `
        SELECT 
            trope_name,
            afinidad_score,
            appearance_count,
            total_time_minutes,
            RANK() OVER (ORDER BY afinidad_score DESC) as rank
        FROM user_trope_preferences
        WHERE user_id = $1
        ORDER BY afinidad_score DESC
        LIMIT $2
    `;

    try {
        const result = await query(sql, [userId, limit]);
        return result.rows;
    } catch (error) {
        logger.error('Error getting top tropes:', error);
        throw error;
    }
};

// ============================================
// 3. TASA DE FINALIZACIÓN PROMEDIO
// ============================================
exports.getUserCompletionStats = async (userId) => {
    const sql = `
        SELECT 
            COUNT(*) as total_works,
            COUNT(*) FILTER (WHERE is_completed) as completed_works,
            COUNT(*) FILTER (WHERE status = 'reading') as reading_works,
            COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_works,
            ROUND(AVG(completion_percentage)::numeric, 2)::float as avg_completion_percentage,
            ROUND(AVG(total_time_minutes)::numeric, 2)::float as avg_time_per_work,
            MAX(total_time_minutes)::float as total_time_all_works
        FROM work_completion_stats
        WHERE user_id = $1
    `;

    try {
        const result = await query(sql, [userId]);
        return result.rows[0] || {};
    } catch (error) {
        logger.error('Error getting completion stats:', error);
        throw error;
    }
};

// ============================================
// 4. OBRAS ABANDONADAS (Con detalles)
// ============================================
exports.getUserAbandonedWorks = async (userId, limit = 10) => {
    const sql = `
        SELECT 
            wa.work_id,
            s.title,
            s.slug,
            s.cover_url,
            wa.last_chapter_number,
            wa.total_chapters_available,
            ROUND(wa.abandonment_percentage::numeric, 2)::float as abandonment_percentage,
            wa.last_access,
            wa.days_without_activity,
            EXTRACT(DAY FROM (CURRENT_TIMESTAMP - wa.last_access))::integer as days_since_last_access,
            wa.confidence_score,
            wa.detection_date
        FROM work_abandonment wa
        JOIN series s ON wa.work_id = s.id
        WHERE wa.user_id = $1
        ORDER BY wa.last_access DESC
        LIMIT $2
    `;

    try {
        const result = await query(sql, [userId, limit]);
        return result.rows;
    } catch (error) {
        logger.error('Error getting abandoned works:', error);
        throw error;
    }
};

// ============================================
// 5. OBRAS RE-LEÍDAS (Con frecuencia)
// ============================================
exports.getUserRereads = async (userId, limit = 10) => {
    const sql = `
        SELECT 
            wr.work_id,
            s.title,
            s.slug,
            s.cover_url,
            wr.reread_count,
            wr.first_completion_date,
            wr.last_reread_date,
            wr.days_since_first_completion,
            ROUND(wr.avg_days_between_rereads::numeric, 1)::float as avg_days_between_rereads
        FROM work_rereads wr
        JOIN series s ON wr.work_id = s.id
        WHERE wr.user_id = $1
        ORDER BY wr.reread_count DESC
        LIMIT $2
    `;

    try {
        const result = await query(sql, [userId, limit]);
        return result.rows;
    } catch (error) {
        logger.error('Error getting rereads:', error);
        throw error;
    }
};

// ============================================
// 6. DATOS PARA SISTEMA DE RECOMENDACIÓN
// ============================================
exports.getUserPreferencesForRecommendation = async (userId) => {
    try {
        const [genres, tropes, completionStats, abandoned, rereads] = await Promise.all([
            exports.getUserTopGenres(userId, 5),
            exports.getUserTopTropes(userId, 10),
            exports.getUserCompletionStats(userId),
            exports.getUserAbandonedWorks(userId, 5),
            exports.getUserRereads(userId, 5)
        ]);

        return {
            user_id: userId,
            top_genres: genres,
            top_tropes: tropes,
            completion_stats: completionStats,
            abandoned_pattern: {
                works: abandoned,
                analysis: {
                    total_abandoned: abandoned.length,
                    avg_completion_at_abandon: abandoned.length > 0
                        ? Math.round(
                            abandoned.reduce((sum, w) => sum + w.abandonment_percentage, 0) / abandoned.length
                        )
                        : 0
                }
            },
            reread_pattern: {
                works: rereads,
                analysis: {
                    total_rereads: rereads.length,
                    total_reread_count: rereads.reduce((sum, w) => sum + w.reread_count, 0)
                }
            },
            generated_at: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error building user preferences:', error);
        throw error;
    }
};

// ============================================
// 7. COHORT ANALYSIS (Grupos de usuarios por patrón)
// ============================================
exports.getCompletionRateCohort = async () => {
    const sql = `
        SELECT 
            CASE 
                WHEN avg_completion_completed IS NULL THEN 'Non-Active'
                WHEN avg_completion_completed < 25 THEN 'Low Completion'
                WHEN avg_completion_completed < 50 THEN 'Medium Completion'
                WHEN avg_completion_completed < 75 THEN 'High Completion'
                ELSE 'Very High Completion'
            END as cohort,
            COUNT(DISTINCT user_id) as user_count,
            AVG(completed_works) as avg_completed,
            AVG(abandoned_works) as avg_abandoned,
            AVG(reading_works) as avg_reading
        FROM user_work_status_summary
        GROUP BY cohort
    `;

    try {
        const result = await query(sql);
        return result.rows;
    } catch (error) {
        logger.error('Error in cohort analysis:', error);
        throw error;
    }
};

// ============================================
// 8. TRENDING GENRES (Géneros con más engagement)
// ============================================
exports.getTrendingGenres = async (lastNDays = 7) => {
    const sql = `
        SELECT 
            g.id,
            g.name,
            g.slug,
            COUNT(DISTINCT ugp.user_id) as user_count,
            ROUND(AVG(ugp.total_time_minutes)::numeric, 2)::float as avg_time_per_user,
            SUM(ugp.view_count) as total_views,
            ROUND(AVG(ugp.weighted_score)::numeric, 4)::float as avg_engagement
        FROM user_genre_preferences ugp
        JOIN genres g ON ugp.genre_id = g.id
        WHERE ugp.last_interaction >= (CURRENT_TIMESTAMP - INTERVAL '${lastNDays} days')
        GROUP BY g.id, g.name, g.slug
        ORDER BY total_views DESC
        LIMIT 10
    `;

    try {
        const result = await query(sql);
        return result.rows;
    } catch (error) {
        logger.error('Error getting trending genres:', error);
        throw error;
    }
};

// ============================================
// 9. TOP ENGAGEMENT USERS (Quiénes leen más)
// ============================================
exports.getTopEngagementUsers = async (limit = 20) => {
    const sql = `
        SELECT 
            cp.user_id,
            COUNT(DISTINCT cp.work_id) as works_reading,
            COUNT(DISTINCT cp.work_id) FILTER (WHERE cp.status = 'completed') as works_completed,
            ROUND(AVG(wcs.total_time_minutes)::numeric, 2)::float as avg_time_per_work,
            SUM(wcs.total_time_minutes)::float as total_time_all_works,
            MAX(cp.last_read_at) as last_activity
        FROM chapter_progress cp
        LEFT JOIN work_completion_stats wcs ON cp.user_id = wcs.user_id AND cp.work_id = wcs.work_id
        GROUP BY cp.user_id
        ORDER BY total_time_all_works DESC
        LIMIT $1
    `;

    try {
        const result = await query(sql, [limit]);
        return result.rows;
    } catch (error) {
        logger.error('Error getting top engagement users:', error);
        throw error;
    }
};

// ============================================
// 10. RETENTION ANALYSIS (Qué obras retienen)
// ============================================
exports.getMostRetentiveWorks = async (limit = 10) => {
    const sql = `
        SELECT 
            s.id,
            s.title,
            s.slug,
            COUNT(DISTINCT cp.user_id) as user_count,
            ROUND(
                (COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.status = 'completed')::numeric 
                 / COUNT(DISTINCT cp.user_id) * 100)::numeric, 2
            )::float as completion_rate,
            ROUND(AVG(wcs.completion_percentage)::numeric, 2)::float as avg_completion,
            SUM(wcs.total_time_minutes)::float as total_time_invested,
            COUNT(DISTINCT wr.user_id) as reread_count
        FROM series s
        LEFT JOIN chapter_progress cp ON s.id = cp.work_id
        LEFT JOIN work_completion_stats wcs ON s.id = wcs.work_id AND cp.user_id = wcs.user_id
        LEFT JOIN work_rereads wr ON s.id = wr.work_id
        WHERE cp.user_id IS NOT NULL
        GROUP BY s.id, s.title, s.slug
        HAVING COUNT(DISTINCT cp.user_id) >= 5  -- Al menos 5 usuarios
        ORDER BY completion_rate DESC
        LIMIT $1
    `;

    try {
        const result = await query(sql, [limit]);
        return result.rows;
    } catch (error) {
        logger.error('Error getting retention analysis:', error);
        throw error;
    }
};

// ============================================
// 11. EARLY WARNING: Obras con riesgo de abandono
// ============================================
exports.getAtRiskWorks = async () => {
    const sql = `
        SELECT 
            s.id,
            s.title,
            s.slug,
            COUNT(DISTINCT cp.user_id) as user_count,
            COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.status = 'abandoned') as abandoned_count,
            ROUND(
                (COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.status = 'abandoned')::numeric 
                 / COUNT(DISTINCT cp.user_id) * 100)::numeric, 2
            )::float as abandonment_rate,
            ROUND(AVG(wa.abandonment_percentage)::numeric, 2)::float as avg_abandon_point
        FROM series s
        LEFT JOIN chapter_progress cp ON s.id = cp.work_id
        LEFT JOIN work_abandonment wa ON s.id = wa.work_id
        WHERE cp.user_id IS NOT NULL
        GROUP BY s.id, s.title, s.slug
        HAVING 
            COUNT(DISTINCT cp.user_id) >= 3
            AND COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.status = 'abandoned') > 0
            AND (COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.status = 'abandoned')::numeric 
                 / COUNT(DISTINCT cp.user_id)) > 0.3  -- 30%+ abandonment
        ORDER BY abandonment_rate DESC
        LIMIT 10
    `;

    try {
        const result = await query(sql);
        return result.rows;
    } catch (error) {
        logger.error('Error getting at-risk works:', error);
        throw error;
    }
};

// ============================================
// 12. EXPORT: Todos los datos de usuario para ML
// ============================================
exports.exportUserDataForML = async (userId) => {
    try {
        const [
            topGenres,
            topTropes,
            completionStats,
            abandoned,
            rereads,
            sessions
        ] = await Promise.all([
            exports.getUserTopGenres(userId, 10),
            exports.getUserTopTropes(userId, 15),
            exports.getUserCompletionStats(userId),
            exports.getUserAbandonedWorks(userId, 50),
            exports.getUserRereads(userId, 50),
            query(`
                SELECT 
                    work_id,
                    chapter_id,
                    duration_seconds,
                    scroll_depth_percent,
                    is_completed,
                    created_at
                FROM reading_sessions
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 500
            `, [userId])
        ]);

        return {
            user_id: userId,
            profile: {
                top_genres: topGenres,
                top_tropes: topTropes,
                engagement: completionStats
            },
            behavior: {
                abandoned_works: abandoned,
                reread_works: rereads,
                reading_sessions: sessions.rows
            },
            generated_at: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error exporting user data:', error);
        throw error;
    }
};
