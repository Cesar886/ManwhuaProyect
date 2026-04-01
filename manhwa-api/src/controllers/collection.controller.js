/**
 * Controlador de Colecciones
 */

const { query, transaction } = require('../config/database');
const slugify = require('slugify');
const { hasPermission } = require('../config/roles');

/**
 * Listar colecciones
 * GET /api/collections
 */
const listCollections = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);
        const offset = (page - 1) * limit;
        const { category, sort = 'created_at', order = 'desc' } = req.query;
        
        let whereClause = 'WHERE c.deleted_at IS NULL AND c.is_public = true';
        const params = [];
        let paramCount = 0;
        
        if (category) {
            paramCount++;
            whereClause += ` AND c.category = $${paramCount}`;
            params.push(category);
        }
        
        const validSorts = {
            'created_at': 'c.created_at',
            'followers': 'c.followers_count',
            'likes': 'c.likes_count',
            'manhwas': 'c.manhwas_count'
        };
        const sortField = validSorts[sort] || 'c.created_at';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
        
        const result = await query(
            `SELECT c.*, u.username, u.display_name, u.avatar_url,
                    (SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'cover', s.cover_url))
                     FROM (SELECT s.* FROM collection_items ci 
                           JOIN series s ON ci.series_id = s.id 
                           WHERE ci.collection_id = c.id 
                           ORDER BY ci.order_index LIMIT 4) s
                    ) as preview_series
             FROM collections c
             JOIN users u ON c.creator_id = u.id
             ${whereClause}
             ORDER BY ${sortField} ${sortOrder}
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM collections c ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                collections: result.rows.map(c => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description,
                    coverUrl: c.cover_url,
                    category: c.category,
                    tags: c.tags,
                    creator: {
                        username: c.username,
                        displayName: c.display_name,
                        avatarUrl: c.avatar_url
                    },
                    stats: {
                        manhwas: c.manhwas_count,
                        followers: c.followers_count,
                        likes: c.likes_count
                    },
                    isVerified: c.is_verified,
                    previewSeries: c.preview_series || [],
                    createdAt: c.created_at
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
 * Obtener colecciones populares
 * GET /api/collections/popular
 */
const getPopularCollections = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 20);
        
        const result = await query(
            `SELECT c.*, u.username, u.display_name, u.avatar_url
             FROM collections c
             JOIN users u ON c.creator_id = u.id
             WHERE c.deleted_at IS NULL AND c.is_public = true
             ORDER BY (c.followers_count * 2 + c.likes_count) DESC
             LIMIT $1`,
            [limit]
        );
        
        res.json({
            success: true,
            data: {
                collections: result.rows.map(c => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description,
                    coverUrl: c.cover_url,
                    creator: {
                        username: c.username,
                        displayName: c.display_name,
                        avatarUrl: c.avatar_url
                    },
                    stats: {
                        manhwas: c.manhwas_count,
                        followers: c.followers_count,
                        likes: c.likes_count
                    },
                    isVerified: c.is_verified
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener detalle de colección
 * GET /api/collections/:slug
 */
const getCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        const result = await query(
            `SELECT c.*, u.id as creator_id, u.username, u.display_name, u.avatar_url, u.bio as creator_bio,
                    u.is_premium as creator_premium, u.role as creator_role,
                    EXISTS(SELECT 1 FROM collection_follows WHERE user_id = $2 AND collection_id = c.id) as user_following,
                    EXISTS(SELECT 1 FROM collection_likes WHERE user_id = $2 AND collection_id = c.id) as user_liked
             FROM collections c
             JOIN users u ON c.creator_id = u.id
             WHERE c.slug = $1 AND c.deleted_at IS NULL`,
            [slug, req.user?.id || null]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collection = result.rows[0];
        
        // Verificar acceso si es privada
        if (!collection.is_public && (!req.user || req.user.id !== collection.creator_id)) {
            return res.status(403).json({
                success: false,
                message: 'Esta colección es privada'
            });
        }
        
        // Incrementar vistas
        await query(
            'UPDATE collections SET views_count = views_count + 1 WHERE id = $1',
            [collection.id]
        );
        
        res.json({
            success: true,
            data: {
                collection: {
                    id: collection.id,
                    name: collection.name,
                    slug: collection.slug,
                    description: collection.description,
                    coverUrl: collection.cover_url,
                    category: collection.category,
                    tags: collection.tags,
                    isPublic: collection.is_public,
                    isVerified: collection.is_verified,
                    creator: {
                        id: collection.creator_id,
                        username: collection.username,
                        displayName: collection.display_name,
                        avatarUrl: collection.avatar_url,
                        bio: collection.creator_bio,
                        isPremium: collection.creator_premium,
                        role: collection.creator_role
                    },
                    stats: {
                        manhwas: collection.manhwas_count,
                        followers: collection.followers_count,
                        likes: collection.likes_count,
                        views: collection.views_count
                    },
                    userInteraction: {
                        isFollowing: collection.user_following,
                        isLiked: collection.user_liked,
                        isOwner: req.user?.id === collection.creator_id
                    },
                    createdAt: collection.created_at,
                    updatedAt: collection.updated_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener manhwas de una colección
 * GET /api/collections/:slug/manhwas
 */
const getCollectionManhwas = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        
        const collectionResult = await query(
            'SELECT id, manhwas_count, is_public, creator_id FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collection = collectionResult.rows[0];
        
        const result = await query(
            `SELECT s.id, s.title, s.slug, s.cover_url, s.status, s.rating_average,
                    s.chapter_count, s.content_type, ci.order_index, ci.note, ci.added_at,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id LIMIT 3),
                        '[]'
                    ) as genres
             FROM collection_items ci
             JOIN series s ON ci.series_id = s.id
             WHERE ci.collection_id = $1 AND s.deleted_at IS NULL
             ORDER BY ci.order_index ASC
             LIMIT $2 OFFSET $3`,
            [collection.id, limit, offset]
        );
        
        res.json({
            success: true,
            data: {
                manhwas: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    status: s.status,
                    rating: parseFloat(s.rating_average),
                    chapterCount: s.chapter_count,
                    contentType: s.content_type,
                    genres: s.genres,
                    orderIndex: s.order_index,
                    note: s.note,
                    addedAt: s.added_at
                })),
                pagination: {
                    page,
                    limit,
                    total: collection.manhwas_count,
                    pages: Math.ceil(collection.manhwas_count / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener comentarios de una colección
 * GET /api/collections/:slug/comments
 */
const getCollectionComments = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        
        const collectionResult = await query(
            'SELECT id FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collectionId = collectionResult.rows[0].id;
        
        const result = await query(
            `SELECT c.*, u.username, u.display_name, u.avatar_url, u.role as user_role, u.experience
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.target_type = 'collection' AND c.target_id = $1 
                   AND c.parent_id IS NULL AND c.status = 'visible'
             ORDER BY c.created_at DESC
             LIMIT $2 OFFSET $3`,
            [collectionId, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM comments 
             WHERE target_type = 'collection' AND target_id = $1 AND parent_id IS NULL AND status = 'visible'`,
            [collectionId]
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                comments: result.rows.map(c => ({
                    id: c.id,
                    content: c.content,
                    author: {
                        username: c.username,
                        displayName: c.display_name,
                        avatarUrl: c.avatar_url,
                        role: c.user_role,
                        experience: parseInt(c.experience) || 0
                    },
                    likes: c.likes_count,
                    repliesCount: c.replies_count,
                    createdAt: c.created_at
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
 * Crear colección
 * POST /api/collections
 */
const createCollection = async (req, res, next) => {
    try {
        const { name, description, isPublic, category, tags, coverUrl } = req.body;
        
        // Generar slug único
        let slug = slugify(name, { lower: true, strict: true });
        const existingSlug = await query(
            'SELECT id FROM collections WHERE slug = $1 AND creator_id = $2',
            [slug, req.user.id]
        );
        
        if (existingSlug.rows.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }
        
        const result = await query(
            `INSERT INTO collections (name, slug, description, creator_id, is_public, category, tags, cover_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [name, slug, description, req.user.id, isPublic !== false, category, JSON.stringify(tags || []), coverUrl]
        );
        
        const collection = result.rows[0];
        
        // Actualizar contador del usuario
        await query(
            'UPDATE users SET collections_count = collections_count + 1 WHERE id = $1',
            [req.user.id]
        );
        
        res.status(201).json({
            success: true,
            message: 'Colección creada',
            data: {
                collection: {
                    id: collection.id,
                    name: collection.name,
                    slug: collection.slug
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar colección
 * PUT /api/collections/:slug
 */
const updateCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { name, description, isPublic, category, tags, coverUrl } = req.body;
        
        const collectionResult = await query(
            'SELECT id, creator_id FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collection = collectionResult.rows[0];
        
        // Verificar propiedad
        if (collection.creator_id !== req.user.id && !hasPermission(req.user.role, 'collections:delete_any')) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para editar esta colección'
            });
        }
        
        await query(
            `UPDATE collections 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 is_public = COALESCE($3, is_public),
                 category = COALESCE($4, category),
                 tags = COALESCE($5, tags),
                 cover_url = COALESCE($6, cover_url),
                 updated_at = NOW()
             WHERE id = $7`,
            [name, description, isPublic, category, tags ? JSON.stringify(tags) : null, coverUrl, collection.id]
        );
        
        res.json({
            success: true,
            message: 'Colección actualizada'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar colección
 * DELETE /api/collections/:slug
 */
const deleteCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        const collectionResult = await query(
            'SELECT id, creator_id FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collection = collectionResult.rows[0];
        
        if (collection.creator_id !== req.user.id && !hasPermission(req.user.role, 'collections:delete_any')) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar esta colección'
            });
        }
        
        await query(
            'UPDATE collections SET deleted_at = NOW() WHERE id = $1',
            [collection.id]
        );
        
        await query(
            'UPDATE users SET collections_count = collections_count - 1 WHERE id = $1',
            [collection.creator_id]
        );
        
        res.json({
            success: true,
            message: 'Colección eliminada'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Agregar manhwa a colección
 * POST /api/collections/:slug/manhwas
 */
const addManhwaToCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { seriesId, note } = req.body;
        
        const collectionResult = await query(
            'SELECT id, creator_id, manhwas_count FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collection = collectionResult.rows[0];
        
        if (collection.creator_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar esta colección'
            });
        }
        
        // Verificar que la serie existe
        const seriesResult = await query(
            'SELECT id FROM series WHERE id = $1 AND deleted_at IS NULL',
            [seriesId]
        );
        
        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }
        
        // Agregar a la colección
        await query(
            `INSERT INTO collection_items (collection_id, series_id, order_index, added_by, note)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (collection_id, series_id) DO NOTHING`,
            [collection.id, seriesId, collection.manhwas_count, req.user.id, note]
        );
        
        res.json({
            success: true,
            message: 'Manhwa agregado a la colección'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Quitar manhwa de colección
 * DELETE /api/collections/:slug/manhwas/:seriesId
 */
const removeManhwaFromCollection = async (req, res, next) => {
    try {
        const { slug, seriesId } = req.params;
        
        const collectionResult = await query(
            'SELECT id, creator_id FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collection = collectionResult.rows[0];
        
        if (collection.creator_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar esta colección'
            });
        }
        
        await query(
            'DELETE FROM collection_items WHERE collection_id = $1 AND series_id = $2',
            [collection.id, seriesId]
        );
        
        res.json({
            success: true,
            message: 'Manhwa eliminado de la colección'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reordenar manhwas en colección
 * PUT /api/collections/:slug/manhwas/reorder
 */
const reorderManhwas = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { items } = req.body; // Array de { seriesId, orderIndex }
        
        const collectionResult = await query(
            'SELECT id, creator_id FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        const collection = collectionResult.rows[0];
        
        if (collection.creator_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar esta colección'
            });
        }
        
        await transaction(async (client) => {
            for (const item of items) {
                await client.query(
                    'UPDATE collection_items SET order_index = $1 WHERE collection_id = $2 AND series_id = $3',
                    [item.orderIndex, collection.id, item.seriesId]
                );
            }
        });
        
        res.json({
            success: true,
            message: 'Orden actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Seguir colección
 * POST /api/collections/:slug/follow
 */
const followCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        const collectionResult = await query(
            'SELECT id FROM collections WHERE slug = $1 AND deleted_at IS NULL AND is_public = true',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        await query(
            `INSERT INTO collection_follows (user_id, collection_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [req.user.id, collectionResult.rows[0].id]
        );
        
        res.json({
            success: true,
            message: 'Ahora sigues esta colección'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Dejar de seguir colección
 * DELETE /api/collections/:slug/follow
 */
const unfollowCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        const collectionResult = await query(
            'SELECT id FROM collections WHERE slug = $1',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        await query(
            'DELETE FROM collection_follows WHERE user_id = $1 AND collection_id = $2',
            [req.user.id, collectionResult.rows[0].id]
        );
        
        res.json({
            success: true,
            message: 'Dejaste de seguir esta colección'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Dar like a colección
 * POST /api/collections/:slug/like
 */
const likeCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        const collectionResult = await query(
            'SELECT id FROM collections WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        await query(
            `INSERT INTO collection_likes (user_id, collection_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [req.user.id, collectionResult.rows[0].id]
        );
        
        res.json({
            success: true,
            message: 'Like agregado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Quitar like de colección
 * DELETE /api/collections/:slug/like
 */
const unlikeCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        const collectionResult = await query(
            'SELECT id FROM collections WHERE slug = $1',
            [slug]
        );
        
        if (collectionResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Colección no encontrada'
            });
        }
        
        await query(
            'DELETE FROM collection_likes WHERE user_id = $1 AND collection_id = $2',
            [req.user.id, collectionResult.rows[0].id]
        );
        
        res.json({
            success: true,
            message: 'Like eliminado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar colección (moderador)
 * POST /api/collections/:slug/verify
 */
const verifyCollection = async (req, res, next) => {
    try {
        const { slug } = req.params;
        
        await query(
            'UPDATE collections SET is_verified = true WHERE slug = $1',
            [slug]
        );
        
        res.json({
            success: true,
            message: 'Colección verificada'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listCollections,
    getPopularCollections,
    getCollection,
    getCollectionManhwas,
    getCollectionComments,
    createCollection,
    updateCollection,
    deleteCollection,
    addManhwaToCollection,
    removeManhwaFromCollection,
    reorderManhwas,
    followCollection,
    unfollowCollection,
    likeCollection,
    unlikeCollection,
    verifyCollection
};
