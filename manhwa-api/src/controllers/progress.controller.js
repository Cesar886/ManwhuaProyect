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

        // Buscar series_id y chapter_id
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

        // Buscar capítulo
        const chapterResult = await query(
            'SELECT id FROM chapters WHERE series_id = $1 AND number = $2 AND deleted_at IS NULL',
            [seriesId, chapterNum]
        );

        if (chapterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Capítulo no encontrado'
            });
        }

        const chapterId = chapterResult.rows[0].id;

        // Verificar si ya existe un registro de progreso
        const existingResult = await query(
            'SELECT id, synced_at FROM reading_history WHERE user_id = $1 AND series_id = $2 AND chapter_id = $3',
            [userId, seriesId, chapterId]
        );

        let result;
        if (existingResult.rows.length > 0) {
            // Actualizar progreso existente
            result = await query(
                `UPDATE reading_history
                 SET scroll_position = $1,
                     progress_percentage = $2,
                     total_pages = $3,
                     is_completed = $4,
                     device_id = $5,
                     synced_at = NOW(),
                     read_at = NOW()
                 WHERE user_id = $6 AND series_id = $7 AND chapter_id = $8
                 RETURNING *`,
                [scrollPosition, progress, totalPages, isCompleted, deviceId, userId, seriesId, chapterId]
            );
        } else {
            // Crear nuevo registro de progreso
            result = await query(
                `INSERT INTO reading_history
                 (user_id, series_id, chapter_id, scroll_position, progress_percentage,
                  total_pages, is_completed, device_id, synced_at, read_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                 RETURNING *`,
                [userId, seriesId, chapterId, scrollPosition, progress, totalPages, isCompleted, deviceId]
            );
        }

        // Actualizar bookmark si existe
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
                    isCompleted,
                    syncedAt: result.rows[0].synced_at
                }
            },
            message: 'Progreso guardado correctamente'
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
               AND s.deleted_at IS NULL AND c.deleted_at IS NULL`,
            [userId, slug, parseInt(chapterNum)]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    progress: null
                },
                message: 'No hay progreso guardado para este capítulo'
            });
        }

        const progress = result.rows[0];

        res.json({
            success: true,
            data: {
                progress: {
                    scrollPosition: progress.scroll_position,
                    progress: parseFloat(progress.progress_percentage),
                    totalPages: progress.total_pages,
                    isCompleted: progress.is_completed,
                    syncedAt: progress.synced_at,
                    readAt: progress.read_at,
                    deviceId: progress.device_id
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
               AND s.deleted_at IS NULL AND c.deleted_at IS NULL
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

        const result = await query(
            `SELECT DISTINCT ON (rh.series_id)
                    s.id as series_id, s.slug, s.title, s.cover_url,
                    c.id as chapter_id, c.number as chapter_num, c.title as chapter_title,
                    rh.scroll_position, rh.progress_percentage, rh.is_completed, rh.read_at
             FROM reading_history rh
             JOIN series s ON rh.series_id = s.id
             JOIN chapters c ON rh.chapter_id = c.id
             WHERE rh.user_id = $1
               AND s.deleted_at IS NULL AND c.deleted_at IS NULL
             ORDER BY rh.series_id, rh.read_at DESC
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
            [userId, slug, parseInt(chapterNum)]
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
    deleteProgress,
    clearAllProgress
};
