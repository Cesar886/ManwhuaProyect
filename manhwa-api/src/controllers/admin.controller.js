/**
 * Controlador de Administración
 */

const { query, transaction } = require('../config/database');

/**
 * Obtener dashboard
 * GET /api/admin/dashboard
 */
const getDashboard = async (req, res, next) => {
    try {
        // Estadísticas generales
        const statsResult = await query(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_users,
                (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week,
                (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_today,
                (SELECT COUNT(*) FROM series WHERE deleted_at IS NULL) as total_series,
                (SELECT COUNT(*) FROM chapters) as total_chapters,
                (SELECT COUNT(*) FROM comments WHERE status = 'visible') as total_comments,
                (SELECT COUNT(*) FROM bookmarks) as total_bookmarks,
                (SELECT SUM(view_count) FROM series) as total_views,
                (SELECT SUM(daily_views) FROM series) as today_views,
                (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
                (SELECT COUNT(*) FROM requests WHERE status = 'pending') as pending_requests
        `);
        
        const stats = statsResult.rows[0];
        
        // Usuarios registrados por día (últimos 7 días)
        const userTrendResult = await query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM users
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);
        
        // Series más vistas hoy
        const topSeriesTodayResult = await query(`
            SELECT id, title, slug, cover_url, daily_views
            FROM series
            WHERE deleted_at IS NULL
            ORDER BY daily_views DESC
            LIMIT 5
        `);
        
        // Últimas actividades
        const recentActivityResult = await query(`
            SELECT a.*, u.username, u.avatar_url
            FROM activities a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            data: {
                stats: {
                    users: {
                        total: parseInt(stats.total_users),
                        newThisWeek: parseInt(stats.new_users_week),
                        newToday: parseInt(stats.new_users_today)
                    },
                    content: {
                        series: parseInt(stats.total_series),
                        chapters: parseInt(stats.total_chapters),
                        comments: parseInt(stats.total_comments),
                        bookmarks: parseInt(stats.total_bookmarks)
                    },
                    views: {
                        total: parseInt(stats.total_views) || 0,
                        today: parseInt(stats.today_views) || 0
                    },
                    pending: {
                        reports: parseInt(stats.pending_reports),
                        requests: parseInt(stats.pending_requests)
                    }
                },
                charts: {
                    userTrend: userTrendResult.rows
                },
                topSeriesToday: topSeriesTodayResult.rows.map(s => ({
                    id: s.id,
                    title: s.title,
                    slug: s.slug,
                    coverUrl: s.cover_url,
                    views: s.daily_views
                })),
                recentActivity: recentActivityResult.rows.map(a => ({
                    id: a.id,
                    action: a.action,
                    targetType: a.target_type,
                    targetId: a.target_id,
                    metadata: a.metadata,
                    user: {
                        username: a.username,
                        avatarUrl: a.avatar_url
                    },
                    createdAt: a.created_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener estadísticas detalladas
 * GET /api/admin/stats
 */
const getStats = async (req, res, next) => {
    try {
        const { period = '7d' } = req.query;
        
        let interval;
        switch (period) {
            case '24h': interval = '24 hours'; break;
            case '7d': interval = '7 days'; break;
            case '30d': interval = '30 days'; break;
            case '90d': interval = '90 days'; break;
            default: interval = '7 days';
        }
        
        // Registros por día
        const registrationsResult = await query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM users
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);
        
        // Vistas por día
        const viewsResult = await query(`
            SELECT DATE(viewed_at) as date, COUNT(*) as count
            FROM series_views
            WHERE viewed_at > NOW() - INTERVAL '${interval}'
            GROUP BY DATE(viewed_at)
            ORDER BY date ASC
        `);
        
        // Comentarios por día
        const commentsResult = await query(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM comments
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);
        
        // Distribución por roles
        const rolesResult = await query(`
            SELECT role, COUNT(*) as count
            FROM users
            WHERE deleted_at IS NULL
            GROUP BY role
        `);
        
        // Géneros más populares
        const genresResult = await query(`
            SELECT g.name, g.slug, COUNT(sg.series_id) as series_count
            FROM genres g
            LEFT JOIN series_genres sg ON g.id = sg.genre_id
            GROUP BY g.id
            ORDER BY series_count DESC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            data: {
                period,
                charts: {
                    registrations: registrationsResult.rows,
                    views: viewsResult.rows,
                    comments: commentsResult.rows
                },
                distributions: {
                    roles: rolesResult.rows,
                    genres: genresResult.rows
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar usuarios (admin)
 * GET /api/admin/users
 */
const getUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const { role, status, search, sort = 'created_at', order = 'desc' } = req.query;
        
        let whereClause = 'WHERE deleted_at IS NULL';
        const params = [];
        let paramCount = 0;
        
        if (role) {
            paramCount++;
            whereClause += ` AND role = $${paramCount}`;
            params.push(role);
        }
        
        if (status) {
            paramCount++;
            whereClause += ` AND status = $${paramCount}`;
            params.push(status);
        }
        
        if (search) {
            paramCount++;
            whereClause += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount} OR display_name ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        
        const validSorts = ['created_at', 'username', 'email', 'last_login_at', 'login_count'];
        const sortField = validSorts.includes(sort) ? sort : 'created_at';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
        
        const result = await query(
            `SELECT id, username, email, display_name, avatar_url, role, status,
                    is_premium, email_verified_at, last_login_at, login_count, created_at
             FROM users
             ${whereClause}
             ORDER BY ${sortField} ${sortOrder}
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM users ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                users: result.rows.map(u => ({
                    id: u.id,
                    username: u.username,
                    email: u.email,
                    displayName: u.display_name,
                    avatarUrl: u.avatar_url,
                    role: u.role,
                    status: u.status,
                    isPremium: u.is_premium,
                    isVerified: !!u.email_verified_at,
                    lastLoginAt: u.last_login_at,
                    loginCount: u.login_count,
                    createdAt: u.created_at
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
 * Obtener detalle de usuario (admin)
 * GET /api/admin/users/:id
 */
const getUserDetail = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `SELECT u.*,
                    (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as comments_count,
                    (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id) as bookmarks_count,
                    (SELECT COUNT(*) FROM reports WHERE reporter_id = u.id) as reports_made,
                    (SELECT COUNT(*) FROM reports WHERE reported_type = 'user' AND reported_id = u.id::text) as reports_received
             FROM users u
             WHERE u.id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        const user = result.rows[0];
        
        // Actividad reciente
        const activityResult = await query(
            `SELECT * FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
            [id]
        );
        
        // Audit logs relacionados
        const auditResult = await query(
            `SELECT * FROM audit_logs WHERE user_id = $1 OR (entity_type = 'user' AND entity_id = $1)
             ORDER BY created_at DESC LIMIT 20`,
            [id]
        );
        
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    bannerUrl: user.banner_url,
                    bio: user.bio,
                    role: user.role,
                    status: user.status,
                    isPremium: user.is_premium,
                    premiumUntil: user.premium_until,
                    isVerified: !!user.email_verified_at,
                    lastLoginAt: user.last_login_at,
                    lastLoginIp: user.last_login_ip,
                    loginCount: user.login_count,
                    createdAt: user.created_at,
                    stats: {
                        comments: parseInt(user.comments_count),
                        bookmarks: parseInt(user.bookmarks_count),
                        reportsMade: parseInt(user.reports_made),
                        reportsReceived: parseInt(user.reports_received)
                    }
                },
                recentActivity: activityResult.rows,
                auditLogs: auditResult.rows
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener reportes
 * GET /api/admin/reports
 */
const getReports = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const { status = 'pending', type } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 0;
        
        if (status) {
            paramCount++;
            whereClause += ` AND r.status = $${paramCount}`;
            params.push(status);
        }
        
        if (type) {
            paramCount++;
            whereClause += ` AND r.report_type = $${paramCount}`;
            params.push(type);
        }
        
        const result = await query(
            `SELECT r.*, 
                    reporter.username as reporter_username, reporter.avatar_url as reporter_avatar,
                    resolver.username as resolver_username
             FROM reports r
             LEFT JOIN users reporter ON r.reporter_id = reporter.id
             LEFT JOIN users resolver ON r.resolved_by = resolver.id
             ${whereClause}
             ORDER BY r.created_at DESC
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM reports r ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                reports: result.rows.map(r => ({
                    id: r.id,
                    reportedType: r.reported_type,
                    reportedId: r.reported_id,
                    reportType: r.report_type,
                    description: r.description,
                    status: r.status,
                    reporter: r.reporter_id ? {
                        id: r.reporter_id,
                        username: r.reporter_username,
                        avatarUrl: r.reporter_avatar
                    } : null,
                    resolvedBy: r.resolved_by ? {
                        id: r.resolved_by,
                        username: r.resolver_username
                    } : null,
                    resolvedAt: r.resolved_at,
                    resolutionNotes: r.resolution_notes,
                    createdAt: r.created_at
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
 * Actualizar reporte
 * PUT /api/admin/reports/:id
 */
const updateReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, resolutionNotes } = req.body;
        
        const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido'
            });
        }
        
        await query(
            `UPDATE reports 
             SET status = COALESCE($1, status),
                 resolution_notes = COALESCE($2, resolution_notes),
                 resolved_by = $3,
                 resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END
             WHERE id = $4`,
            [status, resolutionNotes, req.user.id, id]
        );
        
        res.json({
            success: true,
            message: 'Reporte actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener audit logs
 * GET /api/admin/audit-logs
 */
const getAuditLogs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;
        const { userId, action, entityType } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 0;
        
        if (userId) {
            paramCount++;
            whereClause += ` AND al.user_id = $${paramCount}`;
            params.push(userId);
        }
        
        if (action) {
            paramCount++;
            whereClause += ` AND al.action = $${paramCount}`;
            params.push(action);
        }
        
        if (entityType) {
            paramCount++;
            whereClause += ` AND al.entity_type = $${paramCount}`;
            params.push(entityType);
        }
        
        const result = await query(
            `SELECT al.*, u.username, u.avatar_url
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             ${whereClause}
             ORDER BY al.created_at DESC
             LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: {
                logs: result.rows.map(l => ({
                    id: l.id,
                    action: l.action,
                    entityType: l.entity_type,
                    entityId: l.entity_id,
                    oldValues: l.old_values,
                    newValues: l.new_values,
                    metadata: l.metadata,
                    ipAddress: l.ip_address,
                    user: l.user_id ? {
                        id: l.user_id,
                        username: l.username,
                        avatarUrl: l.avatar_url
                    } : null,
                    createdAt: l.created_at
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
 * Obtener anuncios
 * GET /api/admin/announcements
 */
const getAnnouncements = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT a.*, u.username as created_by_username
             FROM announcements a
             LEFT JOIN users u ON a.created_by = u.id
             ORDER BY a.priority DESC, a.created_at DESC`
        );
        
        res.json({
            success: true,
            data: {
                announcements: result.rows.map(a => ({
                    id: a.id,
                    title: a.title,
                    content: a.content,
                    type: a.type,
                    imageUrl: a.image_url,
                    linkUrl: a.link_url,
                    isActive: a.is_active,
                    showOnHome: a.show_on_home,
                    showAsPopup: a.show_as_popup,
                    startsAt: a.starts_at,
                    endsAt: a.ends_at,
                    priority: a.priority,
                    createdBy: a.created_by_username,
                    createdAt: a.created_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Crear anuncio
 * POST /api/admin/announcements
 */
const createAnnouncement = async (req, res, next) => {
    try {
        const { title, content, type, imageUrl, linkUrl, isActive, showOnHome, showAsPopup, startsAt, endsAt, priority } = req.body;
        
        const result = await query(
            `INSERT INTO announcements (title, content, type, image_url, link_url, is_active, show_on_home, show_as_popup, starts_at, ends_at, priority, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [title, content, type || 'info', imageUrl, linkUrl, isActive !== false, showOnHome !== false, showAsPopup || false, startsAt, endsAt, priority || 0, req.user.id]
        );
        
        res.status(201).json({
            success: true,
            message: 'Anuncio creado',
            data: { announcement: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar anuncio
 * PUT /api/admin/announcements/:id
 */
const updateAnnouncement = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, content, type, imageUrl, linkUrl, isActive, showOnHome, showAsPopup, startsAt, endsAt, priority } = req.body;
        
        await query(
            `UPDATE announcements 
             SET title = COALESCE($1, title),
                 content = COALESCE($2, content),
                 type = COALESCE($3, type),
                 image_url = $4,
                 link_url = $5,
                 is_active = COALESCE($6, is_active),
                 show_on_home = COALESCE($7, show_on_home),
                 show_as_popup = COALESCE($8, show_as_popup),
                 starts_at = $9,
                 ends_at = $10,
                 priority = COALESCE($11, priority),
                 updated_at = NOW()
             WHERE id = $12`,
            [title, content, type, imageUrl, linkUrl, isActive, showOnHome, showAsPopup, startsAt, endsAt, priority, id]
        );
        
        res.json({
            success: true,
            message: 'Anuncio actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar anuncio
 * DELETE /api/admin/announcements/:id
 */
const deleteAnnouncement = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await query('DELETE FROM announcements WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Anuncio eliminado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener configuración del sitio
 * GET /api/admin/settings
 */
const getSettings = async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM site_settings ORDER BY key');
        
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        
        res.json({
            success: true,
            data: { settings }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar configuración del sitio
 * PUT /api/admin/settings
 */
const updateSettings = async (req, res, next) => {
    try {
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Settings debe ser un objeto'
            });
        }
        
        await transaction(async (client) => {
            for (const [key, value] of Object.entries(settings)) {
                await client.query(
                    `INSERT INTO site_settings (key, value, updated_by, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
                    [key, JSON.stringify(value), req.user.id]
                );
            }
        });
        
        // Registrar en audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, new_values, ip_address)
             VALUES ($1, 'update_settings', 'site_settings', $2, $3)`,
            [req.user.id, JSON.stringify(settings), req.ip]
        );
        
        res.json({
            success: true,
            message: 'Configuración actualizada'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Limpiar caché (placeholder)
 * POST /api/admin/maintenance/clear-cache
 */
const clearCache = async (req, res, next) => {
    try {
        // Aquí iría la lógica de limpiar caché (Redis, etc.)
        
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, ip_address)
             VALUES ($1, 'clear_cache', 'system', $2)`,
            [req.user.id, req.ip]
        );
        
        res.json({
            success: true,
            message: 'Caché limpiado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Resetear vistas diarias
 * POST /api/admin/maintenance/reset-views
 */
const resetDailyViews = async (req, res, next) => {
    try {
        await query('UPDATE series SET daily_views = 0');
        
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, ip_address)
             VALUES ($1, 'reset_daily_views', 'system', $2)`,
            [req.user.id, req.ip]
        );
        
        res.json({
            success: true,
            message: 'Vistas diarias reseteadas'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Recalcular estadísticas
 * POST /api/admin/maintenance/recalculate-stats
 */
const recalculateStats = async (req, res, next) => {
    try {
        await transaction(async (client) => {
            // Recalcular contadores de series
            await client.query(`
                UPDATE series s SET
                    chapter_count = (SELECT COUNT(*) FROM chapters WHERE series_id = s.id AND is_published = true),
                    bookmark_count = (SELECT COUNT(*) FROM bookmarks WHERE series_id = s.id),
                    likes_count = (SELECT COUNT(*) FROM series_likes WHERE series_id = s.id),
                    comment_count = (SELECT COUNT(*) FROM comments WHERE target_type = 'series' AND target_id = s.id AND status = 'visible'),
                    rating_count = (
                        (SELECT COUNT(*) FROM ratings WHERE series_id = s.id) +
                        (SELECT COUNT(*) FROM series_ratings WHERE series_id = s.id)
                    ),
                    rating_average = CASE
                        WHEN (
                            (SELECT COUNT(*) FROM ratings WHERE series_id = s.id) +
                            (SELECT COUNT(*) FROM series_ratings WHERE series_id = s.id)
                        ) > 0 THEN CAST(
                            (
                                COALESCE((SELECT SUM(score) FROM ratings WHERE series_id = s.id), 0) +
                                COALESCE((SELECT SUM(rating * 2) FROM series_ratings WHERE series_id = s.id), 0)
                            )::float /
                            (
                                (SELECT COUNT(*) FROM ratings WHERE series_id = s.id) +
                                (SELECT COUNT(*) FROM series_ratings WHERE series_id = s.id)
                            )
                        AS DECIMAL(4,2))
                        ELSE 0
                    END
            `);
            
            // Recalcular contadores de usuarios
            await client.query(`
                UPDATE users u SET
                    followers_count = (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id),
                    following_count = (SELECT COUNT(*) FROM user_follows WHERE follower_id = u.id),
                    collections_count = (SELECT COUNT(*) FROM collections WHERE creator_id = u.id AND deleted_at IS NULL)
            `);
            
            // Recalcular contadores de colecciones
            await client.query(`
                UPDATE collections c SET
                    manhwas_count = (SELECT COUNT(*) FROM collection_items WHERE collection_id = c.id),
                    followers_count = (SELECT COUNT(*) FROM collection_follows WHERE collection_id = c.id),
                    likes_count = (SELECT COUNT(*) FROM collection_likes WHERE collection_id = c.id)
            `);
            
            // Recalcular contadores de comentarios
            await client.query(`
                UPDATE comments c SET
                    replies_count = (SELECT COUNT(*) FROM comments WHERE parent_id = c.id AND status = 'visible'),
                    likes_count = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = 1),
                    dislikes_count = (SELECT COUNT(*) FROM comment_votes WHERE comment_id = c.id AND vote_type = -1)
            `);
            
            // Recalcular votos de requests
            await client.query(`
                UPDATE requests r SET
                    votes_count = (SELECT COUNT(*) FROM request_votes WHERE request_id = r.id)
            `);
        });
        
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, ip_address)
             VALUES ($1, 'recalculate_stats', 'system', $2)`,
            [req.user.id, req.ip]
        );
        
        res.json({
            success: true,
            message: 'Estadísticas recalculadas'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboard,
    getStats,
    getUsers,
    getUserDetail,
    getReports,
    updateReport,
    getAuditLogs,
    getAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    getSettings,
    updateSettings,
    clearCache,
    resetDailyViews,
    recalculateStats
};
