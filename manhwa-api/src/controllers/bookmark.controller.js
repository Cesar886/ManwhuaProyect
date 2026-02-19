/**
 * Controlador de Bookmarks
 */

const { query } = require('../config/database');

/**
 * Obtener bookmarks del usuario
 * GET /api/bookmarks
 */
const getBookmarks = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const { status, sort = 'updated_at', order = 'desc' } = req.query;
        
        let whereClause = 'WHERE b.user_id = $1 AND s.deleted_at IS NULL';
        const params = [req.user.id];
        let paramCount = 1;
        
        if (status) {
            paramCount++;
            whereClause += ` AND s.status = $${paramCount}`;
            params.push(status);
        }
        
        const validSorts = {
            'updated_at': 'b.updated_at',
            'added_at': 'b.created_at',
            'title': 's.title',
            'last_read': 'b.last_read_at'
        };
        const sortField = validSorts[sort] || 'b.updated_at';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
        
        const result = await query(
            `SELECT b.*, 
                    s.id as series_id, s.title, s.slug, s.cover_url, s.status,
                    s.chapter_count, s.rating_average, s.content_type, s.last_chapter_at,
                    c.number as last_read_number, c.title as last_read_title, c.slug as last_read_slug,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id LIMIT 3),
                        '[]'
                    ) as genres
             FROM bookmarks b
             JOIN series s ON b.series_id = s.id
             LEFT JOIN chapters c ON b.last_read_chapter_id = c.id
             ${whereClause}
             ORDER BY ${sortField} ${sortOrder} NULLS LAST
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM bookmarks b JOIN series s ON b.series_id = s.id ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                bookmarks: result.rows.map(b => ({
                    series: {
                        id: b.series_id,
                        title: b.title,
                        slug: b.slug,
                        coverUrl: b.cover_url,
                        status: b.status,
                        chapterCount: b.chapter_count,
                        rating: parseFloat(b.rating_average),
                        contentType: b.content_type,
                        lastChapterAt: b.last_chapter_at,
                        genres: b.genres
                    },
                    lastRead: b.last_read_chapter_id ? {
                        chapterId: b.last_read_chapter_id,
                        number: parseFloat(b.last_read_number),
                        title: b.last_read_title,
                        slug: b.last_read_slug,
                        page: b.last_read_page,
                        at: b.last_read_at
                    } : null,
                    isCompleted: b.is_completed,
                    notifyNewChapter: b.notify_new_chapter,
                    addedAt: b.created_at,
                    updatedAt: b.updated_at
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Agregar bookmark
 * POST /api/bookmarks/:seriesId
 */
const addBookmark = async (req, res, next) => {
    try {
        const { seriesId } = req.params;
        
        // Verificar serie existe
        const seriesResult = await query(
            'SELECT id, title FROM series WHERE id = $1 AND deleted_at IS NULL',
            [seriesId]
        );
        
        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }
        
        await query(
            `INSERT INTO bookmarks (user_id, series_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, series_id) DO NOTHING`,
            [req.user.id, seriesId]
        );
        
        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, target_type, target_id, metadata)
             VALUES ($1, 'bookmark', 'series', $2, $3)`,
            [req.user.id, seriesId, JSON.stringify({ title: seriesResult.rows[0].title })]
        );
        
        res.json({
            success: true,
            message: 'Serie agregada a favoritos'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar bookmark
 * DELETE /api/bookmarks/:seriesId
 */
const removeBookmark = async (req, res, next) => {
    try {
        const { seriesId } = req.params;
        
        const result = await query(
            'DELETE FROM bookmarks WHERE user_id = $1 AND series_id = $2 RETURNING series_id',
            [req.user.id, seriesId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bookmark no encontrado'
            });
        }
        
        res.json({
            success: true,
            message: 'Serie eliminada de favoritos'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar bookmark
 * PUT /api/bookmarks/:seriesId
 */
const updateBookmark = async (req, res, next) => {
    try {
        const { seriesId } = req.params;
        const { isCompleted, notifyNewChapter } = req.body;
        
        await query(
            `UPDATE bookmarks 
             SET is_completed = COALESCE($1, is_completed),
                 notify_new_chapter = COALESCE($2, notify_new_chapter),
                 updated_at = NOW()
             WHERE user_id = $3 AND series_id = $4`,
            [isCompleted, notifyNewChapter, req.user.id, seriesId]
        );
        
        res.json({
            success: true,
            message: 'Bookmark actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar si una serie está en bookmarks
 * GET /api/bookmarks/check/:seriesId
 */
const checkBookmark = async (req, res, next) => {
    try {
        const { seriesId } = req.params;
        
        const result = await query(
            `SELECT b.*, c.number as last_read_number
             FROM bookmarks b
             LEFT JOIN chapters c ON b.last_read_chapter_id = c.id
             WHERE b.user_id = $1 AND b.series_id = $2`,
            [req.user.id, seriesId]
        );
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: { isBookmarked: false }
            });
        }
        
        const bookmark = result.rows[0];
        
        res.json({
            success: true,
            data: {
                isBookmarked: true,
                lastReadChapter: bookmark.last_read_chapter_id ? {
                    id: bookmark.last_read_chapter_id,
                    number: parseFloat(bookmark.last_read_number),
                    page: bookmark.last_read_page
                } : null,
                isCompleted: bookmark.is_completed,
                notifyNewChapter: bookmark.notify_new_chapter
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar progreso de lectura
 * PUT /api/bookmarks/:seriesId/progress
 */
const updateProgress = async (req, res, next) => {
    try {
        const { seriesId } = req.params;
        const { chapterId, page } = req.body;
        
        await query(
            `UPDATE bookmarks 
             SET last_read_chapter_id = $1,
                 last_read_page = $2,
                 last_read_at = NOW(),
                 updated_at = NOW()
             WHERE user_id = $3 AND series_id = $4`,
            [chapterId, page || 1, req.user.id, seriesId]
        );
        
        res.json({
            success: true,
            message: 'Progreso actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Activar/desactivar notificaciones
 * PUT /api/bookmarks/:seriesId/notifications
 */
const toggleNotifications = async (req, res, next) => {
    try {
        const { seriesId } = req.params;
        const { enabled } = req.body;
        
        await query(
            `UPDATE bookmarks 
             SET notify_new_chapter = $1, updated_at = NOW()
             WHERE user_id = $2 AND series_id = $3`,
            [enabled !== false, req.user.id, seriesId]
        );
        
        res.json({
            success: true,
            message: enabled !== false ? 'Notificaciones activadas' : 'Notificaciones desactivadas'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    checkBookmark,
    updateProgress,
    toggleNotifications
};
