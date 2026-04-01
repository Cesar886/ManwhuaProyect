/**
 * Controlador de Usuarios
 */

const { query, transaction } = require('../config/database');
const { canModifyUser, getAssignableRoles } = require('../config/roles');
const usernameValidator = require('../utils/usernameValidator');
const { getLevelInfo, getXpConfig, LEVEL_CONFIG } = require('../utils/xpSystem');

/**
 * Obtener perfil de usuario
 * GET /api/users/:username
 */
const getProfile = async (req, res, next) => {
    try {
        const { username } = req.params;

        const result = await query(
            `SELECT u.id, u.username, u.display_name, u.avatar_url, u.banner_url,
                    u.bio, u.location, u.website, u.role, u.is_premium,
                    u.level, u.experience, u.followers_count, u.following_count,
                    u.collections_count, u.theme_primary_color, u.theme_accent_color,
                    u.created_at,
                    EXISTS(
                        SELECT 1 FROM user_follows 
                        WHERE follower_id = $2 AND following_id = u.id
                    ) as is_following
             FROM users u
             WHERE u.username = $1 AND u.deleted_at IS NULL AND u.status = 'active'`,
            [username.toLowerCase(), req.user?.id || null]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const user = result.rows[0];

        // Obtener estadísticas adicionales
        const statsResult = await query(
            `SELECT 
                (SELECT COUNT(*) FROM bookmarks WHERE user_id = $1) as bookmarks,
                (SELECT COUNT(*) FROM ratings WHERE user_id = $1) as ratings,
                (SELECT COUNT(*) FROM comments WHERE user_id = $1 AND status = 'visible') as comments
            `,
            [user.id]
        );

        const stats = statsResult.rows[0];

        // Obtener información de nivel y XP
        const currentXp = parseInt(user.experience) || 0;
        const levelInfo = getLevelInfo(currentXp);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    displayName: user.display_name,
                    avatarUrl: user.avatar_url,
                    bannerUrl: user.banner_url,
                    bio: user.bio,
                    location: user.location,
                    website: user.website,
                    role: user.role,
                    isPremium: user.is_premium,
                    level: user.level,
                    experience: currentXp,
                    levelInfo: {
                        name: levelInfo.name,
                        color: levelInfo.color,
                        progress: levelInfo.progress,
                        xpToNextLevel: levelInfo.xpToNextLevel
                    },
                    theme: {
                        primaryColor: user.theme_primary_color,
                        accentColor: user.theme_accent_color
                    },
                    stats: {
                        followers: user.followers_count,
                        following: user.following_count,
                        collections: user.collections_count,
                        bookmarks: parseInt(stats.bookmarks),
                        ratings: parseInt(stats.ratings),
                        comments: parseInt(stats.comments)
                    },
                    isFollowing: user.is_following,
                    joinedAt: user.created_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar disponibilidad de username
 * GET /api/users/check-username?username=...
 */
const checkUsername = async (req, res, next) => {
    try {
        const username = (req.query.username || '').toString().trim();
        if (!username) {
            return res.status(400).json({ success: false, message: 'username query required' });
        }

        const result = await query(
            'SELECT 1 FROM users WHERE username = $1 AND deleted_at IS NULL LIMIT 1',
            [username.toLowerCase()]
        );

        const available = result.rows.length === 0;

        res.json({ success: true, data: { available } });
    } catch (error) {
        next(error);
    }
};

/**
 * Validar username usando la lógica del servidor (normalize/forbidden/reserved)
 * GET /api/users/validate-username?username=...
 */
const validateUsername = async (req, res, next) => {
    try {
        const username = (req.query.username || '').toString().trim();
        if (!username) {
            return res.status(400).json({ success: false, message: 'username query required' });
        }

        const validation = usernameValidator.validateUsername(username);
        res.json({ success: true, data: validation });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar perfil
 * PUT /api/users/profile
 */
const updateProfile = async (req, res, next) => {
    try {
        const { displayName, bio, location, website, themePrimaryColor, themeAccentColor, colorScheme } = req.body;

        const result = await query(
            `UPDATE users 
             SET display_name = COALESCE($1, display_name),
                 bio = COALESCE($2, bio),
                 location = COALESCE($3, location),
                 website = COALESCE($4, website),
                 theme_primary_color = COALESCE($5, theme_primary_color),
                 theme_accent_color = COALESCE($6, theme_accent_color),
                 theme_mode = COALESCE($7, theme_mode),
                 updated_at = NOW()
             WHERE id = $8
             RETURNING id, username, display_name, bio, location, website,
                       theme_primary_color, theme_accent_color, theme_mode`,
            [displayName, bio, location, website, themePrimaryColor, themeAccentColor, colorScheme, req.user.id]
        );

        const user = result.rows[0];

        res.json({
            success: true,
            message: 'Perfil actualizado',
            data: {
                user: {
                    displayName: user.display_name,
                    bio: user.bio,
                    location: user.location,
                    website: user.website,
                    theme: {
                        primaryColor: user.theme_primary_color,
                        accentColor: user.theme_accent_color,
                        colorScheme: user.theme_mode
                    }
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar avatar
 * PUT /api/users/avatar
 */
const updateAvatar = async (req, res, next) => {
    try {
        const { avatarUrl } = req.body;

        await query(
            'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
            [avatarUrl, req.user.id]
        );

        res.json({
            success: true,
            message: 'Avatar actualizado',
            data: { avatarUrl }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar banner
 * PUT /api/users/banner
 */
const updateBanner = async (req, res, next) => {
    try {
        const { bannerUrl } = req.body;

        await query(
            'UPDATE users SET banner_url = $1, updated_at = NOW() WHERE id = $2',
            [bannerUrl, req.user.id]
        );

        res.json({
            success: true,
            message: 'Banner actualizado',
            data: { bannerUrl }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar preferencias
 * PUT /api/users/preferences
 */
const updatePreferences = async (req, res, next) => {
    try {
        const { preferences } = req.body;

        await query(
            'UPDATE users SET preferences = preferences || $1, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(preferences), req.user.id]
        );

        res.json({
            success: true,
            message: 'Preferencias actualizadas'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Seguir usuario
 * POST /api/users/:username/follow
 */
const followUser = async (req, res, next) => {
    try {
        const { username } = req.params;

        // Obtener ID del usuario a seguir
        const userResult = await query(
            'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const targetUserId = userResult.rows[0].id;

        if (targetUserId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'No puedes seguirte a ti mismo'
            });
        }

        // Crear follow
        await query(
            `INSERT INTO user_follows (follower_id, following_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [req.user.id, targetUserId]
        );

        // Crear notificación
        await query(
            `INSERT INTO notifications (user_id, type, title, message, data)
             VALUES ($1, 'new_follower', 'Nuevo seguidor', $2, $3)`,
            [
                targetUserId,
                `${req.user.username} te ha seguido`,
                JSON.stringify({ followerId: req.user.id, followerUsername: req.user.username })
            ]
        );

        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, target_type, target_id, metadata)
             VALUES ($1, 'follow', 'user', $2, $3)`,
            [req.user.id, targetUserId, JSON.stringify({ username })]
        );

        res.json({
            success: true,
            message: `Ahora sigues a ${username}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Dejar de seguir usuario
 * DELETE /api/users/:username/follow
 */
const unfollowUser = async (req, res, next) => {
    try {
        const { username } = req.params;

        const userResult = await query(
            'SELECT id FROM users WHERE username = $1',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const targetUserId = userResult.rows[0].id;

        await query(
            'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
            [req.user.id, targetUserId]
        );

        res.json({
            success: true,
            message: `Dejaste de seguir a ${username}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener seguidores de un usuario
 * GET /api/users/:username/followers
 */
const getUserFollowers = async (req, res, next) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        // Obtener usuario
        const userResult = await query(
            'SELECT id, followers_count FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const userId = userResult.rows[0].id;
        const total = userResult.rows[0].followers_count;

        // Obtener seguidores
        const result = await query(
            `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_premium
             FROM user_follows uf
             JOIN users u ON uf.follower_id = u.id
             WHERE uf.following_id = $1 AND u.deleted_at IS NULL
             ORDER BY uf.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({
            success: true,
            data: {
                followers: result.rows.map(u => ({
                    id: u.id,
                    username: u.username,
                    displayName: u.display_name,
                    avatarUrl: u.avatar_url,
                    bio: u.bio,
                    isPremium: u.is_premium
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
 * Obtener usuarios que sigue
 * GET /api/users/:username/following
 */
const getUserFollowing = async (req, res, next) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        const userResult = await query(
            'SELECT id, following_count FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const userId = userResult.rows[0].id;
        const total = userResult.rows[0].following_count;

        const result = await query(
            `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_premium
             FROM user_follows uf
             JOIN users u ON uf.following_id = u.id
             WHERE uf.follower_id = $1 AND u.deleted_at IS NULL
             ORDER BY uf.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({
            success: true,
            data: {
                following: result.rows.map(u => ({
                    id: u.id,
                    username: u.username,
                    displayName: u.display_name,
                    avatarUrl: u.avatar_url,
                    bio: u.bio,
                    isPremium: u.is_premium
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
 * Obtener colecciones de un usuario
 * GET /api/users/:username/collections
 */
const getUserCollections = async (req, res, next) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 12, 50);
        const offset = (page - 1) * limit;

        const userResult = await query(
            'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const userId = userResult.rows[0].id;

        const result = await query(
            `SELECT c.*, 
                    (SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'cover', s.cover_url))
                     FROM (SELECT s.* FROM collection_items ci 
                           JOIN series s ON ci.series_id = s.id 
                           WHERE ci.collection_id = c.id 
                           ORDER BY ci.order_index LIMIT 4) s
                    ) as preview_series
             FROM collections c
             WHERE c.creator_id = $1 AND c.deleted_at IS NULL AND c.is_public = true
             ORDER BY c.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countResult = await query(
            'SELECT COUNT(*) FROM collections WHERE creator_id = $1 AND deleted_at IS NULL AND is_public = true',
            [userId]
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
                    manhwasCount: c.manhwas_count,
                    followersCount: c.followers_count,
                    likesCount: c.likes_count,
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
 * Obtener actividad de un usuario
 * GET /api/users/:username/activity
 */
const getUserActivity = async (req, res, next) => {
    try {
        const { username } = req.params;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const userResult = await query(
            'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const userId = userResult.rows[0].id;

        const result = await query(
            `SELECT a.*, u.username, u.avatar_url
             FROM activities a
             JOIN users u ON a.user_id = u.id
             WHERE a.user_id = $1 AND a.is_public = true
             ORDER BY a.created_at DESC
             LIMIT $2`,
            [userId, limit]
        );

        res.json({
            success: true,
            data: {
                activities: result.rows.map(a => ({
                    id: a.id,
                    action: a.action,
                    targetType: a.target_type,
                    targetId: a.target_id,
                    metadata: a.metadata,
                    createdAt: a.created_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener historial de lectura
 * GET /api/users/me/history
 */
const getReadingHistory = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        const result = await query(
            `SELECT rh.*, 
                    s.title as series_title, s.slug as series_slug, s.cover_url,
                    c.number as chapter_number, c.title as chapter_title
             FROM reading_history rh
             JOIN series s ON rh.series_id = s.id
             JOIN chapters c ON rh.chapter_id = c.id
             WHERE rh.user_id = $1
             ORDER BY rh.read_at DESC
             LIMIT $2 OFFSET $3`,
            [req.user.id, limit, offset]
        );

        const countResult = await query(
            'SELECT COUNT(*) FROM reading_history WHERE user_id = $1',
            [req.user.id]
        );

        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                history: result.rows.map(h => ({
                    id: h.id,
                    series: {
                        id: h.series_id,
                        title: h.series_title,
                        slug: h.series_slug,
                        coverUrl: h.cover_url
                    },
                    chapter: {
                        id: h.chapter_id,
                        number: h.chapter_number,
                        title: h.chapter_title
                    },
                    lastPage: h.last_page,
                    isCompleted: h.is_completed,
                    readAt: h.read_at
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
 * Obtener bookmarks del usuario
 * GET /api/users/me/bookmarks
 */
const getBookmarks = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        const result = await query(
            `SELECT b.*, 
                    s.id, s.title, s.slug, s.cover_url, s.status, s.chapter_count,
                    s.rating_average, s.content_type,
                    c.number as last_read_number, c.title as last_read_title
             FROM bookmarks b
             JOIN series s ON b.series_id = s.id
             LEFT JOIN chapters c ON b.last_read_chapter_id = c.id
             WHERE b.user_id = $1 AND s.deleted_at IS NULL
             ORDER BY b.updated_at DESC
             LIMIT $2 OFFSET $3`,
            [req.user.id, limit, offset]
        );

        const countResult = await query(
            'SELECT COUNT(*) FROM bookmarks b JOIN series s ON b.series_id = s.id WHERE b.user_id = $1 AND s.deleted_at IS NULL',
            [req.user.id]
        );

        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                bookmarks: result.rows.map(b => ({
                    series: {
                        id: b.id,
                        title: b.title,
                        slug: b.slug,
                        coverUrl: b.cover_url,
                        status: b.status,
                        chapterCount: b.chapter_count,
                        rating: parseFloat(b.rating_average),
                        contentType: b.content_type
                    },
                    lastRead: b.last_read_chapter_id ? {
                        chapterId: b.last_read_chapter_id,
                        number: b.last_read_number,
                        title: b.last_read_title,
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
 * Limpiar historial de lectura
 * DELETE /api/users/me/history
 */
const clearHistory = async (req, res, next) => {
    try {
        await query(
            'DELETE FROM reading_history WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'Historial limpiado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Listar usuarios (Admin)
 * GET /api/users
 */
const listUsers = async (req, res, next) => {
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

        const validSorts = ['created_at', 'username', 'email', 'last_login_at'];
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
 * Actualizar rol de usuario (Admin)
 * PUT /api/users/:username/role
 */
const updateUserRole = async (req, res, next) => {
    try {
        const { username } = req.params;
        const { role } = req.body;

        // Verificar rol válido
        const assignableRoles = getAssignableRoles(req.user.role);
        if (!assignableRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'No puedes asignar este rol'
            });
        }

        // Obtener usuario target
        const userResult = await query(
            'SELECT id, role FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const targetUser = userResult.rows[0];

        // Verificar que puede modificar al usuario
        if (!canModifyUser(req.user.role, targetUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'No puedes modificar a un usuario de igual o mayor rango'
            });
        }

        // Actualizar rol
        await query(
            'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
            [role, targetUser.id]
        );

        // Registrar en audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
             VALUES ($1, 'update_role', 'user', $2, $3, $4, $5)`,
            [req.user.id, targetUser.id, JSON.stringify({ role: targetUser.role }), JSON.stringify({ role }), req.ip]
        );

        res.json({
            success: true,
            message: `Rol de ${username} actualizado a ${role}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar estado de usuario (Admin)
 * PUT /api/users/:username/status
 */
const updateUserStatus = async (req, res, next) => {
    try {
        const { username } = req.params;
        const { status, reason } = req.body;

        const validStatuses = ['active', 'suspended', 'banned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido'
            });
        }

        // Obtener usuario target
        const userResult = await query(
            'SELECT id, role, status FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const targetUser = userResult.rows[0];

        // Verificar que puede modificar al usuario
        if (!canModifyUser(req.user.role, targetUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'No puedes modificar a un usuario de igual o mayor rango'
            });
        }

        // Actualizar estado
        await query(
            'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, targetUser.id]
        );

        // Registrar en audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, metadata, ip_address)
             VALUES ($1, 'update_status', 'user', $2, $3, $4, $5, $6)`,
            [
                req.user.id,
                targetUser.id,
                JSON.stringify({ status: targetUser.status }),
                JSON.stringify({ status }),
                JSON.stringify({ reason }),
                req.ip
            ]
        );

        // Notificar al usuario
        if (status !== 'active') {
            await query(
                `INSERT INTO notifications (user_id, type, title, message)
                 VALUES ($1, 'account_status', 'Estado de cuenta actualizado', $2)`,
                [targetUser.id, `Tu cuenta ha sido ${status === 'suspended' ? 'suspendida' : 'baneada'}. ${reason || ''}`]
            );
        }

        res.json({
            success: true,
            message: `Estado de ${username} actualizado a ${status}`
        });
    } catch (error) {
        next(error);
    }
};



/**
 * Actualizar usuario parcialmente (PATCH)
 * PATCH /api/users/:id
 */
const updatePartialUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { theme_mode } = req.body;

        // Verificar autorización (mismo usuario o admin)
        if (req.user.id !== id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para modificar este usuario'
            });
        }

        // Construir query dinámica
        const updates = [];
        const values = [];
        let paramCount = 0;

        if (typeof theme_mode !== 'undefined') {
            paramCount++;
            updates.push(`theme_mode = $${paramCount}`);
            values.push(theme_mode);
        }

        if (updates.length === 0) {
            return res.json({ success: true, message: 'Nada que actualizar' });
        }

        values.push(id);
        const queryText = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount + 1} RETURNING theme_mode`;

        const result = await query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({
            success: true,
            message: 'Usuario actualizado',
            data: {
                user: {
                    theme: {
                        colorScheme: result.rows[0].theme_mode
                    }
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener calificaciones del usuario (series + capítulos)
 * GET /api/users/:username/ratings
 */
const getUserRatings = async (req, res, next) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        const userResult = await query(
            'SELECT id, visitor_id FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const userId = userResult.rows[0].id;
        const visitorId = userResult.rows[0].visitor_id;

        // 1. Obtener ratings de SERIES (tabla ratings)
        const seriesRatings = await query(
            `SELECT r.id, r.score, r.review, r.created_at, r.updated_at,
                    s.id as series_id, s.title as series_title, s.slug as series_slug, 
                    s.cover_url, 'series' as rating_type, NULL as chapter_number
             FROM ratings r
             JOIN series s ON r.series_id = s.id
             WHERE r.user_id = $1
             ORDER BY r.updated_at DESC`,
            [userId]
        );

        // 2. Obtener ratings de CAPÍTULOS (tabla chapter_votes) si tiene visitor_id
        let chapterRatings = { rows: [] };
        if (visitorId) {
            chapterRatings = await query(
                `SELECT cv.id, cv.rating * 2 as score, NULL as review, cv.created_at, cv.updated_at,
                        s.id as series_id, s.title as series_title, cv.series_slug as series_slug,
                        s.cover_url, 'chapter' as rating_type, cv.chapter_number
                 FROM chapter_votes cv
                 JOIN series s ON s.slug = cv.series_slug
                 WHERE cv.visitor_id = $1
                 ORDER BY cv.updated_at DESC`,
                [visitorId]
            );
        }

        // Combinar y ordenar por fecha
        const allRatings = [...seriesRatings.rows, ...chapterRatings.rows]
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .slice(offset, offset + limit);

        const total = seriesRatings.rows.length + chapterRatings.rows.length;

        res.json({
            success: true,
            data: {
                ratings: allRatings.map(r => ({
                    id: r.id,
                    score: r.score,
                    review: r.review,
                    ratingType: r.rating_type,
                    chapterNumber: r.chapter_number,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    series: {
                        id: r.series_id,
                        title: r.series_title,
                        slug: r.series_slug,
                        coverUrl: r.cover_url
                    }
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener comentarios del usuario
 * GET /api/users/:username/comments
 */
const getUserComments = async (req, res, next) => {
    try {
        const { username } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;

        const userResult = await query(
            'SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL',
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const userId = userResult.rows[0].id;

        // Obtener comentarios con información del contexto
        const result = await query(
            `SELECT c.id, c.content, c.target_type, c.target_id, c.rating,
                    c.is_spoiler, c.likes_count, c.dislikes_count, c.replies_count,
                    c.created_at, c.is_edited, c.edited_at,
                    CASE 
                        WHEN c.target_type = 'series' THEN s.title
                        WHEN c.target_type = 'chapter' THEN CONCAT(s2.title, ' - Cap. ', ch.number)
                        ELSE NULL
                    END as target_title,
                    CASE 
                        WHEN c.target_type = 'series' THEN s.slug
                        WHEN c.target_type = 'chapter' THEN s2.slug
                        ELSE NULL
                    END as series_slug,
                    CASE 
                        WHEN c.target_type = 'series' THEN s.cover_url
                        WHEN c.target_type = 'chapter' THEN s2.cover_url
                        ELSE NULL
                    END as cover_url,
                    ch.number as chapter_number
             FROM comments c
             LEFT JOIN series s ON c.target_type = 'series' AND c.target_id = s.id
             LEFT JOIN chapters ch ON c.target_type = 'chapter' AND c.target_id = ch.id
             LEFT JOIN series s2 ON ch.series_id = s2.id
             WHERE c.user_id = $1 AND c.status = 'visible'
             ORDER BY c.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        // Contar total
        const countResult = await query(
            "SELECT COUNT(*) FROM comments WHERE user_id = $1 AND status = 'visible'",
            [userId]
        );

        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                comments: result.rows.map(c => ({
                    id: c.id,
                    content: c.content,
                    targetType: c.target_type,
                    targetId: c.target_id,
                    targetTitle: c.target_title,
                    seriesSlug: c.series_slug,
                    coverUrl: c.cover_url,
                    chapterNumber: c.chapter_number,
                    rating: c.rating,
                    isSpoiler: c.is_spoiler,
                    likesCount: c.likes_count,
                    dislikesCount: c.dislikes_count,
                    repliesCount: c.replies_count,
                    createdAt: c.created_at,
                    isEdited: c.is_edited,
                    editedAt: c.edited_at
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener información de XP y nivel del usuario actual
 * GET /api/users/me/xp
 */
const getUserXp = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Obtener datos del usuario
        const userResult = await query(
            'SELECT experience, level FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const { experience, level: dbLevel } = userResult.rows[0];
        const currentXp = parseInt(experience) || 0;

        // Calcular información completa del nivel
        const levelInfo = getLevelInfo(currentXp);

        // Obtener XP ganado hoy
        const dailyXpResult = await query(
            `SELECT xp_earned, chapters_read
             FROM user_xp_daily
             WHERE user_id = $1 AND date = CURRENT_DATE`,
            [userId]
        );

        const dailyXp = dailyXpResult.rows[0]
            ? {
                  earned: parseInt(dailyXpResult.rows[0].xp_earned) || 0,
                  chaptersRead: parseInt(dailyXpResult.rows[0].chapters_read) || 0,
                  limit: getXpConfig().DAILY_LIMIT,
                  remaining: Math.max(0, getXpConfig().DAILY_LIMIT - (parseInt(dailyXpResult.rows[0].xp_earned) || 0))
              }
            : {
                  earned: 0,
                  chaptersRead: 0,
                  limit: getXpConfig().DAILY_LIMIT,
                  remaining: getXpConfig().DAILY_LIMIT
              };

        // Obtener historial reciente (últimos 7 días)
        const historyResult = await query(
            `SELECT date, xp_earned, chapters_read
             FROM user_xp_daily
             WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
             ORDER BY date DESC`,
            [userId]
        );

        const weekHistory = historyResult.rows.map(row => ({
            date: row.date,
            xp: parseInt(row.xp_earned),
            chapters: parseInt(row.chapters_read)
        }));

        // Obtener total de capítulos únicos leídos
        const totalChaptersResult = await query(
            `SELECT COUNT(DISTINCT chapter_id) as total
             FROM reading_history
             WHERE user_id = $1 AND is_completed = true`,
            [userId]
        );

        const totalChapters = parseInt(totalChaptersResult.rows[0]?.total) || 0;

        res.json({
            success: true,
            data: {
                xp: {
                    total: currentXp,
                    daily: dailyXp,
                    weekHistory
                },
                level: {
                    current: levelInfo.level,
                    name: levelInfo.name,
                    color: levelInfo.color,
                    icon: levelInfo.icon,
                    description: levelInfo.description,
                    progress: levelInfo.progress,
                    xpToNextLevel: levelInfo.xpToNextLevel,
                    nextLevelXp: levelInfo.nextLevelXp,
                    isMaxLevel: levelInfo.level === 4
                },
                stats: {
                    totalChaptersCompleted: totalChapters,
                    xpPerChapter: getXpConfig().CHAPTER_COMPLETE,
                    minReadTimeSeconds: getXpConfig().MIN_READ_TIME_SECONDS
                },
                allLevels: Object.values(LEVEL_CONFIG)
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProfile,
    checkUsername,
    validateUsername,
    updateProfile,
    updateAvatar,
    updateBanner,
    updatePreferences,
    followUser,
    unfollowUser,
    getUserFollowers,
    getUserFollowing,
    getUserCollections,
    getUserActivity,
    getUserRatings,
    getUserComments,
    getReadingHistory,
    getBookmarks,
    clearHistory,
    listUsers,
    updateUserRole,
    updateUserStatus,
    updatePartialUser,
    getUserXp
};
