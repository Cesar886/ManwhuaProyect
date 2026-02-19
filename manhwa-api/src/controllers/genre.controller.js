/**
 * Controlador de Géneros
 */

const { query } = require('../config/database');

/**
 * Listar todos los géneros
 * GET /api/genres
 */
const listGenres = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT g.*, 
                    (SELECT COUNT(*) FROM series_genres WHERE genre_id = g.id) as series_count
             FROM genres g
             ORDER BY g.name ASC`
        );
        
        res.json({
            success: true,
            data: {
                genres: result.rows.map(g => ({
                    id: g.id,
                    name: g.name,
                    slug: g.slug,
                    description: g.description,
                    icon: g.icon,
                    color: g.color,
                    seriesCount: parseInt(g.series_count)
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener detalle de género
 * GET /api/genres/:slug
 */
const getGenre = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        const result = await query(
            `SELECT g.*, 
                    (SELECT COUNT(*) FROM series_genres WHERE genre_id = g.id) as series_count
             FROM genres g
             WHERE g.slug = $1`,
            [slug]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Género no encontrado'
            });
        }
        
        const genre = result.rows[0];
        
        res.json({
            success: true,
            data: {
                genre: {
                    id: genre.id,
                    name: genre.name,
                    slug: genre.slug,
                    description: genre.description,
                    icon: genre.icon,
                    color: genre.color,
                    seriesCount: parseInt(genre.series_count)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener series de un género
 * GET /api/genres/:slug/series
 */
const getGenreSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 24, 50);
        const offset = (page - 1) * limit;
        const { sort = 'popular', status } = req.query;
        
        // Verificar género existe
        const genreResult = await query(
            'SELECT id, name FROM genres WHERE slug = $1',
            [slug]
        );
        
        if (genreResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Género no encontrado'
            });
        }
        
        const genre = genreResult.rows[0];
        
        let whereClause = 'WHERE sg.genre_id = $1 AND s.deleted_at IS NULL AND s.is_adult = false';
        const params = [genre.id];
        let paramCount = 1;
        
        if (status) {
            paramCount++;
            whereClause += ` AND s.status = $${paramCount}`;
            params.push(status);
        }
        
        const validSorts = {
            'popular': 's.view_count DESC',
            'rating': 's.rating_average DESC',
            'latest': 's.last_chapter_at DESC NULLS LAST',
            'new': 's.created_at DESC',
            'title': 's.title ASC'
        };
        const sortClause = validSorts[sort] || validSorts['popular'];
        
        const result = await query(
            `SELECT s.id, s.title, s.slug, s.cover_url, s.status, s.content_type,
                    s.view_count, s.rating_average, s.chapter_count, s.bookmark_count,
                    s.is_hot, s.is_new, s.last_chapter_at,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g2.name, 'slug', g2.slug))
                         FROM series_genres sg2 JOIN genres g2 ON sg2.genre_id = g2.id
                         WHERE sg2.series_id = s.id LIMIT 4),
                        '[]'
                    ) as genres
             FROM series s
             JOIN series_genres sg ON s.id = sg.series_id
             ${whereClause}
             ORDER BY ${sortClause}
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM series s JOIN series_genres sg ON s.id = sg.series_id ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                genre: {
                    id: genre.id,
                    name: genre.name,
                    slug: slug
                },
                series: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    status: s.status,
                    contentType: s.content_type,
                    views: s.view_count,
                    rating: parseFloat(s.rating_average),
                    chapterCount: s.chapter_count,
                    bookmarkCount: s.bookmark_count,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    genres: s.genres,
                    lastChapterAt: s.last_chapter_at
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
 * Crear género (Admin)
 * POST /api/genres
 */
const createGenre = async (req, res, next) => {
    try {
        const { name, slug, description, icon, color } = req.body;
        
        // Verificar slug único
        const existingResult = await query(
            'SELECT id FROM genres WHERE slug = $1',
            [slug]
        );
        
        if (existingResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un género con ese slug'
            });
        }
        
        const result = await query(
            `INSERT INTO genres (name, slug, description, icon, color)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, slug, description, icon, color]
        );
        
        res.status(201).json({
            success: true,
            message: 'Género creado',
            data: { genre: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar género (Admin)
 * PUT /api/genres/:id
 */
const updateGenre = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, slug, description, icon, color } = req.body;
        
        await query(
            `UPDATE genres 
             SET name = COALESCE($1, name),
                 slug = COALESCE($2, slug),
                 description = COALESCE($3, description),
                 icon = COALESCE($4, icon),
                 color = COALESCE($5, color)
             WHERE id = $6`,
            [name, slug, description, icon, color, id]
        );
        
        res.json({
            success: true,
            message: 'Género actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar género (Admin)
 * DELETE /api/genres/:id
 */
const deleteGenre = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Verificar que no hay series con este género
        const seriesResult = await query(
            'SELECT COUNT(*) FROM series_genres WHERE genre_id = $1',
            [id]
        );
        
        if (parseInt(seriesResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar un género que tiene series asociadas'
            });
        }
        
        await query('DELETE FROM genres WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Género eliminado'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listGenres,
    getGenre,
    getGenreSeries,
    createGenre,
    updateGenre,
    deleteGenre
};
