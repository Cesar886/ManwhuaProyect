/**
 * Controlador de Búsqueda
 */

const crypto = require('crypto');
const { query } = require('../config/database');

const GUEST_DAILY_IA_LIMIT = Math.max(1, parseInt(process.env.GUEST_DAILY_IA_LIMIT, 10) || 5);
const USER_DAILY_IA_LIMIT = Math.max(1, parseInt(process.env.USER_DAILY_IA_LIMIT, 10) || 15);
const AI_FETCH_TIMEOUT_MS = Math.max(3000, parseInt(process.env.AI_FETCH_TIMEOUT_MS, 10) || 25000);
const AI_UPSTREAM_HTML_REGEX = /<html[\s>]|<!doctype\s/i;
const AI_UPSTREAM_MAINTENANCE_MESSAGE = 'El servicio IA devolvió una respuesta de mantenimiento o bloqueo de red. Intenta de nuevo en unos minutos.';
const AI_READ_ENDPOINT = (() => {
    const raw = process.env.AI_API_URL || process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:3003/api/read';
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

const buildQuotaState = (limit, quota) => ({
    limit,
    used: quota.used,
    remaining: quota.remaining,
    blocked: !quota.allowed,
});

const attachQuotaPayload = (payload, { guestLimit = null, userLimit = null } = {}) => {
    const response = payload && typeof payload === 'object' ? { ...payload } : {};

    if (guestLimit) {
        response.guestLimit = guestLimit;
    }

    if (userLimit) {
        response.userLimit = userLimit;
    }

    return response;
};

const reserveDailyAiQuota = async ({ limit, fingerprintHash, ip = null, deviceId = null, userAgent = null }) => {
    const usageDate = new Date().toISOString().slice(0, 10);
    const result = await query(
        `WITH upsert AS (
            INSERT INTO ai_guest_daily_usage (
                usage_date,
                fingerprint_hash,
                ip_address,
                device_id,
                user_agent,
                request_count
            )
            VALUES ($1, $2, $3::inet, $4, $5, 1)
            ON CONFLICT (usage_date, fingerprint_hash) DO UPDATE
            SET request_count = CASE
                    WHEN ai_guest_daily_usage.request_count < $6 THEN ai_guest_daily_usage.request_count + 1
                    ELSE ai_guest_daily_usage.request_count
                END,
                ip_address = COALESCE(EXCLUDED.ip_address, ai_guest_daily_usage.ip_address),
                device_id = COALESCE(EXCLUDED.device_id, ai_guest_daily_usage.device_id),
                user_agent = COALESCE(EXCLUDED.user_agent, ai_guest_daily_usage.user_agent),
                updated_at = NOW()
            WHERE ai_guest_daily_usage.request_count < $6
            RETURNING request_count
        )
        SELECT request_count, true AS allowed
        FROM upsert
        UNION ALL
        SELECT request_count, false AS allowed
        FROM ai_guest_daily_usage
        WHERE usage_date = $1 AND fingerprint_hash = $2
          AND NOT EXISTS (SELECT 1 FROM upsert)
        LIMIT 1`,
        [usageDate, fingerprintHash, ip, deviceId, userAgent, limit]
    );

    const row = result.rows[0];
    if (!row) {
        return {
            allowed: false,
            used: 0,
            remaining: 0,
        };
    }

    const used = Number(row.request_count) || 0;
    return {
        allowed: Boolean(row.allowed),
        used,
        remaining: Math.max(0, limit - used),
    };
};

const reserveGuestDailyAiQuota = async (req) => reserveDailyAiQuota({
    limit: GUEST_DAILY_IA_LIMIT,
    fingerprintHash: getGuestFingerprint(req),
    ip: getClientIp(req),
    deviceId: normalizeDeviceId(req.headers['x-device-id']),
    userAgent: String(req.get('User-Agent') || '').slice(0, 255) || null,
});

const reserveUserDailyAiQuota = async (userId) => reserveDailyAiQuota({
    limit: USER_DAILY_IA_LIMIT,
    fingerprintHash: crypto.createHash('sha256').update(`user:${userId}`).digest('hex'),
});

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
        let userLimit = null;

        try {
            if (isGuest) {
                const quota = await reserveGuestDailyAiQuota(req);
                guestLimit = buildQuotaState(GUEST_DAILY_IA_LIMIT, quota);

                if (!quota.allowed) {
                    return res.status(429).json(attachQuotaPayload({
                        success: false,
                        code: 'AI_GUEST_DAILY_LIMIT',
                        message: `Has alcanzado el límite diario de ${GUEST_DAILY_IA_LIMIT} consultas IA. Regístrate para seguir usándola.`,
                    }, { guestLimit }));
                }
            } else {
                const quota = await reserveUserDailyAiQuota(req.user.id);
                userLimit = buildQuotaState(USER_DAILY_IA_LIMIT, quota);

                if (!quota.allowed) {
                    return res.status(429).json(attachQuotaPayload({
                        success: false,
                        code: 'AI_USER_DAILY_LIMIT',
                        message: `Has alcanzado el límite diario de ${USER_DAILY_IA_LIMIT} consultas IA.`,
                    }, { userLimit }));
                }

                req._userAiQuota = userLimit;
            }
        } catch (quotaError) {
            console.error('[aiRead] No se pudo verificar la cuota IA; permitiendo request:', quotaError);
        }

        const searchContext = req.headers['x-search-context'];
        const aiHeaders = { 'Content-Type': 'application/json' };
        if (searchContext) {
            aiHeaders['X-Search-Context'] = String(searchContext);
        }

        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), AI_FETCH_TIMEOUT_MS);

        try {
            const aiResponse = await fetch(AI_READ_ENDPOINT, {
                method: 'POST',
                headers: aiHeaders,
                body: JSON.stringify({ messages }),
                signal: timeoutController.signal,
            });

            const rawText = await aiResponse.text().catch(() => '');
            const contentType = aiResponse.headers.get('content-type') || '';
            const appearsToBeHtml = AI_UPSTREAM_HTML_REGEX.test(String(rawText || ''));

            let payload = {};
            let payloadWasInvalid = false;
            if (contentType.includes('application/json') && rawText) {
                try {
                    payload = JSON.parse(rawText);
                } catch {
                    payload = {
                        success: false,
                        code: 'AI_UPSTREAM_INVALID_JSON',
                        message: rawText || 'Respuesta inválida del servicio IA',
                    };
                }
            } else if (rawText) {
                payload = {
                    success: false,
                    message: rawText,
                };
            }

            if (!payload || typeof payload !== 'object') {
                payloadWasInvalid = true;
                payload = {};
            }

            if (appearsToBeHtml) {
                payload = {
                    success: false,
                    code: 'AI_UPSTREAM_HTML_ERROR',
                    message: AI_UPSTREAM_MAINTENANCE_MESSAGE,
                };
            }

            if (!aiResponse.ok) {
                const status = appearsToBeHtml ? 503 : aiResponse.status;
                payload = attachQuotaPayload({
                    success: false,
                    code: payload.code || (status >= 500 ? 'AI_UPSTREAM_UNAVAILABLE' : 'AI_UPSTREAM_ERROR'),
                    message: payload.message || (status >= 500
                        ? 'No se pudo conectar con el servicio IA en este momento.'
                        : `El servicio IA respondió con error ${aiResponse.status}.`),
                }, {
                    guestLimit,
                    userLimit: req._userAiQuota || userLimit,
                });

                if (appearsToBeHtml) {
                    payload.code = 'AI_UPSTREAM_HTML_ERROR';
                    payload.message = AI_UPSTREAM_MAINTENANCE_MESSAGE;
                }

                res.status(status);
                if (guestLimit) {
                    res.set('X-IA-Guest-Limit', String(guestLimit.limit));
                    res.set('X-IA-Guest-Used', String(guestLimit.used));
                    res.set('X-IA-Guest-Remaining', String(guestLimit.remaining));
                }
                return res.json(payload);
            }

            if (payloadWasInvalid) {
                return res.status(502).json(attachQuotaPayload({
                    success: false,
                    code: 'AI_UPSTREAM_INVALID_RESPONSE',
                    message: 'El servicio IA devolvió una respuesta inválida.',
                }, {
                    guestLimit,
                    userLimit: req._userAiQuota || userLimit,
                }));
            }

            payload = attachQuotaPayload(payload, {
                guestLimit,
                userLimit: req._userAiQuota || userLimit,
            });

            if (guestLimit) {
                res.set('X-IA-Guest-Limit', String(guestLimit.limit));
                res.set('X-IA-Guest-Used', String(guestLimit.used));
                res.set('X-IA-Guest-Remaining', String(guestLimit.remaining));
            }

            if (appearsToBeHtml) {
                return res.status(503).json(attachQuotaPayload({
                    success: false,
                    code: 'AI_UPSTREAM_HTML_ERROR',
                    message: AI_UPSTREAM_MAINTENANCE_MESSAGE,
                }, {
                    guestLimit,
                    userLimit: req._userAiQuota || userLimit,
                }));
            }

            return res.status(200).json(payload);
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        if (error?.name === 'AbortError') {
            return res.status(504).json(attachQuotaPayload({
                success: false,
                code: 'AI_UPSTREAM_TIMEOUT',
                message: 'El servicio IA tardó demasiado en responder.',
            }, {
                guestLimit,
                userLimit: req._userAiQuota || userLimit,
            }));
        }

        return res.status(502).json(attachQuotaPayload({
            success: false,
            code: 'AI_UPSTREAM_UNAVAILABLE',
            message: 'No se pudo conectar con el servicio IA en este momento.',
        }, {
            guestLimit,
            userLimit: req._userAiQuota || userLimit,
        }));
    }
};

/**
 * Obtener el search_count de una query desde el servicio IA (no requiere auth)
 * POST /api/search/ai/track
 */
const AI_POPULAR_URL = (() => {
    const base = AI_READ_ENDPOINT.replace(/\/api\/read$/, '');
    return `${base}/api/popular`;
})();

const trackAiSearch = async (req, res) => {
    const queryText = (req.body?.query || '').trim();
    if (!queryText || queryText.length < 2) {
        return res.status(400).json({ success: false, message: 'query es requerido (min 2 chars)' });
    }

    const normalized = queryText.toLowerCase();

    // 1) Incrementar contador local (para queries que no estén en el top del servicio IA)
    let localCount = null;
    try {
        const localResult = await query(
            `INSERT INTO global_behavior_search_queries
                (query_text, query_normalized, search_count, click_count, first_seen_at, last_seen_at, created_at, updated_at)
             VALUES ($1, $2, 1, 0, timezone('utc', now()), timezone('utc', now()), timezone('utc', now()), timezone('utc', now()))
             ON CONFLICT (query_normalized) DO UPDATE SET
                search_count = global_behavior_search_queries.search_count + 1,
                last_seen_at = timezone('utc', now()),
                updated_at = timezone('utc', now())
             RETURNING search_count`,
            [queryText, normalized]
        );
        localCount = localResult.rows[0]?.search_count || 1;
    } catch (dbErr) {
        console.error('[trackAiSearch] DB error:', dbErr.message);
    }

    // 2) Intentar obtener el count real desde el servicio IA (popular endpoint)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const popularRes = await fetch(AI_POPULAR_URL, {
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (popularRes.ok) {
            const data = await popularRes.json();
            const allQueries = [...(data.queries || []), ...(data.popular || []), ...(data.similar || [])];
            const match = allQueries.find(q => (q.query || '').toLowerCase() === normalized);
            if (match?.count) {
                return res.json({ success: true, searchCount: match.count });
            }
        }
    } catch {
        // Si falla el servicio IA, usar count local
    }

    return res.json({ success: true, searchCount: localCount });
};

module.exports = {
    search,
    searchSeries,
    searchUsers,
    searchCollections,
    autocomplete,
    advancedSearch,
    aiRead,
    trackAiSearch,
};
