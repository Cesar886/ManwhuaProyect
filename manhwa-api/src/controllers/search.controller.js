/**
 * Controlador de Búsqueda
 */

const crypto = require('crypto');
const { query, transaction } = require('../config/database');

const GUEST_DAILY_IA_LIMIT = Math.max(1, parseInt(process.env.GUEST_DAILY_IA_LIMIT, 10) || 10);
const AI_READ_ENDPOINT = (() => {
    const raw = process.env.AI_API_URL || process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read';
    const cleaned = String(raw).replace(/\/+$/, '');
    return cleaned.endsWith('/api/read') ? cleaned : `${cleaned}/api/read`;
})();

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || null;
};

const normalizeDeviceId = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    return raw.slice(0, 128);
};

const getGuestFingerprint = (req) => {
    const ip = getClientIp(req) || 'unknown-ip';
    const userAgent = String(req.get('User-Agent') || 'unknown-ua').slice(0, 180);
    const deviceId = normalizeDeviceId(req.headers['x-device-id']) || 'unknown-device';
    const seed = `${ip}|${deviceId}|${userAgent}`;
    return crypto.createHash('sha256').update(seed).digest('hex');
};

const reserveGuestDailyAiQuota = async (req) => {
    const usageDate = new Date().toISOString().slice(0, 10);
    const fingerprintHash = getGuestFingerprint(req);
    const ip = getClientIp(req);
    const userAgent = String(req.get('User-Agent') || '').slice(0, 255) || null;
    const deviceId = normalizeDeviceId(req.headers['x-device-id']);

    return transaction(async (client) => {
        const existing = await client.query(
            `SELECT request_count
             FROM ai_guest_daily_usage
             WHERE usage_date = $1 AND fingerprint_hash = $2
             FOR UPDATE`,
            [usageDate, fingerprintHash]
        );

        if (existing.rows.length === 0) {
            const inserted = await client.query(
                `INSERT INTO ai_guest_daily_usage (
                    usage_date,
                    fingerprint_hash,
                    ip_address,
                    device_id,
                    user_agent,
                    request_count
                )
                VALUES ($1, $2, $3::inet, $4, $5, 1)
                RETURNING request_count`,
                [usageDate, fingerprintHash, ip || null, deviceId, userAgent]
            );

            return {
                allowed: true,
                used: inserted.rows[0].request_count,
                remaining: Math.max(0, GUEST_DAILY_IA_LIMIT - inserted.rows[0].request_count),
            };
        }

        const currentCount = Number(existing.rows[0].request_count) || 0;
        if (currentCount >= GUEST_DAILY_IA_LIMIT) {
            return {
                allowed: false,
                used: currentCount,
                remaining: 0,
            };
        }

        const updated = await client.query(
            `UPDATE ai_guest_daily_usage
             SET request_count = request_count + 1,
                 ip_address = COALESCE($3::inet, ip_address),
                 device_id = COALESCE($4, device_id),
                 user_agent = COALESCE($5, user_agent),
                 updated_at = NOW()
             WHERE usage_date = $1 AND fingerprint_hash = $2
             RETURNING request_count`,
            [usageDate, fingerprintHash, ip || null, deviceId, userAgent]
        );

        const used = Number(updated.rows[0].request_count) || 0;
        return {
            allowed: true,
            used,
            remaining: Math.max(0, GUEST_DAILY_IA_LIMIT - used),
        };
    });
};

/**
 * Búsqueda general
 * GET /api/search?q=...
 */
const search = async (req, res, next) => {
    try {
        const { q } = req.query;
        const limit = Math.min(parseInt(req.query.limit) || 25, 50);

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Búsqueda debe tener al menos 2 caracteres'
            });
        }

        const searchTerm = `%${q.trim()}%`;

        // Buscar series
        const seriesResult = await query(
            `SELECT id, title, slug, cover_url, status, rating_average, chapter_count
             FROM series
             WHERE deleted_at IS NULL AND is_adult = false
                   AND (title ILIKE $1 OR original_title ILIKE $1 OR synopsis ILIKE $1)
             ORDER BY
                CASE WHEN title ILIKE $2 THEN 0 ELSE 1 END,
                view_count DESC
             LIMIT $3`,
            [searchTerm, `${q.trim()}%`, limit]
        );

        // Buscar usuarios
        const usersResult = await query(
            `SELECT id, username, display_name, avatar_url, is_premium
             FROM users
             WHERE deleted_at IS NULL AND status = 'active'
                   AND (username ILIKE $1 OR display_name ILIKE $1)
             ORDER BY followers_count DESC
             LIMIT $2`,
            [searchTerm, 10]
        );

        // Buscar colecciones
        const collectionsResult = await query(
            `SELECT c.id, c.name, c.slug, c.cover_url, c.manhwas_count, c.followers_count,
                    u.username as creator_username
             FROM collections c
             JOIN users u ON c.creator_id = u.id
             WHERE c.deleted_at IS NULL AND c.is_public = true
                   AND (c.name ILIKE $1 OR c.description ILIKE $1)
             ORDER BY c.followers_count DESC
             LIMIT $2`,
            [searchTerm, 10]
        );
        
        res.json({
            success: true,
            data: {
                query: q,
                results: {
                    series: seriesResult.rows.map(s => ({
                        id: s.id,
                        title: s.title,
                        slug: s.slug,
                        coverUrl: s.cover_url,
                        status: s.status,
                        rating: parseFloat(s.rating_average),
                        chapterCount: s.chapter_count
                    })),
                    users: usersResult.rows.map(u => ({
                        id: u.id,
                        username: u.username,
                        displayName: u.display_name,
                        avatarUrl: u.avatar_url,
                        isPremium: u.is_premium
                    })),
                    collections: collectionsResult.rows.map(c => ({
                        id: c.id,
                        name: c.name,
                        slug: c.slug,
                        coverUrl: c.cover_url,
                        manhwasCount: c.manhwas_count,
                        followersCount: c.followers_count,
                        creatorUsername: c.creator_username
                    }))
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Buscar series
 * GET /api/search/series
 */
const searchSeries = async (req, res, next) => {
    try {
        const { q, genre, status, contentType, sort = 'relevance' } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 24, 50);
        const offset = (page - 1) * limit;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Búsqueda debe tener al menos 2 caracteres'
            });
        }
        
        let whereClause = `WHERE s.deleted_at IS NULL AND s.is_adult = false
                           AND (s.title ILIKE $1 OR s.original_title ILIKE $1 OR s.synopsis ILIKE $1)`;
        const params = [`%${q.trim()}%`];
        let paramCount = 1;
        
        if (genre) {
            paramCount++;
            whereClause += ` AND EXISTS (
                SELECT 1 FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                WHERE sg.series_id = s.id AND g.slug = $${paramCount}
            )`;
            params.push(genre);
        }
        
        if (status) {
            paramCount++;
            whereClause += ` AND s.status = $${paramCount}`;
            params.push(status);
        }
        
        if (contentType) {
            paramCount++;
            whereClause += ` AND s.content_type = $${paramCount}`;
            params.push(contentType);
        }
        
        let orderClause;
        switch (sort) {
            case 'popular':
                orderClause = 's.view_count DESC';
                break;
            case 'rating':
                orderClause = 's.rating_average DESC';
                break;
            case 'latest':
                orderClause = 's.last_chapter_at DESC NULLS LAST';
                break;
            case 'new':
                orderClause = 's.created_at DESC';
                break;
            default:
                paramCount++;
                orderClause = `CASE WHEN s.title ILIKE $${paramCount} THEN 0 ELSE 1 END, s.view_count DESC`;
                params.push(`${q.trim()}%`);
        }
        
        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.cover_url, s.status,
                    s.content_type, s.view_count, s.rating_average, s.chapter_count,
                    s.is_hot, s.is_new,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id LIMIT 4),
                        '[]'
                    ) as genres
             FROM series s
             ${whereClause}
             ORDER BY ${orderClause}
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM series s ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                query: q,
                series: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    status: s.status,
                    contentType: s.content_type,
                    views: s.view_count,
                    rating: parseFloat(s.rating_average),
                    chapterCount: s.chapter_count,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    genres: s.genres
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
 * Buscar usuarios
 * GET /api/search/users
 */
const searchUsers = async (req, res, next) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Búsqueda debe tener al menos 2 caracteres'
            });
        }
        
        const searchTerm = `%${q.trim()}%`;
        
        const result = await query(
            `SELECT id, username, display_name, avatar_url, bio, is_premium,
                    followers_count, collections_count
             FROM users
             WHERE deleted_at IS NULL AND status = 'active'
                   AND (username ILIKE $1 OR display_name ILIKE $1)
             ORDER BY 
                CASE WHEN username ILIKE $2 THEN 0 ELSE 1 END,
                followers_count DESC
             LIMIT $3 OFFSET $4`,
            [searchTerm, `${q.trim()}%`, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM users
             WHERE deleted_at IS NULL AND status = 'active'
                   AND (username ILIKE $1 OR display_name ILIKE $1)`,
            [searchTerm]
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                query: q,
                users: result.rows.map(u => ({
                    id: u.id,
                    username: u.username,
                    displayName: u.display_name,
                    avatarUrl: u.avatar_url,
                    bio: u.bio,
                    isPremium: u.is_premium,
                    followersCount: u.followers_count,
                    collectionsCount: u.collections_count
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
 * Buscar colecciones
 * GET /api/search/collections
 */
const searchCollections = async (req, res, next) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Búsqueda debe tener al menos 2 caracteres'
            });
        }
        
        const searchTerm = `%${q.trim()}%`;
        
        const result = await query(
            `SELECT c.*, u.username as creator_username, u.avatar_url as creator_avatar
             FROM collections c
             JOIN users u ON c.creator_id = u.id
             WHERE c.deleted_at IS NULL AND c.is_public = true
                   AND (c.name ILIKE $1 OR c.description ILIKE $1)
             ORDER BY c.followers_count DESC
             LIMIT $2 OFFSET $3`,
            [searchTerm, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM collections c
             WHERE c.deleted_at IS NULL AND c.is_public = true
                   AND (c.name ILIKE $1 OR c.description ILIKE $1)`,
            [searchTerm]
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                query: q,
                collections: result.rows.map(c => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description,
                    coverUrl: c.cover_url,
                    manhwasCount: c.manhwas_count,
                    followersCount: c.followers_count,
                    likesCount: c.likes_count,
                    isVerified: c.is_verified,
                    creator: {
                        id: c.creator_id,
                        username: c.creator_username,
                        avatarUrl: c.creator_avatar
                    }
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
 * Autocompletado
 * GET /api/search/autocomplete
 */
const autocomplete = async (req, res, next) => {
    try {
        const { q } = req.query;
        const limit = Math.min(parseInt(req.query.limit) || 15, 25);
        
        if (!q || q.trim().length < 1) {
            return res.json({
                success: true,
                data: { suggestions: [] }
            });
        }
        
        const trimmed = q.trim();
        const prefixTerm = `${trimmed}%`;
        const containsTerm = `%${trimmed}%`;

        const result = await query(
            `SELECT s.title, s.slug, s.cover_url, s.content_type,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM (
                             SELECT g2.name, g2.slug
                             FROM series_genres sg2 JOIN genres g2 ON sg2.genre_id = g2.id
                             WHERE sg2.series_id = s.id
                             LIMIT 3
                         ) g),
                        '[]'
                    ) as genres
             FROM series s
             WHERE s.deleted_at IS NULL AND s.is_adult = false
                   AND s.title ILIKE $2
             ORDER BY
                CASE WHEN s.title ILIKE $1 THEN 0 ELSE 1 END,
                s.view_count DESC
             LIMIT $3`,
            [prefixTerm, containsTerm, limit]
        );

        res.json({
            success: true,
            data: {
                suggestions: result.rows.map(r => ({
                    title: r.title,
                    slug: r.slug,
                    coverUrl: r.cover_url,
                    contentType: r.content_type,
                    genres: r.genres,
                    type: 'series'
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Búsqueda avanzada
 * GET /api/search/advanced
 */
const advancedSearch = async (req, res, next) => {
    try {
        const {
            q,
            genres,
            status,
            contentType,
            yearFrom,
            yearTo,
            ratingMin,
            chaptersMin,
            sort = 'popular',
            order = 'desc'
        } = req.query;
        
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 24, 50);
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE s.deleted_at IS NULL AND s.is_adult = false';
        const params = [];
        let paramCount = 0;
        
        if (q && q.trim().length >= 2) {
            paramCount++;
            whereClause += ` AND (s.title ILIKE $${paramCount} OR s.original_title ILIKE $${paramCount})`;
            params.push(`%${q.trim()}%`);
        }
        
        if (genres) {
            const genreList = genres.split(',').filter(g => g.trim());
            if (genreList.length > 0) {
                paramCount++;
                whereClause += ` AND EXISTS (
                    SELECT 1 FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                    WHERE sg.series_id = s.id AND g.slug = ANY($${paramCount})
                )`;
                params.push(genreList);
            }
        }
        
        if (status) {
            paramCount++;
            whereClause += ` AND s.status = $${paramCount}`;
            params.push(status);
        }
        
        if (contentType) {
            paramCount++;
            whereClause += ` AND s.content_type = $${paramCount}`;
            params.push(contentType);
        }
        
        if (yearFrom) {
            paramCount++;
            whereClause += ` AND s.release_year >= $${paramCount}`;
            params.push(parseInt(yearFrom));
        }
        
        if (yearTo) {
            paramCount++;
            whereClause += ` AND s.release_year <= $${paramCount}`;
            params.push(parseInt(yearTo));
        }
        
        if (ratingMin) {
            paramCount++;
            whereClause += ` AND s.rating_average >= $${paramCount}`;
            params.push(parseFloat(ratingMin));
        }
        
        if (chaptersMin) {
            paramCount++;
            whereClause += ` AND s.chapter_count >= $${paramCount}`;
            params.push(parseInt(chaptersMin));
        }
        
        const validSorts = {
            'popular': 's.view_count',
            'rating': 's.rating_average',
            'latest': 's.last_chapter_at',
            'new': 's.created_at',
            'chapters': 's.chapter_count',
            'title': 's.title'
        };
        const sortField = validSorts[sort] || 's.view_count';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
        
        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.cover_url, s.status,
                    s.content_type, s.view_count, s.rating_average, s.chapter_count,
                    s.release_year, s.is_hot, s.is_new,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id),
                        '[]'
                    ) as genres
             FROM series s
             ${whereClause}
             ORDER BY ${sortField} ${sortOrder} NULLS LAST
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM series s ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                series: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    status: s.status,
                    contentType: s.content_type,
                    views: s.view_count,
                    rating: parseFloat(s.rating_average),
                    chapterCount: s.chapter_count,
                    releaseYear: s.release_year,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    genres: s.genres
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
 * Proxy de IA con límite diario robusto para invitados
 * POST /api/search/ai/read
 */
const aiRead = async (req, res, next) => {
    try {
        const messages = req.body?.messages;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'messages es requerido y debe ser un arreglo no vacío',
                code: 'INVALID_IA_REQUEST'
            });
        }

        const isGuest = !req.user;
        let guestLimit = null;

        if (isGuest) {
            const quota = await reserveGuestDailyAiQuota(req);
            guestLimit = {
                limit: GUEST_DAILY_IA_LIMIT,
                used: quota.used,
                remaining: quota.remaining,
                blocked: !quota.allowed,
            };

            if (!quota.allowed) {
                return res.status(429).json({
                    success: false,
                    code: 'AI_GUEST_DAILY_LIMIT',
                    message: `Has alcanzado el límite diario de ${GUEST_DAILY_IA_LIMIT} consultas IA. Regístrate para seguir usándola.`,
                    guestLimit,
                });
            }
        }

        const searchContext = req.headers['x-search-context'];
        const aiHeaders = { 'Content-Type': 'application/json' };
        if (searchContext) {
            aiHeaders['X-Search-Context'] = String(searchContext);
        }

        const aiResponse = await fetch(AI_READ_ENDPOINT, {
            method: 'POST',
            headers: aiHeaders,
            body: JSON.stringify({ messages }),
        });

        const rawText = await aiResponse.text();
        let payload;
        try {
            payload = rawText ? JSON.parse(rawText) : {};
        } catch {
            payload = { success: false, message: rawText || 'Respuesta inválida del servicio IA' };
        }

        if (guestLimit) {
            payload.guestLimit = guestLimit;
            res.set('X-IA-Guest-Limit', String(guestLimit.limit));
            res.set('X-IA-Guest-Used', String(guestLimit.used));
            res.set('X-IA-Guest-Remaining', String(guestLimit.remaining));
        }

        return res.status(aiResponse.status).json(payload);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    search,
    searchSeries,
    searchUsers,
    searchCollections,
    autocomplete,
    advancedSearch,
    aiRead,
};
