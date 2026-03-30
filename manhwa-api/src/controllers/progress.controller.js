/**
 * Controlador de Progreso de Lectura
 * Maneja la sincronización del progreso entre dispositivos
 */

const { query } = require('../config/database');

/**
 * Guardar o actualizar progreso de lectura
 * POST /api/progress
 */
const saveProgress = async (req, res, next) => {
    try {
        const {
            slug,
            chapterNum,
            scrollPosition = 0,
            progress = 0,
            totalPages = 0,
            isCompleted = false,
            deviceId = null
        } = req.body;

        const userId = req.user.id;

        // Buscar serie
        const seriesResult = await query(
            'SELECT id FROM series WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        const seriesId = seriesResult.rows[0].id;

        // Obtener o crear capítulo (los capítulos se sirven desde Spaces,
        // pero necesitamos un registro en la BD para el FK de reading_history)
        const chapterResult = await query(
            `INSERT INTO chapters (series_id, number, title, slug, is_published)
             VALUES ($1, $2, $3, $4, true)
             ON CONFLICT (series_id, number) DO UPDATE SET series_id = chapters.series_id
             RETURNING id`,
            [seriesId, chapterNum, `Capítulo ${chapterNum}`, `capitulo-${chapterNum}`]
        );

        const chapterId = chapterResult.rows[0].id;

        // UPSERT: insertar o actualizar en una sola operación atómica
        const result = await query(
            `INSERT INTO reading_history
                (user_id, series_id, chapter_id, scroll_position, progress_percentage,
                 total_pages, is_completed, device_id, synced_at, read_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             ON CONFLICT (user_id, chapter_id)
             DO UPDATE SET
                scroll_position = EXCLUDED.scroll_position,
                progress_percentage = EXCLUDED.progress_percentage,
                total_pages = EXCLUDED.total_pages,
                is_completed = CASE
                    WHEN reading_history.is_completed THEN true
                    ELSE EXCLUDED.is_completed
                END,
                device_id = EXCLUDED.device_id,
                synced_at = NOW(),
                read_at = NOW()
             RETURNING *`,
            [userId, seriesId, chapterId, scrollPosition, progress, totalPages, isCompleted, deviceId]
        );

        // Actualizar bookmark (UPSERT)
        await query(
            `INSERT INTO bookmarks (user_id, series_id, last_read_chapter_id, last_read_page, last_read_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, series_id)
             DO UPDATE SET
                last_read_chapter_id = $3,
                last_read_page = $4,
                last_read_at = NOW(),
                updated_at = NOW()`,
            [userId, seriesId, chapterId, Math.floor(progress)]
        );

        // Registrar dispositivo si se proporciona
        if (deviceId) {
            await query(
                `INSERT INTO user_devices (user_id, device_id, last_sync_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (user_id, device_id)
                 DO UPDATE SET last_sync_at = NOW()`,
                [userId, deviceId]
            );
        }

        res.json({
            success: true,
            data: {
                progress: {
                    slug,
                    chapterNum,
                    scrollPosition,
                    progress,
                    totalPages,
                    isCompleted: result.rows[0].is_completed,
                    syncedAt: result.rows[0].synced_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener progreso de un capítulo específico
 * GET /api/progress/:slug/:chapterNum
 */
const getProgress = async (req, res, next) => {
    try {
        const { slug, chapterNum } = req.params;
        const userId = req.user.id;

        const result = await query(
            `SELECT rh.scroll_position, rh.progress_percentage, rh.total_pages,
                    rh.is_completed, rh.synced_at, rh.read_at, rh.device_id
             FROM reading_history rh
             JOIN series s ON rh.series_id = s.id
             JOIN chapters c ON rh.chapter_id = c.id
             WHERE rh.user_id = $1 AND s.slug = $2 AND c.number = $3
               AND s.deleted_at IS NULL`,
            [userId, slug, parseFloat(chapterNum)]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: { progress: null }
            });
        }

        const p = result.rows[0];

        res.json({
            success: true,
            data: {
                progress: {
                    scrollPosition: p.scroll_position,
                    progress: parseFloat(p.progress_percentage),
                    totalPages: p.total_pages,
                    isCompleted: p.is_completed,
                    syncedAt: p.synced_at,
                    readAt: p.read_at,
                    deviceId: p.device_id
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Sincronizar todo el progreso del usuario
 * GET /api/progress/sync
 */
const syncProgress = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);

        const result = await query(
            `SELECT s.slug, c.number as chapter_num,
                    rh.scroll_position, rh.progress_percentage, rh.total_pages,
                    rh.is_completed, rh.synced_at, rh.read_at, rh.device_id
             FROM reading_history rh
             JOIN series s ON rh.series_id = s.id
             JOIN chapters c ON rh.chapter_id = c.id
             WHERE rh.user_id = $1
               AND s.deleted_at IS NULL
             ORDER BY rh.synced_at DESC
             LIMIT $2`,
            [userId, limit]
        );

        res.json({
            success: true,
            data: {
                progress: result.rows.map(p => ({
                    slug: p.slug,
                    chapterNum: p.chapter_num,
                    scrollPosition: p.scroll_position,
                    progress: parseFloat(p.progress_percentage),
                    totalPages: p.total_pages,
                    isCompleted: p.is_completed,
                    syncedAt: p.synced_at,
                    readAt: p.read_at,
                    deviceId: p.device_id
                })),
                count: result.rows.length
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener últimos capítulos leídos (para "Continuar leyendo")
 * GET /api/progress/recent
 */
const getRecentProgress = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        // Subquery para obtener el capítulo más reciente de cada serie,
        // luego ordenar por fecha y limitar
        const result = await query(
            `SELECT sub.* FROM (
                SELECT DISTINCT ON (rh.series_id)
                    s.id as series_id, s.slug, s.title, s.cover_url,
                    c.id as chapter_id, c.number as chapter_num, c.title as chapter_title,
                    rh.scroll_position, rh.progress_percentage, rh.is_completed, rh.read_at
                FROM reading_history rh
                JOIN series s ON rh.series_id = s.id
                JOIN chapters c ON rh.chapter_id = c.id
                WHERE rh.user_id = $1
                  AND s.deleted_at IS NULL
                ORDER BY rh.series_id, rh.read_at DESC
             ) sub
             ORDER BY sub.read_at DESC
             LIMIT $2`,
            [userId, limit]
        );

        res.json({
            success: true,
            data: {
                recent: result.rows.map(r => ({
                    series: {
                        id: r.series_id,
                        slug: r.slug,
                        title: r.title,
                        coverUrl: r.cover_url
                    },
                    chapter: {
                        id: r.chapter_id,
                        number: r.chapter_num,
                        title: r.chapter_title
                    },
                    progress: parseFloat(r.progress_percentage),
                    isCompleted: r.is_completed,
                    readAt: r.read_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar progreso de un capítulo específico
 * DELETE /api/progress/:slug/:chapterNum
 */
const deleteProgress = async (req, res, next) => {
    try {
        const { slug, chapterNum } = req.params;
        const userId = req.user.id;

        await query(
            `DELETE FROM reading_history rh
             USING series s, chapters c
             WHERE rh.series_id = s.id
               AND rh.chapter_id = c.id
               AND rh.user_id = $1
               AND s.slug = $2
               AND c.number = $3`,
            [userId, slug, parseFloat(chapterNum)]
        );

        res.json({
            success: true,
            message: 'Progreso eliminado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener racha de lectura del usuario
 * GET /api/progress/streak
 */
const getStreak = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const result = await query(
            `WITH reading_days AS (
               SELECT DISTINCT (read_at AT TIME ZONE 'UTC')::date AS day
               FROM reading_history
               WHERE user_id = $1
             ),
             today AS (
               SELECT (NOW() AT TIME ZONE 'UTC')::date AS d
             ),
             numbered AS (
               SELECT day,
                 day + ROW_NUMBER() OVER (ORDER BY day DESC) * INTERVAL '1 day' AS grp
               FROM reading_days
             ),
             most_recent_grp AS (
               SELECT grp FROM numbered ORDER BY day DESC LIMIT 1
             ),
             streak_calc AS (
               SELECT
                 COUNT(*) AS current_streak,
                 MIN(day) AS streak_start,
                 MAX(day) AS streak_end
               FROM numbered
               WHERE grp = (SELECT grp FROM most_recent_grp)
             ),
             today_check AS (
               SELECT EXISTS (
                 SELECT 1 FROM reading_days, today
                 WHERE reading_days.day >= today.d - INTERVAL '1 day'
               ) AS is_active
             ),
             all_streaks AS (
               SELECT grp, COUNT(*) AS streak_len
               FROM numbered
               GROUP BY grp
             ),
             stats AS (
               SELECT
                 COUNT(*) AS total_days_read,
                 (SELECT COALESCE(MAX(streak_len), 0) FROM all_streaks) AS max_streak
               FROM reading_days
             ),
             read_today AS (
               SELECT EXISTS (
                 SELECT 1 FROM reading_days, today
                 WHERE reading_days.day = today.d
               ) AS did_read
             )
             SELECT
               sc.current_streak,
               tc.is_active,
               sc.streak_start,
               sc.streak_end,
               s.total_days_read,
               s.max_streak,
               rt.did_read AS read_today,
               (SELECT COUNT(*) FROM reading_history WHERE user_id = $1) AS chapters_read
             FROM streak_calc sc, today_check tc, stats s, read_today rt`,
            [userId]
        );

        const row = result.rows[0];
        const streak = row?.is_active ? parseInt(row.current_streak) || 0 : 0;
        const maxStreak = Math.max(parseInt(row?.max_streak) || 0, streak);

        res.json({
            success: true,
            data: {
                streak,
                maxStreak,
                readToday: row?.read_today || false,
                totalDaysRead: parseInt(row?.total_days_read) || 0,
                chaptersRead: parseInt(row?.chapters_read) || 0,
                streakStart: streak > 0 ? row?.streak_start : null,
                lastReadAt: row?.streak_end || null
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Limpiar todo el progreso del usuario
 * DELETE /api/progress
 */
const clearAllProgress = async (req, res, next) => {
    try {
        const userId = req.user.id;

        await query(
            'DELETE FROM reading_history WHERE user_id = $1',
            [userId]
        );

        res.json({
            success: true,
            message: 'Todo el progreso ha sido eliminado'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    saveProgress,
    getProgress,
    syncProgress,
    getRecentProgress,
    getStreak,
    deleteProgress,
    clearAllProgress
};
