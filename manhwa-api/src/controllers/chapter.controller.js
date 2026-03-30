/**
 * Controlador de Capítulos
 */

const { query, transaction } = require('../config/database');
const slugify = require('slugify');
const { hasRole } = require('../config/roles');
const { notifyChapterPublished } = require('../services/googleIndexing');
const logger = require('../utils/logger');

/**
 * Obtener capítulo
 * GET /api/chapters/:seriesSlug/:chapterSlug
 */
const getChapter = async (req, res, next) => {
    try {
        const { seriesSlug, chapterSlug } = req.params;

        // Obtener capítulo con info de serie
        const result = await query(
            `SELECT c.*, s.id as series_id, s.title as series_title, s.slug as series_slug,
                    s.cover_url as series_cover
             FROM chapters c
             JOIN series s ON c.series_id = s.id
             WHERE s.slug = $1 AND c.slug = $2 AND c.is_published = true AND s.deleted_at IS NULL`,
            [seriesSlug, chapterSlug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Capítulo no encontrado'
            });
        }

        const chapter = result.rows[0];

        // Verificar acceso premium
        if (chapter.is_premium) {
            const canAccess = req.user && (req.user.isPremium || hasRole(req.user.role, 'translator'));

            if (!canAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Este capítulo requiere una cuenta premium',
                    code: 'PREMIUM_REQUIRED',
                    data: {
                        chapter: {
                            id: chapter.id,
                            number: parseFloat(chapter.number),
                            title: chapter.title,
                            isPremium: true,
                            coinCost: chapter.coin_cost,
                            freeAt: chapter.free_at
                        }
                    }
                });
            }
        }

        // Obtener capítulos anterior y siguiente
        const navigationResult = await query(
            `SELECT 
                (SELECT json_build_object('number', number, 'slug', slug, 'title', title)
                 FROM chapters WHERE series_id = $1 AND number < $2 AND is_published = true
                 ORDER BY number DESC LIMIT 1) as prev_chapter,
                (SELECT json_build_object('number', number, 'slug', slug, 'title', title)
                 FROM chapters WHERE series_id = $1 AND number > $2 AND is_published = true
                 ORDER BY number ASC LIMIT 1) as next_chapter`,
            [chapter.series_id, chapter.number]
        );

        const navigation = navigationResult.rows[0];

        // Incrementar vistas del capítulo
        await query(
            'UPDATE chapters SET view_count = view_count + 1 WHERE id = $1',
            [chapter.id]
        );

        // Incrementar vistas de la serie (total, diarias, semanales, mensuales)
        await query(
            `UPDATE series SET
                view_count   = view_count   + 1,
                daily_views  = daily_views  + 1,
                weekly_views = weekly_views + 1,
                monthly_views= monthly_views+ 1
             WHERE id = $1`,
            [chapter.series_id]
        );

        // Registrar vista
        if (req.user) {
            await query(
                `INSERT INTO chapter_views (chapter_id, series_id, user_id, ip_address)
                 VALUES ($1, $2, $3, $4)`,
                [chapter.id, chapter.series_id, req.user.id, req.ip]
            );
        }

        res.json({
            success: true,
            data: {
                chapter: {
                    id: chapter.id,
                    number: parseFloat(chapter.number),
                    title: chapter.title,
                    slug: chapter.slug,
                    pageCount: chapter.page_count,
                    views: chapter.view_count,
                    isPremium: chapter.is_premium,
                    publishedAt: chapter.published_at
                },
                series: {
                    id: chapter.series_id,
                    title: chapter.series_title,
                    slug: chapter.series_slug,
                    coverUrl: chapter.series_cover
                },
                navigation: {
                    prev: navigation.prev_chapter,
                    next: navigation.next_chapter
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener páginas del capítulo
 * GET /api/chapters/:seriesSlug/:chapterSlug/pages
 */
const getChapterPages = async (req, res, next) => {
    try {
        const { seriesSlug, chapterSlug } = req.params;

        // Verificar acceso
        const chapterResult = await query(
            `SELECT c.id, c.is_premium, c.page_count
             FROM chapters c
             JOIN series s ON c.series_id = s.id
             WHERE s.slug = $1 AND c.slug = $2 AND c.is_published = true`,
            [seriesSlug, chapterSlug]
        );

        if (chapterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Capítulo no encontrado'
            });
        }

        const chapter = chapterResult.rows[0];

        // Verificar premium
        if (chapter.is_premium && (!req.user || (!req.user.isPremium && !hasRole(req.user.role, 'translator')))) {
            return res.status(403).json({
                success: false,
                message: 'Capítulo premium',
                code: 'PREMIUM_REQUIRED'
            });
        }

        // Obtener páginas
        const pagesResult = await query(
            `SELECT id, page_number, image_url, width, height
             FROM chapter_pages
             WHERE chapter_id = $1
             ORDER BY page_number ASC`,
            [chapter.id]
        );

        res.json({
            success: true,
            data: {
                pages: pagesResult.rows.map(p => ({
                    id: p.id,
                    number: p.page_number,
                    url: p.image_url,
                    width: p.width,
                    height: p.height
                })),
                totalPages: chapter.page_count
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener comentarios del capítulo
 * GET /api/chapters/:seriesSlug/:chapterSlug/comments
 */
const getChapterComments = async (req, res, next) => {
    try {
        const { seriesSlug, chapterSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        // Obtener capítulo
        const chapterResult = await query(
            `SELECT c.id, c.comment_count
             FROM chapters c
             JOIN series s ON c.series_id = s.id
             WHERE s.slug = $1 AND c.slug = $2`,
            [seriesSlug, chapterSlug]
        );

        if (chapterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Capítulo no encontrado'
            });
        }

        const chapter = chapterResult.rows[0];

        const result = await query(
            `SELECT c.*, u.username, u.display_name, u.avatar_url, u.role as user_role
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.target_type = 'chapter' AND c.target_id = $1 
                   AND c.parent_id IS NULL AND c.status = 'visible'
             ORDER BY c.created_at DESC
             LIMIT $2 OFFSET $3`,
            [chapter.id, limit, offset]
        );

        // Importar función de estadísticas
        const { getUserBadgeStats } = require('./progress.controller');
        
        // Enriquecer comentarios con estadísticas de badges
        const enrichedComments = await Promise.all(
            result.rows.map(async (c) => {
                const badgeStats = await getUserBadgeStats(c.user_id);
                
                return {
                    id: c.id,
                    content: c.content,
                    author: {
                        id: c.user_id,
                        username: c.username,
                        displayName: c.display_name,
                        avatarUrl: c.avatar_url,
                        role: c.user_role,
                        // Estadísticas para badges
                        streak: badgeStats.streak,
                        totalChapters: badgeStats.totalChapters,
                        comments: badgeStats.comments,
                        nightReads: badgeStats.nightReads,
                        maxChaptersPerHour: badgeStats.maxChaptersPerHour
                    },
                    likes: c.likes_count,
                    repliesCount: c.replies_count,
                    isSpoiler: c.is_spoiler,
                    createdAt: c.created_at
                };
            })
        );

        res.json({
            success: true,
            data: {
                comments: enrichedComments,
                pagination: {
                    page,
                    limit,
                    total: chapter.comment_count,
                    pages: Math.ceil(chapter.comment_count / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

const getAllChapters = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const offset = (page - 1) * limit;

        const result = await query(
            `SELECT c.slug, c.number as chapter_number, c.updated_at, s.slug as series_slug
             FROM chapters c
             JOIN series s ON c.series_id = s.id
             WHERE c.is_published = true AND s.deleted_at IS NULL
             ORDER BY c.updated_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const totalResult = await query('SELECT COUNT(*) FROM chapters c JOIN series s ON c.series_id = s.id WHERE c.is_published = true AND s.deleted_at IS NULL');
        const total = parseInt(totalResult.rows[0].count);

        res.json({
            success: true,
            chapters: result.rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar progreso de lectura
 * POST /api/chapters/:seriesSlug/:chapterSlug/progress
 */
const updateReadingProgress = async (req, res, next) => {
    try {
        const { seriesSlug, chapterSlug } = req.params;
        const { page, completed } = req.body;

        // Obtener capítulo
        const chapterResult = await query(
            `SELECT c.id, c.series_id
             FROM chapters c
             JOIN series s ON c.series_id = s.id
             WHERE s.slug = $1 AND c.slug = $2`,
            [seriesSlug, chapterSlug]
        );

        if (chapterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Capítulo no encontrado'
            });
        }

        const chapter = chapterResult.rows[0];

        // Actualizar historial
        await query(
            `INSERT INTO reading_history (user_id, chapter_id, series_id, last_page, is_completed)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, chapter_id) 
             DO UPDATE SET last_page = $4, is_completed = $5, read_at = NOW()`,
            [req.user.id, chapter.id, chapter.series_id, page || 1, completed || false]
        );

        // Actualizar bookmark si existe
        await query(
            `UPDATE bookmarks 
             SET last_read_chapter_id = $1, last_read_page = $2, last_read_at = NOW()
             WHERE user_id = $3 AND series_id = $4`,
            [chapter.id, page || 1, req.user.id, chapter.series_id]
        );

        res.json({
            success: true,
            message: 'Progreso guardado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Crear capítulo
 * POST /api/chapters
 */
const createChapter = async (req, res, next) => {
    try {
        const { seriesId, number, title, pages, isPremium, coinCost } = req.body;

        // Verificar serie existe
        const seriesResult = await query(
            'SELECT id, slug FROM series WHERE id = $1 AND deleted_at IS NULL',
            [seriesId]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        const series = seriesResult.rows[0];

        // Generar slug
        const slug = title
            ? slugify(`${number}-${title}`, { lower: true, strict: true })
            : `capitulo-${number}`;

        const result = await transaction(async (client) => {
            // Crear capítulo
            const chapterResult = await client.query(
                `INSERT INTO chapters (series_id, number, title, slug, page_count, is_premium, coin_cost, is_published, published_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
                 RETURNING *`,
                [seriesId, number, title, slug, pages.length, isPremium || false, coinCost || 0]
            );

            const chapter = chapterResult.rows[0];

            // Insertar páginas
            for (let i = 0; i < pages.length; i++) {
                await client.query(
                    `INSERT INTO chapter_pages (chapter_id, page_number, image_url, width, height)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [chapter.id, i + 1, pages[i].url, pages[i].width || null, pages[i].height || null]
                );
            }

            return chapter;
        });

        // Fire-and-forget: notificar a Google para indexacion rapida
        // Indexa el capitulo nuevo + serie + capitulos vecinos no indexados
        notifyChapterPublished(series.slug, number).catch(err => {
            logger.error(`[GoogleIndexing] Error notificando nuevo capitulo: ${err.message}`);
        });

        res.status(201).json({
            success: true,
            message: 'Capítulo creado',
            data: {
                chapter: {
                    id: result.id,
                    number: parseFloat(result.number),
                    slug: result.slug,
                    seriesSlug: series.slug
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar capítulo
 * PUT /api/chapters/:id
 */
const updateChapter = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, isPremium, coinCost, isPublished } = req.body;

        // Si se va a publicar, obtener datos del capitulo para indexacion
        let chapterData = null;
        if (isPublished === true) {
            const chapterResult = await query(
                `SELECT c.number, c.is_published, s.slug as series_slug
                 FROM chapters c
                 JOIN series s ON c.series_id = s.id
                 WHERE c.id = $1`,
                [id]
            );
            if (chapterResult.rows.length > 0 && !chapterResult.rows[0].is_published) {
                chapterData = chapterResult.rows[0];
            }
        }

        await query(
            `UPDATE chapters
             SET title = COALESCE($1, title),
                 is_premium = COALESCE($2, is_premium),
                 coin_cost = COALESCE($3, coin_cost),
                 is_published = COALESCE($4, is_published),
                 updated_at = NOW()
             WHERE id = $5`,
            [title, isPremium, coinCost, isPublished, id]
        );

        // Si el capitulo paso de no publicado a publicado, indexar
        if (chapterData) {
            notifyChapterPublished(chapterData.series_slug, parseFloat(chapterData.number)).catch(err => {
                logger.error(`[GoogleIndexing] Error notificando capitulo publicado: ${err.message}`);
            });
        }

        res.json({
            success: true,
            message: 'Capítulo actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar capítulo
 * DELETE /api/chapters/:id
 */
const deleteChapter = async (req, res, next) => {
    try {
        const { id } = req.params;

        await query('DELETE FROM chapters WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Capítulo eliminado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Subir páginas a un capítulo
 * POST /api/chapters/:id/pages
 */
const uploadPages = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { pages } = req.body;

        // Verificar capítulo existe
        const chapterResult = await query(
            'SELECT id FROM chapters WHERE id = $1',
            [id]
        );

        if (chapterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Capítulo no encontrado'
            });
        }

        await transaction(async (client) => {
            // Eliminar páginas existentes
            await client.query('DELETE FROM chapter_pages WHERE chapter_id = $1', [id]);

            // Insertar nuevas páginas
            for (let i = 0; i < pages.length; i++) {
                await client.query(
                    `INSERT INTO chapter_pages (chapter_id, page_number, image_url, width, height)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [id, i + 1, pages[i].url, pages[i].width || null, pages[i].height || null]
                );
            }

            // Actualizar contador
            await client.query(
                'UPDATE chapters SET page_count = $1, updated_at = NOW() WHERE id = $2',
                [pages.length, id]
            );
        });

        res.json({
            success: true,
            message: 'Páginas actualizadas',
            data: { pageCount: pages.length }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Calificar capítulo (1-5 estrellas)
 * POST /api/chapters/:chapterId/rate
 * Body: { rating: 1-5, visitorId: string }
 */


const rateChapter = async (req, res, next) => {
    try {
        const { seriesSlug, chapterNum } = req.params;
        const { rating, visitorId, timestamp } = req.body;

        // Anti-bot: mínimo 1 segundo desde que el componente se volvió interactivo
        if (timestamp) {
            const clientTime = new Date(timestamp).getTime();
            if (!isNaN(clientTime)) {
                const timeDiff = Date.now() - clientTime;
                if (timeDiff < 1000 && timeDiff > -60000) {
                    return res.status(429).json({
                        success: false,
                        message: 'Voto demasiado rápido. Tómate un momento para leer.'
                    });
                }
            }
        }

        if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 5) {
            return res.status(400).json({ success: false, message: 'visitorId requerido' });
        }

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating debe ser un entero entre 1 y 5' });
        }

        const chapterNumParsed = parseFloat(chapterNum);

        // Upsert: insertar o actualizar voto
        await query(
            `INSERT INTO chapter_votes (series_slug, chapter_number, visitor_id, rating)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (series_slug, chapter_number, visitor_id)
             DO UPDATE SET rating = $4, updated_at = NOW()`,
            [seriesSlug, chapterNumParsed, visitorId, rating]
        );

        // Sistema de cuarentena: detectar picos de votos
        const spikeCheck = await query(
            `SELECT COUNT(*) as recent_votes FROM chapter_votes
             WHERE series_slug = $1 AND chapter_number = $2
               AND updated_at > NOW() - INTERVAL '1 hour'`,
            [seriesSlug, chapterNumParsed]
        );

        if (parseInt(spikeCheck.rows[0].recent_votes, 10) > 50) {
            return res.json({
                success: true,
                message: 'Calificación recibida (en revisión por alto tráfico)',
                data: { rating: null, ratingCount: null }
            });
        }

        // Recalcular promedio
        const statsResult = await query(
            `SELECT AVG(rating)::DECIMAL(3,2) as avg_rating, COUNT(*) as total
             FROM chapter_votes
             WHERE series_slug = $1 AND chapter_number = $2`,
            [seriesSlug, chapterNumParsed]
        );

        const avgRating = parseFloat(statsResult.rows[0].avg_rating) || 0;
        const totalCount = parseInt(statsResult.rows[0].total, 10) || 0;

        res.json({
            success: true,
            message: 'Calificación guardada',
            data: { rating: avgRating, ratingCount: totalCount }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener voto previo del usuario para un capítulo
 * GET /api/chapters/:seriesSlug/:chapterNum/user-rating?visitorId=xxx
 */
const getChapterUserRating = async (req, res, next) => {
    try {
        const { seriesSlug, chapterNum } = req.params;
        const { visitorId } = req.query;

        if (!visitorId) {
            return res.json({ success: true, data: { userRating: null } });
        }

        const result = await query(
            'SELECT rating FROM chapter_votes WHERE series_slug = $1 AND chapter_number = $2 AND visitor_id = $3',
            [seriesSlug, parseFloat(chapterNum), visitorId]
        );

        res.json({
            success: true,
            data: { userRating: result.rows.length > 0 ? result.rows[0].rating : null }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener rating promedio de un capítulo
 * GET /api/chapters/:seriesSlug/:chapterNum/rating
 */
const getChapterRating = async (req, res, next) => {
    try {
        const { seriesSlug, chapterNum } = req.params;

        const result = await query(
            `SELECT AVG(rating)::DECIMAL(3,2) as avg_rating, COUNT(*) as total
             FROM chapter_votes
             WHERE series_slug = $1 AND chapter_number = $2`,
            [seriesSlug, parseFloat(chapterNum)]
        );

        res.json({
            success: true,
            data: {
                rating: result.rows[0].avg_rating ? parseFloat(result.rows[0].avg_rating) : null,
                ratingCount: parseInt(result.rows[0].total, 10) || 0
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getChapter,
    getAllChapters,
    getChapterPages,
    getChapterComments,
    updateReadingProgress,
    createChapter,
    updateChapter,
    deleteChapter,
    uploadPages,
    rateChapter,
    getChapterUserRating,
    getChapterRating
};
