/**
 * Controlador de Series
 */

const { query, transaction } = require('../config/database');
const slugify = require('slugify');
const logger = require('../utils/logger');

/**
 * Listar series con filtros
 * GET /api/series
 */
const listSeries = async (req, res, next) => {
    try {
        // Cache: CDN 60s, browser 30s, stale OK for 5 min
        res.set({
            'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=300',
            'Vary': 'Accept-Encoding'
        });

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 24, 100));
        const offset = (page - 1) * limit;

        const {
            status,
            contentType,
            genre,
            sort = 'updated_at',
            order = 'desc',
            search,
            adult = 'false'
        } = req.query;

        let whereClause = 'WHERE s.deleted_at IS NULL';
        const params = [];
        let paramCount = 0;

        // Filtrar contenido adulto
        if (adult !== 'true') {
            whereClause += ' AND s.is_adult = false';
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

        if (genre) {
            paramCount++;
            whereClause += ` AND EXISTS (
                SELECT 1 FROM series_genres sg 
                JOIN genres g ON sg.genre_id = g.id 
                WHERE sg.series_id = s.id AND g.slug = $${paramCount}
            )`;
            params.push(genre);
        }

        if (search) {
            paramCount++;
            whereClause += ` AND (
                s.title ILIKE $${paramCount} OR 
                s.original_title ILIKE $${paramCount} OR
                s.synopsis ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }

        // Ordenamiento: usar índice mapeado + CASE en SQL para evitar interpolación directa
        const sortMap = {
            'updated_at': 1,
            'created_at': 2,
            'title': 3,
            'views': 4,
            'rating': 5,
            'popularity': 6
        };
        const sortIndex = sortMap[sort] || 1; // fallback a 'updated_at'
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

        // Query principal
        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.alternative_titles, s.synopsis,
                s.content_type, s.status, s.cover_url, s.release_year, s.country, s.original_language,
                s.author_id, s.view_count, s.monthly_views, s.weekly_views, s.daily_views,
                s.bookmark_count, s.likes_count, s.rating_average, s.rating_count,
                s.chapter_count, s.comment_count, s.meta_title, s.meta_description,
                s.is_featured, s.is_hot, s.is_new, s.is_trending, s.is_adult, s.last_chapter_at,
                s.average_chapter_length, s.themes, s.tone, s.protagonist_type, s.has_anime, s.has_drama,
                s.narrative_tropes, s.official_hashtags, s.age_recommendation, s.content_warnings, s.romance_level,
                s.power_system, s.entry_barrier, s.serialization_platform, s.adaptations, s.art_style,
                s.color_scheme, s.awards, s.world_building_depth, s.publication_format, s.has_physical_edition,
                s.trigger_warnings, s.target_demographic, s.international_title_variations, s.update_reliability,
                s.writing_quality, s.cultural_notes, s.educational_value,
                -- Subquery para traer el/los últimos capítulos publicados (como JSON)
                (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
                    SELECT id, number, title, slug, published_at
                    FROM chapters c
                    WHERE c.series_id = s.id AND c.is_published = true
                    ORDER BY number DESC
                    LIMIT 1
                ) t) as latest_chapters,
                    COALESCE(
                        (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id),
                        '[]'
                    ) as genres
             FROM series s
             ${whereClause}
             ORDER BY
                 CASE WHEN $${paramCount + 1} = 1 THEN s.last_chapter_at END ${sortOrder} NULLS LAST,
                 CASE WHEN $${paramCount + 1} = 2 THEN s.created_at END ${sortOrder} NULLS LAST,
                 CASE WHEN $${paramCount + 1} = 3 THEN s.title END ${sortOrder} NULLS LAST,
                 CASE WHEN $${paramCount + 1} = 4 THEN s.view_count END ${sortOrder} NULLS LAST,
                 CASE WHEN $${paramCount + 1} = 5 THEN s.rating_average END ${sortOrder} NULLS LAST,
                 CASE WHEN $${paramCount + 1} = 6 THEN s.bookmark_count END ${sortOrder} NULLS LAST
             LIMIT $${paramCount + 2} OFFSET $${paramCount + 3}`,
            [...params, sortIndex, limit, offset]
        );

        // Contar total
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
                    synopsis: s.synopsis,
                    originalTitle: s.original_title,
                    alternativeTitles: s.alternative_titles,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    bannerUrl: s.banner_url,
                    status: s.status,
                    contentType: s.content_type,
                    releaseYear: s.release_year,
                    country: s.country,
                    originalLanguage: s.original_language,
                    authorId: s.author_id,
                    views: s.view_count,
                    monthlyViews: s.monthly_views,
                    weeklyViews: s.weekly_views,
                    dailyViews: s.daily_views,
                    rating: parseFloat(s.rating_average),
                    ratingCount: s.rating_count,
                    chapterCount: s.chapter_count,
                    bookmarkCount: s.bookmark_count,
                    likesCount: s.likes_count,
                    commentCount: s.comment_count,
                    metaTitle: s.meta_title,
                    metaDescription: s.meta_description,
                    isAdult: s.is_adult,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    isFeatured: s.is_featured,
                    isTrending: s.is_trending,
                    genres: s.genres,
                    lastChapterAt: s.last_chapter_at,
                    latestChapters: s.latest_chapters || [],
                    averageChapterLength: s.average_chapter_length,
                    themes: s.themes,
                    tone: s.tone,
                    protagonistType: s.protagonist_type,
                    hasAnime: s.has_anime,
                    hasDrama: s.has_drama,
                    narrativeTropes: s.narrative_tropes,
                    officialHashtags: s.official_hashtags,
                    ageRecommendation: s.age_recommendation,
                    contentWarnings: s.content_warnings,
                    romanceLevel: s.romance_level,
                    powerSystem: s.power_system,
                    entryBarrier: s.entry_barrier,
                    serializationPlatform: s.serialization_platform,
                    adaptations: s.adaptations,
                    artStyle: s.art_style,
                    colorScheme: s.color_scheme,
                    awards: s.awards,
                    worldBuildingDepth: s.world_building_depth,
                    publicationFormat: s.publication_format,
                    hasPhysicalEdition: s.has_physical_edition,
                    triggerWarnings: s.trigger_warnings,
                    targetDemographic: s.target_demographic,
                    internationalTitleVariations: s.international_title_variations,
                    updateReliability: s.update_reliability,
                    writingQuality: s.writing_quality,
                    culturalNotes: s.cultural_notes,
                    educationalValue: s.educational_value
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
 * Obtener detalle de serie
 * GET /api/series/:slug
 */
const getSeriesDetail = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const result = await query(
            `SELECT s.*,
                    a.name as author_name, a.slug as author_slug,
                    ar.name as artist_name, ar.slug as artist_slug,
                    COALESCE(
                        (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'slug', g.slug, 'color', g.color))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id),
                        '[]'
                    ) as genres,
                    EXISTS(SELECT 1 FROM bookmarks WHERE user_id = $2 AND series_id = s.id) as is_bookmarked,
                    EXISTS(SELECT 1 FROM series_likes WHERE user_id = $2 AND series_id = s.id) as is_liked,
                    (SELECT score FROM ratings WHERE user_id = $2 AND series_id = s.id) as user_rating
             FROM series s
             LEFT JOIN authors a ON s.author_id = a.id
             LEFT JOIN authors ar ON s.artist_id = ar.id
             WHERE s.slug = $1 AND s.deleted_at IS NULL`,
            [slug, req.user?.id || null]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        const series = result.rows[0];

        // NOTA: Las vistas se registran vía POST /:slug/view desde el cliente.
        // No incrementamos aquí para evitar contar hits de SSR, bots y crawlers.

        // Obtener últimos capítulos
        const chaptersResult = await query(
            `SELECT id, number, title, slug, published_at, view_count, is_premium
             FROM chapters
             WHERE series_id = $1 AND is_published = true
             ORDER BY number DESC
             LIMIT 5`,
            [series.id]
        );

        res.json({
            success: true,
            data: {
                series: {
                    id: series.id,
                    title: series.title,
                    originalTitle: series.original_title,
                    alternativeTitles: series.alternative_titles,
                    slug: series.slug,
                    synopsis: series.synopsis,
                    description: series.description,
                    coverUrl: series.cover_url,
                    bannerUrl: series.banner_url,
                    status: series.status,
                    contentType: series.content_type,
                    releaseYear: series.release_year,
                    country: series.country,
                    originalLanguage: series.original_language,
                    authorId: series.author_id,
                    author: series.author_name ? {
                        name: series.author_name,
                        slug: series.author_slug
                    } : null,
                    artist: series.artist_name ? {
                        name: series.artist_name,
                        slug: series.artist_slug
                    } : null,
                    genres: series.genres,
                    stats: {
                        views: series.view_count,
                        monthlyViews: series.monthly_views,
                        bookmarks: series.bookmark_count,
                        likes: series.likes_count,
                        rating: parseFloat(series.rating_average),
                        ratingCount: series.rating_count,
                        chapterCount: series.chapter_count,
                        commentCount: series.comment_count
                    },
                    metaTitle: series.meta_title,
                    metaDescription: series.meta_description,
                    flags: {
                        isAdult: series.is_adult,
                        isFeatured: series.is_featured,
                        isHot: series.is_hot,
                        isNew: series.is_new,
                        isTrending: series.is_trending
                    },
                    userInteraction: {
                        isBookmarked: series.is_bookmarked,
                        isLiked: series.is_liked,
                        userRating: series.user_rating
                    },
                    lastChapterAt: series.last_chapter_at,
                    createdAt: series.created_at,
                    latestChapters: chaptersResult.rows.map(c => ({
                        id: c.id,
                        number: parseFloat(c.number),
                        title: c.title,
                        slug: c.slug,
                        publishedAt: c.published_at,
                        views: c.view_count,
                        isPremium: c.is_premium
                    }))
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener capítulos de una serie
 * GET /api/series/:slug/chapters
 */
const getSeriesChapters = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;
        const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

        // Obtener serie
        const seriesResult = await query(
            'SELECT id, chapter_count FROM series WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        const series = seriesResult.rows[0];

        // Obtener capítulos
        const result = await query(
            `SELECT id, number, title, slug, published_at, view_count, is_premium, coin_cost, page_count
             FROM chapters
             WHERE series_id = $1 AND is_published = true
             ORDER BY number ${order}
             LIMIT $2 OFFSET $3`,
            [series.id, limit, offset]
        );

        res.json({
            success: true,
            data: {
                chapters: result.rows.map(c => ({
                    id: c.id,
                    number: parseFloat(c.number),
                    title: c.title,
                    slug: c.slug,
                    publishedAt: c.published_at,
                    views: c.view_count,
                    isPremium: c.is_premium,
                    coinCost: c.coin_cost,
                    pageCount: c.page_count
                })),
                pagination: {
                    page,
                    limit,
                    total: series.chapter_count,
                    pages: Math.ceil(series.chapter_count / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener series destacadas
 * GET /api/series/featured
 */
const getFeaturedSeries = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 20);

        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.alternative_titles, s.synopsis,
                    s.content_type, s.status, s.cover_url, s.banner_url, s.release_year, s.country, s.original_language,
                    s.author_id, s.view_count, s.monthly_views, s.weekly_views, s.daily_views,
                    s.bookmark_count, s.likes_count, s.rating_average, s.rating_count,
                    s.chapter_count, s.comment_count, s.meta_title, s.meta_description,
                    s.is_featured, s.is_hot, s.is_new, s.is_trending, s.is_adult,
                    COALESCE(
                        (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id),
                        '[]'
                    ) as genres
             FROM series s
             WHERE s.is_featured = true AND s.deleted_at IS NULL
             ORDER BY s.view_count DESC
             LIMIT $1`,
            [limit]
        );

        res.json({
            success: true,
            data: {
                series: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    alternativeTitles: s.alternative_titles,
                    slug: s.slug,
                    synopsis: s.synopsis,
                    coverUrl: s.cover_url,
                    bannerUrl: s.banner_url,
                    status: s.status,
                    contentType: s.content_type,
                    releaseYear: s.release_year,
                    country: s.country,
                    originalLanguage: s.original_language,
                    authorId: s.author_id,
                    views: s.view_count,
                    monthlyViews: s.monthly_views,
                    weeklyViews: s.weekly_views,
                    dailyViews: s.daily_views,
                    bookmarkCount: s.bookmark_count,
                    likesCount: s.likes_count,
                    rating: parseFloat(s.rating_average),
                    ratingCount: s.rating_count,
                    chapterCount: s.chapter_count,
                    commentCount: s.comment_count,
                    metaTitle: s.meta_title,
                    metaDescription: s.meta_description,
                    isAdult: s.is_adult,
                    isFeatured: s.is_featured,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    isTrending: s.is_trending,
                    genres: s.genres
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener series populares
 * GET /api/series/popular
 */
const getPopularSeries = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);
        const period = req.query.period || 'weekly'; // daily, weekly, monthly, all

        let viewColumn = 'view_count';
        if (period === 'daily') viewColumn = 'daily_views';
        else if (period === 'weekly') viewColumn = 'weekly_views';
        else if (period === 'monthly') viewColumn = 'monthly_views';

        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.alternative_titles, s.synopsis,
                    s.content_type, s.status, s.cover_url, s.banner_url, s.release_year, s.country, s.original_language,
                    s.author_id, s.${viewColumn} as period_views, s.view_count, s.monthly_views, s.weekly_views, s.daily_views,
                    s.bookmark_count, s.likes_count, s.rating_average, s.rating_count,
                    s.chapter_count, s.comment_count, s.meta_title, s.meta_description,
                    s.is_featured, s.is_hot, s.is_new, s.is_trending, s.is_adult,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id LIMIT 3),
                        '[]'
                    ) as genres
             FROM series s
             WHERE s.deleted_at IS NULL AND s.is_adult = false
             ORDER BY s.${viewColumn} DESC
             LIMIT $1`,
            [limit]
        );

        res.json({
            success: true,
            data: {
                series: result.rows.map((s, index) => ({
                    rank: index + 1,
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    alternativeTitles: s.alternative_titles,
                    slug: s.slug,
                    synopsis: s.synopsis,
                    coverUrl: s.cover_url,
                    bannerUrl: s.banner_url,
                    status: s.status,
                    contentType: s.content_type,
                    releaseYear: s.release_year,
                    country: s.country,
                    originalLanguage: s.original_language,
                    authorId: s.author_id,
                    periodViews: s.period_views,
                    totalViews: s.view_count,
                    monthlyViews: s.monthly_views,
                    weeklyViews: s.weekly_views,
                    dailyViews: s.daily_views,
                    bookmarkCount: s.bookmark_count,
                    likesCount: s.likes_count,
                    rating: parseFloat(s.rating_average),
                    ratingCount: s.rating_count,
                    chapterCount: s.chapter_count,
                    commentCount: s.comment_count,
                    metaTitle: s.meta_title,
                    metaDescription: s.meta_description,
                    isHot: s.is_hot,
                    isFeatured: s.is_featured,
                    isNew: s.is_new,
                    isTrending: s.is_trending,
                    isAdult: s.is_adult,
                    genres: s.genres
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener últimas actualizaciones
 * GET /api/series/latest
 */
const getLatestSeries = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const result = await query(
            `SELECT DISTINCT ON (s.id)
                    s.id, s.title, s.original_title, s.slug, s.alternative_titles, s.synopsis, s.cover_url, s.banner_url, s.status,
                    s.content_type, s.release_year, s.country, s.original_language, s.author_id,
                    s.view_count, s.monthly_views, s.weekly_views, s.daily_views,
                    s.bookmark_count, s.likes_count, s.rating_average, s.rating_count,
                    c.number as latest_chapter, c.title as chapter_title,
                    c.published_at, s.chapter_count, s.comment_count, s.meta_title, s.meta_description,
                    s.is_featured, s.is_hot, s.is_new, s.is_trending, s.is_adult
             FROM series s
             JOIN chapters c ON c.series_id = s.id AND c.is_published = true
             WHERE s.deleted_at IS NULL AND s.is_adult = false
             ORDER BY s.id, c.published_at DESC`,
            []
        );

        // Ordenar por fecha de último capítulo
        const sorted = result.rows
            .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
            .slice(0, limit);

        res.json({
            success: true,
            data: {
                series: sorted.map(s => ({
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    alternativeTitles: s.alternative_titles,
                    synopsis: s.synopsis,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    bannerUrl: s.banner_url,
                    status: s.status,
                    contentType: s.content_type,
                    releaseYear: s.release_year,
                    country: s.country,
                    originalLanguage: s.original_language,
                    authorId: s.author_id,
                    views: s.view_count,
                    monthlyViews: s.monthly_views,
                    weeklyViews: s.weekly_views,
                    dailyViews: s.daily_views,
                    bookmarkCount: s.bookmark_count,
                    likesCount: s.likes_count,
                    rating: parseFloat(s.rating_average),
                    ratingCount: s.rating_count,
                    latestChapter: {
                        number: parseFloat(s.latest_chapter),
                        title: s.chapter_title,
                        publishedAt: s.published_at
                    },
                    chapterCount: s.chapter_count,
                    commentCount: s.comment_count,
                    metaTitle: s.meta_title,
                    metaDescription: s.meta_description,
                    isAdult: s.is_adult,
                    isFeatured: s.is_featured,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    isTrending: s.is_trending
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener series trending
 * GET /api/series/trending
 */
const getTrendingSeries = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 20);

        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.alternative_titles, s.synopsis, s.cover_url, s.banner_url, s.status,
                    s.content_type, s.release_year, s.country, s.original_language, s.author_id,
                    s.view_count, s.monthly_views, s.weekly_views, s.daily_views, s.bookmark_count, s.likes_count,
                    s.rating_average, s.rating_count, s.chapter_count, s.comment_count, s.meta_title, s.meta_description,
                    s.is_featured, s.is_hot, s.is_new, s.is_trending, s.is_adult,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id LIMIT 2),
                        '[]'
                    ) as genres
             FROM series s
             WHERE s.deleted_at IS NULL AND s.is_adult = false
             ORDER BY (s.daily_views * 3 + s.weekly_views) DESC
             LIMIT $1`,
            [limit]
        );

        res.json({
            success: true,
            data: {
                series: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    alternativeTitles: s.alternative_titles,
                    synopsis: s.synopsis,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    bannerUrl: s.banner_url,
                    status: s.status,
                    contentType: s.content_type,
                    releaseYear: s.release_year,
                    country: s.country,
                    originalLanguage: s.original_language,
                    authorId: s.author_id,
                    views: s.view_count,
                    monthlyViews: s.monthly_views,
                    weeklyViews: s.weekly_views,
                    dailyViews: s.daily_views,
                    bookmarkCount: s.bookmark_count,
                    likesCount: s.likes_count,
                    rating: parseFloat(s.rating_average),
                    ratingCount: s.rating_count,
                    chapterCount: s.chapter_count,
                    commentCount: s.comment_count,
                    metaTitle: s.meta_title,
                    metaDescription: s.meta_description,
                    isAdult: s.is_adult,
                    isFeatured: s.is_featured,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    isTrending: s.is_trending,
                    genres: s.genres
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener nuevos lanzamientos
 * GET /api/series/new-releases
 */
const getNewReleases = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);

        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.alternative_titles, s.synopsis, s.cover_url, s.banner_url, s.status,
                    s.content_type, s.release_year, s.country, s.original_language, s.author_id,
                    s.view_count, s.monthly_views, s.weekly_views, s.daily_views, s.bookmark_count, s.likes_count,
                    s.rating_average, s.rating_count, s.chapter_count, s.comment_count, s.meta_title, s.meta_description,
                    s.is_featured, s.is_hot, s.is_new, s.is_trending, s.is_adult, s.created_at,
                    COALESCE(
                        (SELECT json_agg(json_build_object('name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id LIMIT 3),
                        '[]'
                    ) as genres
             FROM series s
             WHERE s.deleted_at IS NULL AND s.is_adult = false
             ORDER BY s.created_at DESC
             LIMIT $1`,
            [limit]
        );

        res.json({
            success: true,
            data: {
                series: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    alternativeTitles: s.alternative_titles,
                    slug: s.slug,
                    synopsis: s.synopsis,
                    coverUrl: s.cover_url,
                    bannerUrl: s.banner_url,
                    status: s.status,
                    contentType: s.content_type,
                    releaseYear: s.release_year,
                    country: s.country,
                    originalLanguage: s.original_language,
                    authorId: s.author_id,
                    views: s.view_count,
                    monthlyViews: s.monthly_views,
                    weeklyViews: s.weekly_views,
                    dailyViews: s.daily_views,
                    bookmarkCount: s.bookmark_count,
                    likesCount: s.likes_count,
                    rating: parseFloat(s.rating_average),
                    ratingCount: s.rating_count,
                    chapterCount: s.chapter_count,
                    commentCount: s.comment_count,
                    metaTitle: s.meta_title,
                    metaDescription: s.meta_description,
                    isAdult: s.is_adult,
                    isFeatured: s.is_featured,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    isTrending: s.is_trending,
                    genres: s.genres,
                    createdAt: s.created_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener comentarios de una serie
 * GET /api/series/:slug/comments
 */
const getSeriesComments = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        // Obtener serie
        const seriesResult = await query(
            'SELECT id, comment_count FROM series WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        const series = seriesResult.rows[0];

        // Obtener comentarios raíz
        const result = await query(
            `SELECT c.*, u.username, u.display_name, u.avatar_url, u.role as user_role,
                    EXISTS(SELECT 1 FROM comment_votes WHERE user_id = $3 AND comment_id = c.id AND vote_type = 1) as user_liked,
                    EXISTS(SELECT 1 FROM comment_votes WHERE user_id = $3 AND comment_id = c.id AND vote_type = -1) as user_disliked
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.target_type = 'series' AND c.target_id = $1 
                   AND c.parent_id IS NULL AND c.status = 'visible'
             ORDER BY c.is_pinned DESC, c.created_at DESC
             LIMIT $2 OFFSET $4`,
            [series.id, limit, req.user?.id || null, offset]
        );

        res.json({
            success: true,
            data: {
                comments: result.rows.map(c => ({
                    id: c.id,
                    content: c.content,
                    rating: c.rating,
                    author: {
                        id: c.user_id,
                        username: c.username,
                        displayName: c.display_name,
                        avatarUrl: c.avatar_url,
                        role: c.user_role
                    },
                    likes: c.likes_count,
                    dislikes: c.dislikes_count,
                    repliesCount: c.replies_count,
                    isPinned: c.is_pinned,
                    isSpoiler: c.is_spoiler,
                    userLiked: c.user_liked,
                    userDisliked: c.user_disliked,
                    createdAt: c.created_at,
                    editedAt: c.edited_at
                })),
                pagination: {
                    page,
                    limit,
                    total: series.comment_count,
                    pages: Math.ceil(series.comment_count / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener series relacionadas
 * GET /api/series/:slug/related
 */
const getRelatedSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 6, 12);

        // Obtener géneros de la serie
        const seriesResult = await query(
            `SELECT s.id, array_agg(sg.genre_id) as genre_ids
             FROM series s
             LEFT JOIN series_genres sg ON s.id = sg.series_id
             WHERE s.slug = $1 AND s.deleted_at IS NULL
             GROUP BY s.id`,
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        const series = seriesResult.rows[0];
        const genreIds = series.genre_ids.filter(id => id !== null);

        if (genreIds.length === 0) {
            return res.json({ success: true, data: { series: [] } });
        }

        // Buscar series con géneros similares
        const result = await query(
            `SELECT s.id, s.title, s.original_title, s.slug, s.alternative_titles, s.synopsis, s.cover_url, s.banner_url, s.status,
                    s.content_type, s.release_year, s.country, s.original_language, s.author_id,
                    s.view_count, s.monthly_views, s.weekly_views, s.daily_views, s.bookmark_count, s.likes_count,
                    s.rating_average, s.rating_count, s.chapter_count, s.comment_count, s.meta_title, s.meta_description,
                    s.is_featured, s.is_hot, s.is_new, s.is_trending, s.is_adult,
                    COUNT(sg.genre_id) as matching_genres
             FROM series s
             JOIN series_genres sg ON s.id = sg.series_id
             WHERE sg.genre_id = ANY($1) 
                   AND s.id != $2 
                   AND s.deleted_at IS NULL
                   AND s.is_adult = false
             GROUP BY s.id
             ORDER BY matching_genres DESC, s.view_count DESC
             LIMIT $3`,
            [genreIds, series.id, limit]
        );

        res.json({
            success: true,
            data: {
                series: result.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    originalTitle: s.original_title,
                    alternativeTitles: s.alternative_titles,
                    synopsis: s.synopsis,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    bannerUrl: s.banner_url,
                    status: s.status,
                    contentType: s.content_type,
                    releaseYear: s.release_year,
                    country: s.country,
                    originalLanguage: s.original_language,
                    authorId: s.author_id,
                    views: s.view_count,
                    monthlyViews: s.monthly_views,
                    weeklyViews: s.weekly_views,
                    dailyViews: s.daily_views,
                    bookmarkCount: s.bookmark_count,
                    likesCount: s.likes_count,
                    rating: parseFloat(s.rating_average),
                    ratingCount: s.rating_count,
                    chapterCount: s.chapter_count,
                    commentCount: s.comment_count,
                    metaTitle: s.meta_title,
                    metaDescription: s.meta_description,
                    isAdult: s.is_adult,
                    isFeatured: s.is_featured,
                    isHot: s.is_hot,
                    isNew: s.is_new,
                    isTrending: s.is_trending
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Dar like a una serie
 * POST /api/series/:slug/like
 */
const likeSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;

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

        await query(
            `INSERT INTO series_likes (user_id, series_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [req.user.id, seriesId]
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
 * Quitar like de una serie
 * DELETE /api/series/:slug/like
 */
const unlikeSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const seriesResult = await query(
            'SELECT id FROM series WHERE slug = $1',
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        await query(
            'DELETE FROM series_likes WHERE user_id = $1 AND series_id = $2',
            [req.user.id, seriesResult.rows[0].id]
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
 * Agregar a bookmarks
 * POST /api/series/:slug/bookmark
 */
const bookmarkSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;

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

        await query(
            `INSERT INTO bookmarks (user_id, series_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, series_id) DO NOTHING`,
            [req.user.id, seriesId]
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
 * Quitar de bookmarks
 * DELETE /api/series/:slug/bookmark
 */
const unbookmarkSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const seriesResult = await query(
            'SELECT id FROM series WHERE slug = $1',
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        await query(
            'DELETE FROM bookmarks WHERE user_id = $1 AND series_id = $2',
            [req.user.id, seriesResult.rows[0].id]
        );

        res.json({
            success: true,
            message: 'Serie eliminada de favoritos'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Calificar serie
 * POST /api/series/:slug/rate
 */


const rateSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { score, review, visitorId, timestamp } = req.body;

        // 2. Reading Time / Interaction Check
        if (timestamp) {
            const timeDiff = Date.now() - new Date(timestamp).getTime();
            if (timeDiff < 3000) { // 3 seconds for series page
                return res.status(429).json({
                    success: false,
                    message: 'Interacción demasiado rápida.'
                });
            }
        }

        // Validar que haya al menos un identificador
        if (!req.user && !visitorId) {
            return res.status(401).json({
                success: false,
                message: 'Identificación requerida (Login o VisitorID)'
            });
        }

        // Si es visitor (1-5 estrellas), convertir a score 1-10 si viene como rating
        let finalScore = score;
        if (req.body.rating && !score) {
            finalScore = req.body.rating * 2;
        }

        if (!finalScore || finalScore < 1 || finalScore > 10) {
            return res.status(400).json({
                success: false,
                message: 'Calificación debe ser entre 1 y 10 (o 0.5-5 estrellas)'
            });
        }

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
        let ratingSaved = false;

        // 1. Si es usuario logueado -> Tabla 'ratings' principal
        if (req.user) {
            // Verificar si ya votó (Usando UPSERT real en lugar de rechazar 409)
            // Lógica de base de datos: La regla del "UPSERT" - Si ya votó, actualizamos.
            await query(
                `INSERT INTO ratings (user_id, series_id, score, review)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, series_id) 
                 DO UPDATE SET score = $3, review = $4, updated_at = NOW()`,
                [req.user.id, seriesId, finalScore, review || null]
            );
            ratingSaved = true;
        }
        // 2. Si es visitante -> Tabla 'series_ratings'
        else if (visitorId) {
            // Convertir 1-10 a 1-5 para series_ratings
            const rating1to5 = Math.round(finalScore / 2);
            // Asegurar rango 1-5
            const validRating = Math.max(1, Math.min(5, rating1to5));

            // Implementar lógica UPSERT para visitors también
            // "Si NO existe: Haces un INSERT. Si SÍ existe: Haces un UPDATE."
            await query(
                `INSERT INTO series_ratings (visitor_id, series_id, rating)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (series_id, visitor_id)
                 DO UPDATE SET rating = $3, updated_at = NOW()`,
                [visitorId, seriesId, validRating]
            );
            ratingSaved = true;
        }

        // Recalcular estadísticas SOLO si hubo cambio
        if (ratingSaved) {
            // Calcular nuevo promedio combinando ambas tablas
            // Esto es complejo en SQL directo, así que simplificamos:
            // Usamos una función triggers DB idealmente, pero aquí hacemos update directo

            /* 
               NOTA: Para simplificar, estamos asumiendo que series.rating_average y rating_count 
               se actualizan. Como tenemos dos fuentes (usuarios y visitors), deberíamos sumarlas.
               
               Query combinada:
            */
            await query(`
                WITH user_stats AS (
                    SELECT COUNT(*) as c, COALESCE(SUM(score), 0) as s 
                    FROM ratings WHERE series_id = $1
                ),
                visitor_stats AS (
                    SELECT COUNT(*) as c, COALESCE(SUM(rating * 2), 0) as s 
                    FROM series_ratings WHERE series_id = $1
                )
                UPDATE series 
                SET 
                    rating_count = (SELECT c FROM user_stats) + (SELECT c FROM visitor_stats),
                    rating_average = 
                        CASE 
                            WHEN ((SELECT c FROM user_stats) + (SELECT c FROM visitor_stats)) > 0 
                            THEN CAST(
                                ((SELECT s FROM user_stats) + (SELECT s FROM visitor_stats))::float / 
                                ((SELECT c FROM user_stats) + (SELECT c FROM visitor_stats)) 
                            AS DECIMAL(4,2))
                            ELSE 0
                        END
                WHERE id = $1
            `, [seriesId]);
        }

        // Obtener datos actualizados
        const update = await query(
            'SELECT rating_average, rating_count FROM series WHERE id = $1',
            [seriesId]
        );

        res.json({
            success: true,
            message: 'Calificación guardada',
            rating: update.rows[0].rating_average,
            ratingCount: update.rows[0].rating_count
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener calificación del usuario actual (o visitor)
 */
const getUserRating = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { visitorId } = req.query;

        const seriesResult = await query(
            'SELECT id FROM series WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Series not found' });
        }
        const seriesId = seriesResult.rows[0].id;

        let rating = null;

        if (req.user) {
            const result = await query(
                'SELECT score FROM ratings WHERE user_id = $1 AND series_id = $2',
                [req.user.id, seriesId]
            );
            if (result.rows.length > 0) rating = result.rows[0].score;
        } else if (visitorId) {
            const result = await query(
                'SELECT rating FROM series_ratings WHERE visitor_id = $1 AND series_id = $2',
                [visitorId, seriesId]
            );
            if (result.rows.length > 0) rating = result.rows[0].rating * 2; // Normalizar a 1-10
        }

        res.json({
            success: true,
            rating: rating
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener rating público de una serie (promedio + total votos)
 * GET /api/series/:slug/rating
 */
const getSeriesRating = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const result = await query(
            'SELECT rating_average, rating_count FROM series WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Series not found' });
        }

        const row = result.rows[0];
        res.json({
            success: true,
            data: {
                rating: row.rating_average ? parseFloat(row.rating_average) : null,
                ratingCount: parseInt(row.rating_count, 10) || 0
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Crear serie
 * POST /api/series
 */
const createSeries = async (req, res, next) => {
    try {
        const {
            title, originalTitle, synopsis, description,
            contentType, status, coverUrl, bannerUrl,
            authorId, artistId, genres, releaseYear, isAdult
        } = req.body;

        // Generar slug único
        let slug = slugify(title, { lower: true, strict: true });
        const existingSlug = await query(
            'SELECT id FROM series WHERE slug = $1',
            [slug]
        );

        if (existingSlug.rows.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        const result = await transaction(async (client) => {
            // Crear serie
            const seriesResult = await client.query(
                `INSERT INTO series (title, original_title, slug, synopsis, description,
                                    content_type, status, cover_url, banner_url,
                                    author_id, artist_id, release_year, is_adult)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 RETURNING *`,
                [title, originalTitle, slug, synopsis, description,
                    contentType || 'manhwa', status || 'ongoing', coverUrl, bannerUrl,
                    authorId, artistId, releaseYear, isAdult || false]
            );

            const series = seriesResult.rows[0];

            // Agregar géneros
            if (genres && genres.length > 0) {
                for (const genreId of genres) {
                    await client.query(
                        'INSERT INTO series_genres (series_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [series.id, genreId]
                    );
                }
            }

            return series;
        });

        res.status(201).json({
            success: true,
            message: 'Serie creada',
            data: {
                series: {
                    id: result.id,
                    title: result.title,
                    slug: result.slug
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar serie
 * PATCH /api/series/:slug
 * 
 * NOTAS IMPORTANTES:
 * - El slug es INMUTABLE - no se puede cambiar
 * - Si la serie no existe en DB pero está en Spaces, se crea automáticamente
 * - Solo se actualizan los campos permitidos y que tengan valor
 * - Los géneros se manejan por nombre, no por ID
 */
const updateSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const updates = req.body;

        logger.info(`📝 Actualizando serie: ${slug}`);
        logger.debug('   Datos recibidos:', JSON.stringify(updates, null, 2));

        // IMPORTANTE: Ignorar cualquier intento de cambiar el slug
        if (updates.slug) {
            logger.warn(`⚠️ Intento de cambiar slug ignorado: ${updates.slug}`);
            delete updates.slug;
        }

        // Obtener serie actual
        let seriesResult = await query(
            'SELECT id, slug, title, cover_url FROM series WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );

        let seriesId;
        let isNewSeries = false;

        // Si la serie no existe en la DB, crearla (puede venir de Spaces)
        if (seriesResult.rows.length === 0) {
            isNewSeries = true;
            // Convertir slug a título si no se proporciona
            const title = updates.title || slug.split('-').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');

            const insertResult = await query(
                `INSERT INTO series (title, slug, status, content_type, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, NOW(), NOW()) 
                 RETURNING id, title, slug, cover_url`,
                [title, slug, updates.status || 'ongoing', updates.contentType || 'manhwa']
            );
            seriesId = insertResult.rows[0].id;
            logger.info(`📝 Serie creada en DB desde Spaces: ${slug} (ID: ${seriesId})`);
        } else {
            seriesId = seriesResult.rows[0].id;
            logger.debug(`   Serie encontrada: ID ${seriesId}`);
        }

        // Si hay una imagen subida (desde middleware uploadToSpaces), usar esa URL
        if (req.fileUrl) {
            updates.coverUrl = req.fileUrl;
            logger.debug(`   Cover URL desde middleware: ${req.fileUrl}`);
        }

        // Manejar autor - la tabla usa author_id, no author directamente
        let authorId = null;
        if (updates.author && typeof updates.author === 'string' && updates.author.trim()) {
            const authorName = updates.author.trim();
            const authorSlug = authorName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            try {
                const authorResult = await query(
                    `INSERT INTO authors (name, slug) VALUES ($1, $2) 
                     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name 
                     RETURNING id`,
                    [authorName, authorSlug]
                );
                authorId = authorResult.rows[0].id;
                logger.debug(`   Autor procesado: ${authorName} (ID: ${authorId})`);
            } catch (authorError) {
                logger.warn(`⚠️ Error procesando autor "${authorName}":`, authorError.message);
            }
            // Eliminar author del objeto updates, ya lo manejamos aparte
            delete updates.author;
        }

        // Construir query de actualización
        // NOTA: NO incluir 'slug' ni 'author' en campos permitidos
        // author se maneja mediante author_id
        const allowedFields = [
            'title', 'original_title', 'synopsis', 'description',
            'status', 'cover_url', 'banner_url',
            'release_year', 'is_adult', 'is_featured', 'is_hot', 'type', 'content_type'
        ];

        const updateFields = [];
        const values = [];
        let paramCount = 0;

        // Si tenemos un authorId, agregarlo a los campos
        if (authorId) {
            paramCount++;
            updateFields.push(`author_id = $${paramCount}`);
            values.push(authorId);
        }

        for (const [key, value] of Object.entries(updates)) {
            // Ignorar campos especiales que no van en la tabla series directamente
            if (key === 'genres' || key === 'slug' || key === 'author' || key === 'artist') continue;

            // Convertir camelCase a snake_case
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

            if (allowedFields.includes(snakeKey) && value !== undefined && value !== null) {
                // Permitir strings vacíos para limpiar campos
                paramCount++;
                updateFields.push(`${snakeKey} = $${paramCount}`);
                values.push(value === '' ? null : value);
                logger.debug(`   Campo a actualizar: ${snakeKey} = ${value}`);
            }
        }

        // Solo actualizar si hay campos para cambiar
        if (updateFields.length > 0) {
            paramCount++;
            values.push(seriesId);

            const updateQuery = `UPDATE series SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
            logger.debug(`   Query: ${updateQuery}`);

            await query(updateQuery, values);
            logger.info(`✅ Campos actualizados: ${updateFields.length}`);
        }

        // Actualizar géneros si se proporcionan
        if (updates.genres && Array.isArray(updates.genres)) {
            logger.debug(`   Actualizando géneros: ${updates.genres.join(', ')}`);

            // Eliminar géneros existentes
            await query('DELETE FROM series_genres WHERE series_id = $1', [seriesId]);

            // Agregar nuevos géneros
            for (const genreName of updates.genres) {
                if (genreName && typeof genreName === 'string' && genreName.trim()) {
                    const trimmedName = genreName.trim();
                    const genreSlug = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

                    try {
                        // Buscar o crear el género (ON CONFLICT maneja duplicados)
                        const genreResult = await query(
                            `INSERT INTO genres (name, slug) VALUES ($1, $2) 
                             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name 
                             RETURNING id`,
                            [trimmedName, genreSlug]
                        );
                        const genreId = genreResult.rows[0].id;

                        // Asociar género a la serie
                        await query(
                            'INSERT INTO series_genres (series_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [seriesId, genreId]
                        );
                    } catch (genreError) {
                        logger.warn(`⚠️ Error procesando género "${trimmedName}":`, genreError.message);
                        // Continuar con los demás géneros
                    }
                }
            }

            logger.info(`✅ Géneros actualizados: ${updates.genres.length}`);
        }

        // Obtener la serie actualizada para retornarla (con autor y géneros)
        const updatedSeriesResult = await query(
            `SELECT s.*, 
                    a.name as author_name,
                    COALESCE(
                        (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'slug', g.slug))
                         FROM series_genres sg JOIN genres g ON sg.genre_id = g.id
                         WHERE sg.series_id = s.id),
                        '[]'
                    ) as genres
             FROM series s 
             LEFT JOIN authors a ON s.author_id = a.id
             WHERE s.id = $1`,
            [seriesId]
        );

        const updatedSeries = updatedSeriesResult.rows[0];

        res.json({
            success: true,
            message: isNewSeries ? 'Serie creada y actualizada correctamente' : 'Serie actualizada correctamente',
            data: {
                id: updatedSeries.id,
                title: updatedSeries.title,
                originalTitle: updatedSeries.original_title,
                slug: updatedSeries.slug,
                synopsis: updatedSeries.synopsis,
                coverUrl: updatedSeries.cover_url,
                status: updatedSeries.status,
                contentType: updatedSeries.content_type,
                releaseYear: updatedSeries.release_year,
                author: updatedSeries.author_name || null,
                genres: updatedSeries.genres,
                isAdult: updatedSeries.is_adult,
                isHot: updatedSeries.is_hot,
                isFeatured: updatedSeries.is_featured
            }
        });

        logger.info(`✅ Serie "${slug}" actualizada exitosamente`);

    } catch (error) {
        logger.error('❌ Error al actualizar serie:', error);
        logger.error('   Código de error:', error.code);
        logger.error('   Detalle:', error.detail);
        logger.error('   Constraint:', error.constraint);
        next(error);
    }
};

/**
 * Eliminar serie (soft delete)
 * DELETE /api/series/:slug
 */
const deleteSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const result = await query(
            'UPDATE series SET deleted_at = NOW() WHERE slug = $1 AND deleted_at IS NULL RETURNING id',
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Serie eliminada'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar solo la imagen de portada de una serie
 * POST /api/series/:slug/cover
 * 
 * NOTAS:
 * - El middleware uploadToSpaces ya convierte la imagen a WebP (calidad 85%)
 * - Si la serie no existe en DB pero existe en Spaces, la creamos
 * - Siempre retorna la URL completa de DigitalOcean Spaces
 */
const updateSeriesCover = async (req, res, next) => {
    try {
        const { slug } = req.params;

        // Validar que se haya subido una imagen
        if (!req.fileUrl) {
            logger.warn(`⚠️ Intento de actualizar portada sin imagen: ${slug}`);
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó ninguna imagen'
            });
        }

        // La URL ya viene completa del middleware uploadToSpaces
        const coverUrl = req.fileUrl;

        logger.info(`📸 Actualizando portada de "${slug}"`);
        logger.debug(`   URL recibida: ${coverUrl}`);
        logger.debug(`   Key: ${req.fileKey}`);

        // Intentar actualizar la serie existente
        let result = await query(
            'UPDATE series SET cover_url = $1, updated_at = NOW() WHERE slug = $2 AND deleted_at IS NULL RETURNING id, title, cover_url, slug',
            [coverUrl, slug]
        );

        // Si la serie no existe en DB (puede venir de Spaces), crearla
        if (result.rows.length === 0) {
            logger.info(`📝 Serie "${slug}" no existe en DB, creándola...`);

            // Convertir slug a título legible
            const title = slug.split('-').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');

            result = await query(
                `INSERT INTO series (title, slug, cover_url, status, content_type, created_at, updated_at) 
                 VALUES ($1, $2, $3, 'ongoing', 'manhwa', NOW(), NOW()) 
                 RETURNING id, title, cover_url, slug`,
                [title, slug, coverUrl]
            );

            logger.info(`✅ Serie creada en DB: ${title} (ID: ${result.rows[0].id})`);
        }

        const updatedSeries = result.rows[0];

        logger.info(`✅ Portada actualizada para "${updatedSeries.title}" (ID: ${updatedSeries.id})`);
        logger.debug(`   Cover URL guardada en DB: ${updatedSeries.cover_url}`);

        // Respuesta con estructura consistente
        res.json({
            success: true,
            message: 'Portada actualizada correctamente',
            coverUrl: updatedSeries.cover_url, // URL completa
            data: {
                id: updatedSeries.id,
                slug: updatedSeries.slug,
                title: updatedSeries.title,
                coverUrl: updatedSeries.cover_url // URL completa en data también
            }
        });
    } catch (error) {
        logger.error('❌ Error al actualizar portada:', error);
        logger.error('   Detalles:', {
            code: error.code,
            detail: error.detail,
            constraint: error.constraint
        });
        next(error);
    }
};

/**
 * Destacar serie
 * POST /api/series/:slug/feature
 */
const featureSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;

        await query(
            'UPDATE series SET is_featured = true WHERE slug = $1',
            [slug]
        );

        res.json({
            success: true,
            message: 'Serie destacada'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Quitar de destacados
 * DELETE /api/series/:slug/feature
 */
const unfeatureSeries = async (req, res, next) => {
    try {
        const { slug } = req.params;

        await query(
            'UPDATE series SET is_featured = false WHERE slug = $1',
            [slug]
        );

        res.json({
            success: true,
            message: 'Serie quitada de destacados'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener todos los estados disponibles
 * GET /api/series/statuses
 */
const getSeriesStatuses = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT DISTINCT status 
             FROM series 
             WHERE deleted_at IS NULL AND status IS NOT NULL
             ORDER BY status ASC`
        );

        res.json({
            success: true,
            data: {
                statuses: result.rows.map(row => row.status)
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listSeries,
    getSeriesDetail,
    getSeriesChapters,
    getFeaturedSeries,
    getPopularSeries,
    getLatestSeries,
    getTrendingSeries,
    getNewReleases,
    getSeriesComments,
    getRelatedSeries,
    likeSeries,
    unlikeSeries,
    bookmarkSeries,
    unbookmarkSeries,
    rateSeries,
    createSeries,
    updateSeries,
    updateSeriesCover,
    deleteSeries,
    featureSeries,
    unfeatureSeries,
    getSeriesStatuses,
    getUserRating,
    getSeriesRating
};
