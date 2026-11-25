/**
 * Controlador de Comentarios
 */

const { query, transaction } = require('../config/database');
const { hasPermission } = require('../config/roles');
const { getUserBadgeStats } = require('./progress.controller');
const { normalizeWallComment, validateWallComment, WALL_TARGET_ID } = require('../utils/commentValidation');

/**
 * Construye el objeto author con badge stats para respuestas.
 * Nunca lanza — devuelve stats en 0 si falla.
 */
const buildAuthorWithBadges = async (user, dbRow = null, timezone = null) => {
    let badgeStats = { streak: 0, totalChapters: 0, comments: 0, nightReads: 0, maxChaptersPerHour: 0, ratings: 0 };
    const userId = user?.id ?? dbRow?.user_id ?? null;
    if (userId) {
        try {
            badgeStats = await getUserBadgeStats(userId, timezone);
        } catch (_) { /* stats en 0 — no crítico */ }
    }
    return {
        id: userId,
        username: user?.username ?? dbRow?.username ?? null,
        displayName: user?.displayName ?? user?.display_name ?? dbRow?.display_name ?? null,
        avatarUrl: user?.avatarUrl ?? user?.avatar_url ?? dbRow?.avatar_url ?? null,
        role: user?.role ?? dbRow?.user_role ?? null,
        isPremium: user?.isPremium ?? dbRow?.author_is_premium ?? dbRow?.is_premium ?? false,
        experience: parseInt(user?.experience ?? dbRow?.experience ?? 0) || 0,
        streak: badgeStats.streak,
        totalChapters: badgeStats.totalChapters,
        comments: badgeStats.comments,
        nightReads: badgeStats.nightReads,
        maxChaptersPerHour: badgeStats.maxChaptersPerHour,
        ratings: badgeStats.ratings
    };
};

/**
 * Obtener un comentario
 * GET /api/comments/:id
 */
const getComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // ✅ OPTIMIZADO: Una sola query con LEFT JOIN para encuestas y opciones
        const result = await query(
            `SELECT c.*, COALESCE(c.recommended_series_cover_url, rs.cover_url, rs.cover_url_web, rs.cover_url_tmo, rs.cover_url_oni) AS recommended_series_cover_url, rs.slug AS recommended_series_slug, u.username, u.display_name, u.avatar_url, u.role as user_role, u.experience,
                    u.is_premium AS author_is_premium,
                    EXISTS(SELECT 1 FROM comment_votes WHERE user_id = $2 AND comment_id = c.id AND vote_type = 1) as user_liked,
                    EXISTS(SELECT 1 FROM comment_votes WHERE user_id = $2 AND comment_id = c.id AND vote_type = -1) as user_disliked,
                    -- Datos de encuesta (si existe)
                    cp.id as poll_id, cp.question as poll_question, cp.total_votes as poll_total_votes,
                    (SELECT option_id FROM poll_votes WHERE poll_id = cp.id AND user_id = $2) as user_voted_option_id,
                    -- Opciones de encuesta como JSON array
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'id', po.id,
                            'text', po.option_text,
                            'order', po.option_order,
                            'vote_count', po.vote_count
                        ) ORDER BY po.option_order ASC)
                         FROM poll_options po
                         WHERE po.poll_id = cp.id),
                        '[]'
                    ) as poll_options
             FROM comments c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN LATERAL (
                 SELECT s.id, s.slug, s.cover_url, s.cover_url_web, s.cover_url_tmo, s.cover_url_oni
                 FROM series s
                 WHERE (c.recommended_series_id IS NOT NULL AND s.id = c.recommended_series_id)
                    OR (c.recommended_series_title IS NOT NULL
                        AND lower(trim(s.title)) = lower(trim(c.recommended_series_title)))
                 ORDER BY CASE WHEN s.id = c.recommended_series_id THEN 0 ELSE 1 END
                 LIMIT 1
             ) rs ON true
             LEFT JOIN comment_polls cp ON cp.comment_id = c.id
             WHERE c.id = $1 AND c.status = 'visible'`,
            [id, req.user?.id || null]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }
        
        const comment = result.rows[0];
        
        // ✅ Procesar encuesta si existe (datos ya cargados en una query)
        let poll = null;
        let pollLoadError = null; // No silenciar errores: exponer al cliente
        if (comment.poll_id) {
            try {
                const userVoted = !!comment.user_voted_option_id;
                const pollOptions = JSON.parse(comment.poll_options || '[]');

                poll = {
                    id: comment.poll_id,
                    question: comment.poll_question,
                    total_votes: comment.poll_total_votes,
                    user_voted: userVoted,
                    user_voted_option_id: comment.user_voted_option_id,
                    options: pollOptions.map(opt => ({
                        id: opt.id,
                        text: opt.text,
                        order: opt.option_order,
                        // Solo mostrar votos si el usuario ya votó
                        vote_count: userVoted ? opt.vote_count : null,
                        percentage: userVoted && comment.poll_total_votes > 0 
                            ? Math.round((opt.vote_count / comment.poll_total_votes) * 100)
                            : null
                    }))
                };
            } catch (pollErr) {
                console.error('Error procesando encuesta del comentario', comment.id, pollErr);
                // Exponer un objeto de error claro para que el frontend muestre un aviso
                poll = null;
                pollLoadError = {
                    message: 'No se pudo cargar la encuesta',
                    detail: pollErr.message || String(pollErr)
                };
            }
        }
        
        const author = await buildAuthorWithBadges(null, comment, req.user?.timezone || req.headers?.['x-timezone']);

        res.json({
            success: true,
            data: {
                comment: {
                    id: comment.id,
                    content: comment.content,
                    rating: comment.rating,
                    author,
                    targetType: comment.target_type,
                    targetId: comment.target_id,
                    parentId: comment.parent_id,
                    likes: comment.likes_count,
                    dislikes: comment.dislikes_count,
                    repliesCount: comment.replies_count,
                    isPinned: comment.is_pinned,
                    isSpoiler: comment.is_spoiler,
                    isEdited: comment.is_edited,
                    userLiked: comment.user_liked,
                    userDisliked: comment.user_disliked,
                    poll: poll,
                    pollError: pollLoadError,
                    createdAt: comment.created_at,
                    editedAt: comment.edited_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener respuestas de un comentario
 * GET /api/comments/:id/replies
 */
const getCommentReplies = async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = (page - 1) * limit;
        
        // Verificar comentario existe
        const commentResult = await query(
            'SELECT id, replies_count FROM comments WHERE id = $1 AND status = \'visible\'',
            [id]
        );
        
        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }
        
        const total = commentResult.rows[0].replies_count;
        
        const result = await query(
            `SELECT c.*, COALESCE(c.recommended_series_cover_url, rs.cover_url, rs.cover_url_web, rs.cover_url_tmo, rs.cover_url_oni) AS recommended_series_cover_url, rs.slug AS recommended_series_slug, u.username, u.display_name, u.avatar_url, u.role as user_role, u.experience,
                    u.is_premium AS author_is_premium,
                    EXISTS(SELECT 1 FROM comment_votes WHERE user_id = $3 AND comment_id = c.id AND vote_type = 1) as user_liked,
                    EXISTS(SELECT 1 FROM comment_votes WHERE user_id = $3 AND comment_id = c.id AND vote_type = -1) as user_disliked
             FROM comments c
             JOIN users u ON c.user_id = u.id
             LEFT JOIN LATERAL (
                 SELECT s.id, s.slug, s.cover_url, s.cover_url_web, s.cover_url_tmo, s.cover_url_oni
                 FROM series s
                 WHERE (c.recommended_series_id IS NOT NULL AND s.id = c.recommended_series_id)
                    OR (c.recommended_series_title IS NOT NULL
                        AND lower(trim(s.title)) = lower(trim(c.recommended_series_title)))
                 ORDER BY CASE WHEN s.id = c.recommended_series_id THEN 0 ELSE 1 END
                 LIMIT 1
             ) rs ON true
             WHERE c.parent_id = $1 AND c.status = 'visible'
             ORDER BY c.created_at ASC
             LIMIT $2 OFFSET $4`,
            [id, limit, req.user?.id || null, offset]
        );
        
        // Enriquecer respuestas con estadísticas de badges
        const enrichedReplies = await Promise.all(
            result.rows.map(async (c) => {
                const author = await buildAuthorWithBadges(null, c, req.user?.timezone || req.headers?.['x-timezone']);

                return {
                    id: c.id,
                    content: c.content,
                    author,
                    likes: c.likes_count,
                    dislikes: c.dislikes_count,
                    isSpoiler: c.is_spoiler,
                    recommendedSeries: (c.recommended_series_id || c.recommended_series_title) ? {
                        id: c.recommended_series_id || null,
                        title: c.recommended_series_title,
                        slug: c.recommended_series_slug,
                        coverUrl: c.recommended_series_cover_url
                    } : null,
                    userLiked: c.user_liked,
                    userDisliked: c.user_disliked,
                    createdAt: c.created_at
                };
            })
        );
        
        res.json({
            success: true,
            data: {
                replies: enrichedReplies,
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
 * Crear comentario
 * POST /api/comments
 */
const createComment = async (req, res, next) => {
    try {
        const { targetType, targetId, content, parentId, rating, isSpoiler, poll, recommendedSeriesId, recommendedSeriesCoverUrl } = req.body;

        if (targetType === 'wall' && !parentId) {
            const wallValidation = validateWallComment({ content, rating, isSpoiler, poll });
            if (wallValidation.code) {
                const messages = {
                    CONTENT_EMPTY: 'El mensaje no puede estar vacío',
                    CONTENT_TOO_LONG: 'El mensaje no puede exceder 500 caracteres',
                    FIELD_NOT_ALLOWED: 'El rating no está disponible en el muro'
                };
                return res.status(422).json({
                    success: false,
                    message: messages[wallValidation.code],
                    code: wallValidation.code,
                    field: wallValidation.field
                });
            }

            const dailyCount = await query(
                `SELECT COUNT(*)::int AS count
                 FROM comments
                 WHERE user_id = $1
                   AND target_type = 'wall'
                   AND created_at >= date_trunc('day', NOW())`,
                [req.user.id]
            );
            if ((dailyCount.rows[0]?.count || 0) >= 50) {
                return res.status(429).json({
                    success: false,
                    message: 'Llegaste al límite diario de publicaciones',
                    code: 'RATE_LIMIT_DAILY'
                });
            }

            const latestWallComment = await query(
                `SELECT content
                 FROM comments
                 WHERE user_id = $1
                   AND target_type = 'wall'
                   AND status = 'visible'
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [req.user.id]
            );
            if (latestWallComment.rows.length > 0
                && normalizeWallComment(latestWallComment.rows[0].content) === wallValidation.normalized) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya publicaste ese comentario en el muro',
                    code: 'DUPLICATE_COMMENT'
                });
            }
        }
        
        // Validar que haya al menos contenido O encuesta
        const hasContent = content && content.trim().length > 0;
        const hasPoll = poll && poll.question && poll.question.trim().length > 0;
        
        if (!hasContent && !hasPoll) {
            return res.status(400).json({
                success: false,
                message: 'Debe proporcionar contenido o una encuesta'
            });
        }
        
        // Validar datos de encuesta si existe
        if (poll) {
            if (!poll.question || typeof poll.question !== 'string' || poll.question.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La encuesta debe tener una pregunta'
                });
            }
            
            if (!poll.options || !Array.isArray(poll.options) || poll.options.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'La encuesta debe tener al menos 2 opciones'
                });
            }
            
            if (poll.options.length > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'La encuesta no puede tener más de 5 opciones'
                });
            }
            
            // Validar que las opciones no estén vacías
            const validOptions = poll.options.filter(opt => opt && typeof opt === 'string' && opt.trim().length > 0);
            if (validOptions.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'La encuesta debe tener al menos 2 opciones válidas'
                });
            }
        }
        
        // Verificar que el target existe
        let targetTable;
        switch (targetType) {
            case 'series': targetTable = 'series'; break;
            case 'chapter': targetTable = 'chapters'; break;
            case 'collection': targetTable = 'collections'; break;
            case 'request': targetTable = 'requests'; break;
            case 'wall':
                if (targetId !== WALL_TARGET_ID) {
                    return res.status(404).json({ success: false, message: 'Target no encontrado' });
                }
                targetTable = null;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de target inválido'
                });
        }
        
        if (targetType !== 'wall') {
            const targetResult = await query(
                `SELECT id FROM ${targetTable} WHERE id = $1`,
                [targetId]
            );

            if (targetResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Target no encontrado'
                });
            }
        }
        
        // Si es respuesta, verificar comentario padre
        let rootId = null;
        if (parentId) {
            const parentResult = await query(
                'SELECT id, parent_id, root_id, target_type, target_id FROM comments WHERE id = $1 AND status = \'visible\'',
                [parentId]
            );
            
            if (parentResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Comentario padre no encontrado'
                });
            }
            
            const parent = parentResult.rows[0];

            if (targetType === 'wall' && (parent.root_id || parent.parent_id)) {
                return res.status(422).json({
                    success: false,
                    message: 'Solo se puede responder a una publicación raíz',
                    code: 'INVALID_PARENT',
                    errors: { parentId: 'No se puede responder a una respuesta' }
                });
            }
            
            // Verificar que pertenece al mismo target
            if (parent.target_type !== targetType || parent.target_id !== targetId) {
                return res.status(400).json({
                    success: false,
                    message: 'El comentario padre no pertenece al mismo target'
                });
            }
            
            rootId = parent.root_id || parentId;
        }
        
        // Si solo hay encuesta y no contenido, guardar contenido vacío
        const commentContent = targetType === 'wall'
            ? normalizeWallComment(content)
            : ((content && content.trim()) || '');
        
        let recommendation = null;
        if (recommendedSeriesId) {
            const seriesResult = await query(
                `SELECT id, title, slug, cover_url, cover_url_web, cover_url_tmo, cover_url_oni
                 FROM series WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
                [recommendedSeriesId]
            );
            if (!seriesResult.rows.length) {
                return res.status(404).json({ success: false, message: 'Manhwa recomendado no encontrado' });
            }
            const series = seriesResult.rows[0];
            recommendation = {
                id: series.id,
                title: series.title,
                slug: series.slug,
                coverUrl: series.cover_url || series.cover_url_web || series.cover_url_tmo || series.cover_url_oni ||
                    (/^https?:\/\//i.test(String(recommendedSeriesCoverUrl || '')) ? recommendedSeriesCoverUrl : null)
            };
        }

        const result = await query(
            `INSERT INTO comments (user_id, target_type, target_id, parent_id, root_id, content, rating, is_spoiler, ip_address,
                                   recommended_series_id, recommended_series_title, recommended_series_cover_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [req.user.id, targetType, targetId, parentId, rootId, commentContent, rating, isSpoiler || false, req.ip,
                recommendation?.id || null, recommendation?.title || null, recommendation?.coverUrl || null]
        );
        
        const comment = result.rows[0];
        
        // Crear encuesta si existe
        let pollData = null;
        if (poll && poll.question && poll.options) {
            try {
                // Filtrar opciones válidas
                const validOptions = poll.options.filter(opt => opt && typeof opt === 'string' && opt.trim().length > 0);
                
                if (validOptions.length >= 2 && validOptions.length <= 5) {
                    // Crear registro de encuesta con pregunta
                    const pollResult = await query(
                        'INSERT INTO comment_polls (comment_id, question, total_votes) VALUES ($1, $2, $3) RETURNING id',
                        [comment.id, poll.question.trim().substring(0, 300), 0]
                    );
                    const pollId = pollResult.rows[0].id;
                    
                    // Insertar opciones con option_order y recolectar sus IDs
                    const insertedOptions = [];
                    for (let i = 0; i < validOptions.length; i++) {
                        const optionResult = await query(
                            'INSERT INTO poll_options (poll_id, option_text, option_order, vote_count) VALUES ($1, $2, $3, $4) RETURNING id, option_text, option_order, vote_count',
                            [pollId, validOptions[i].trim().substring(0, 150), i, 0]
                        );
                        insertedOptions.push(optionResult.rows[0]);
                    }
                    
                    pollData = {
                        id: pollId,
                        question: poll.question.trim().substring(0, 300),
                        total_votes: 0,
                        user_voted: false,
                        user_voted_option_id: null,
                        options: insertedOptions.map(opt => ({
                            id: opt.id,
                            text: opt.option_text,
                            order: opt.option_order,
                            vote_count: null, // No mostrar conteo hasta que el usuario vote
                            percentage: null
                        }))
                    };
                }
            } catch (pollErr) {
                console.warn('Error creando encuesta para comentario', comment.id, pollErr);
            }
        }
        
        // Actualizar contador de respuestas del padre
        if (parentId) {
            await query(
                'UPDATE comments SET replies_count = replies_count + 1 WHERE id = $1',
                [parentId]
            );

            if (targetType === 'wall') {
                const wallReplyParent = await query(
                    `SELECT user_id
                     FROM comments
                     WHERE id = $1
                       AND target_type = 'wall'
                       AND status = 'visible'`,
                    [parentId]
                );
                if (wallReplyParent.rows.length > 0
                    && wallReplyParent.rows[0].user_id !== req.user.id) {
                    await query(
                        `INSERT INTO notifications (user_id, type, title, message, data, url)
                         VALUES ($1, 'wall_comment_reply', 'Nueva respuesta en el muro',
                                 $2, $3, '/muro')`,
                        [
                            wallReplyParent.rows[0].user_id,
                            `${req.user.username} respondió tu comentario`,
                            JSON.stringify({
                                commentId: comment.id,
                                parentId,
                                actorId: req.user.id
                            })
                        ]
                    );
                }
            }
        }
        
        // Actualizar contador en el target
        if (targetType === 'series') {
            await query(
                'UPDATE series SET comment_count = comment_count + 1 WHERE id = $1',
                [targetId]
            );
        } else if (targetType === 'chapter') {
            await query(
                'UPDATE chapters SET comment_count = comment_count + 1 WHERE id = $1',
                [targetId]
            );
        } else if (targetType === 'request') {
            await query(
                'UPDATE requests SET comments_count = comments_count + 1 WHERE id = $1',
                [targetId]
            );
        }
        
        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, target_type, target_id, metadata, is_public)
             VALUES ($1, 'comment', $2, $3, $4, true)`,
            [req.user.id, targetType, targetId, JSON.stringify({ commentId: comment.id })]
        );

        // Intentar enviar webhook si está configurado
        try {
            const webhookUrl = process.env.COMMENT_WEBHOOK_URL || null
            if (webhookUrl) {
                // Use global fetch (Node 18+) if available
                const payload = {
                    event: 'comment.created',
                    comment: {
                        id: comment.id,
                        content: comment.content,
                        userId: req.user.id,
                        targetType,
                        targetId,
                        isSpoiler: !!comment.is_spoiler,
                        createdAt: comment.created_at
                    }
                }
                try {
                    await (global.fetch || fetch)(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    })
                } catch (wErr) {
                    console.warn('Webhook delivery failed for comment', comment.id, wErr && wErr.message)
                }
            }
        } catch (e) {
            console.warn('Error sending comment webhook', e && e.message)
        }
        
        const authorWithBadges = await buildAuthorWithBadges(req.user, null, req.user?.timezone);

        // ============================================
        // SISTEMA DE LOGROS - Verificar logro de comentarios
        // ============================================
        let achievementUnlocked = null;
        try {
            const { checkAndUpdateAchievements } = require('./achievement.controller');
            const { ACHIEVEMENT_TYPES } = require('../utils/achievementSystem');
            
            // Obtener total de comentarios del usuario
            const commentsResult = await query(
                'SELECT COUNT(*) as count FROM comments WHERE user_id = $1 AND status = $2',
                [req.user.id, 'visible']
            );
            const totalComments = parseInt(commentsResult.rows[0]?.count) || 0;
            
            // Verificar logro
            achievementUnlocked = await checkAndUpdateAchievements(
                req.user.id,
                ACHIEVEMENT_TYPES.CRITICO,
                totalComments
            );
        } catch (achievementError) {
            // No crítico - no afectar creación del comentario
            console.warn('⚠️ Error verificando logro de comentarios:', achievementError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Comentario creado',
            data: {
                comment: {
                    id: comment.id,
                    content: comment.content,
                    rating: comment.rating,
                    isSpoiler: comment.is_spoiler,
                    recommendedSeries: comment.recommended_series_id ? {
                        id: comment.recommended_series_id,
                        title: comment.recommended_series_title,
                        slug: recommendation?.slug || null,
                        coverUrl: comment.recommended_series_cover_url
                    } : null,
                    poll: pollData,
                    createdAt: comment.created_at,
                    author: authorWithBadges
                },
                // Información del logro si se desbloqueó
                ...(achievementUnlocked?.unlocked && {
                    achievement: {
                        type: achievementUnlocked.achievementType,
                        newLevel: achievementUnlocked.newLevel,
                        levelName: achievementUnlocked.levelName,
                        color: achievementUnlocked.color
                    }
                })
            }
        });
        // Broadcast SSE a clientes conectados (si existen)
        try {
            const clients = req.app && req.app.locals && req.app.locals.sseClients ? req.app.locals.sseClients : []
            const payload = JSON.stringify({
                id: comment.id,
                content: comment.content,
                userId: req.user.id,
                targetType,
                targetId,
                parentId: comment.parent_id || parentId || null,
                isSpoiler: !!comment.is_spoiler,
                recommendedSeries: comment.recommended_series_id ? {
                    id: comment.recommended_series_id,
                    title: comment.recommended_series_title,
                    slug: recommendation?.slug || null,
                    coverUrl: comment.recommended_series_cover_url
                } : null,
                createdAt: comment.created_at,
                author: authorWithBadges
            })
            clients.forEach(c => {
                try {
                    c.res.write(`event: comment.created\n`)
                    c.res.write(`data: ${payload}\n\n`)
                } catch (e) { /* noop */ }
            })
        } catch (e) {
            console.warn('Error broadcasting SSE comment', e && e.message)
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar comentario
 * PUT /api/comments/:id
 */
const updateComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content, isSpoiler } = req.body;
        
        // Verificar propiedad
        const commentResult = await query(
            'SELECT user_id, target_type FROM comments WHERE id = $1 AND status = \'visible\'',
            [id]
        );
        
        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }
        
        const comment = commentResult.rows[0];

        if (comment.target_type === 'wall') {
            const wallValidation = validateWallComment({
                content,
                rating: undefined,
                isSpoiler: false,
                poll: undefined
            });
            if (wallValidation.code) {
                const messages = {
                    CONTENT_EMPTY: 'El mensaje no puede estar vacío',
                    CONTENT_TOO_LONG: 'El mensaje no puede exceder 500 caracteres'
                };
                return res.status(422).json({
                    success: false,
                    message: messages[wallValidation.code],
                    code: wallValidation.code
                });
            }
        }
        
        // Verificar permisos
        if (comment.user_id !== req.user.id && !hasPermission(req.user.role, 'comments:delete_any')) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para editar este comentario'
            });
        }
        
        const updatedContent = comment.target_type === 'wall'
            ? normalizeWallComment(content)
            : content;

        await query(
            `UPDATE comments 
             SET content = $1,
                 is_spoiler = COALESCE($2, is_spoiler),
                 is_edited = true,
                 edited_at = NOW(),
                 updated_at = NOW()
             WHERE id = $3`,
            [updatedContent, isSpoiler, id]
        );
        
        res.json({
            success: true,
            message: 'Comentario actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar comentario
 * DELETE /api/comments/:id
 */
const deleteComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const commentResult = await query(
            'SELECT user_id, target_type, target_id, parent_id FROM comments WHERE id = $1',
            [id]
        );
        
        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }
        
        const comment = commentResult.rows[0];
        
        // Verificar permisos
        if (comment.user_id !== req.user.id && !hasPermission(req.user.role, 'comments:delete_any')) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar este comentario'
            });
        }
        
        // Soft delete
        await query(
            'UPDATE comments SET status = \'deleted\', deleted_at = NOW() WHERE id = $1',
            [id]
        );
        
        // Actualizar contadores
        if (comment.parent_id) {
            await query(
                'UPDATE comments SET replies_count = replies_count - 1 WHERE id = $1',
                [comment.parent_id]
            );
        }
        
        if (comment.target_type === 'series') {
            await query(
                'UPDATE series SET comment_count = comment_count - 1 WHERE id = $1',
                [comment.target_id]
            );
        } else if (comment.target_type === 'chapter') {
            await query(
                'UPDATE chapters SET comment_count = comment_count - 1 WHERE id = $1',
                [comment.target_id]
            );
        }
        
        res.json({
            success: true,
            message: 'Comentario eliminado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Dar like a un comentario
 * POST /api/comments/:id/like
 */
const likeComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Verificar comentario existe
        const commentResult = await query(
            'SELECT id FROM comments WHERE id = $1 AND status = \'visible\'',
            [id]
        );
        
        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }
        
        // Insertar o actualizar voto
        await query(
            `INSERT INTO comment_votes (user_id, comment_id, vote_type)
             VALUES ($1, $2, 1)
             ON CONFLICT (user_id, comment_id) 
             DO UPDATE SET vote_type = 1, created_at = NOW()`,
            [req.user.id, id]
        );

        // Recalcular contadores y persistir en comments
        const likesRes = await query('SELECT COUNT(*)::int AS likes FROM comment_votes WHERE comment_id = $1 AND vote_type = 1', [id]);
        const dislikesRes = await query('SELECT COUNT(*)::int AS dislikes FROM comment_votes WHERE comment_id = $1 AND vote_type = -1', [id]);
        const likes = likesRes.rows[0]?.likes || 0;
        const dislikes = dislikesRes.rows[0]?.dislikes || 0;
        await query('UPDATE comments SET likes_count = $1, dislikes_count = $2 WHERE id = $3', [likes, dislikes, id]);

        // Broadcast SSE
        try {
            const clients = req.app && req.app.locals && req.app.locals.sseClients ? req.app.locals.sseClients : [];
            const payload = JSON.stringify({ commentId: id, likesCount: likes, dislikesCount: dislikes, userId: req.user.id, action: 'like', viewerReaction: 'like' });
            clients.forEach(c => {
                try {
                    c.res.write(`event: comment.reaction\n`)
                    c.res.write(`data: ${payload}\n\n`)
                } catch (e) { /* noop */ }
            })
        } catch (e) { console.warn('Error broadcasting reaction SSE', e && e.message) }

        res.json({ success: true, message: 'Like agregado', data: { likesCount: likes, dislikesCount: dislikes } });
    } catch (error) {
        next(error);
    }
};

/**
 * Dar dislike a un comentario
 * POST /api/comments/:id/dislike
 */
const dislikeComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const commentResult = await query(
            'SELECT id FROM comments WHERE id = $1 AND status = \'visible\'',
            [id]
        );
        
        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }
        
        await query(
            `INSERT INTO comment_votes (user_id, comment_id, vote_type)
             VALUES ($1, $2, -1)
             ON CONFLICT (user_id, comment_id) 
             DO UPDATE SET vote_type = -1, created_at = NOW()`,
            [req.user.id, id]
        );

        // Recalcular contadores y persistir
        const likesRes = await query('SELECT COUNT(*)::int AS likes FROM comment_votes WHERE comment_id = $1 AND vote_type = 1', [id]);
        const dislikesRes = await query('SELECT COUNT(*)::int AS dislikes FROM comment_votes WHERE comment_id = $1 AND vote_type = -1', [id]);
        const likes = likesRes.rows[0]?.likes || 0;
        const dislikes = dislikesRes.rows[0]?.dislikes || 0;
        await query('UPDATE comments SET likes_count = $1, dislikes_count = $2 WHERE id = $3', [likes, dislikes, id]);

        // Broadcast SSE
        try {
            const clients = req.app && req.app.locals && req.app.locals.sseClients ? req.app.locals.sseClients : [];
            const payload = JSON.stringify({ commentId: id, likesCount: likes, dislikesCount: dislikes, userId: req.user.id, action: 'dislike', viewerReaction: 'dislike' });
            clients.forEach(c => {
                try {
                    c.res.write(`event: comment.reaction\n`)
                    c.res.write(`data: ${payload}\n\n`)
                } catch (e) { /* noop */ }
            })
        } catch (e) { console.warn('Error broadcasting reaction SSE', e && e.message) }

        res.json({ success: true, message: 'Dislike agregado', data: { likesCount: likes, dislikesCount: dislikes } });
    } catch (error) {
        next(error);
    }
};

/**
 * Quitar voto de un comentario
 * DELETE /api/comments/:id/vote
 */
const removeVote = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await query(
            'DELETE FROM comment_votes WHERE user_id = $1 AND comment_id = $2',
            [req.user.id, id]
        );
        // Recalcular contadores y persistir
        const likesRes = await query('SELECT COUNT(*)::int AS likes FROM comment_votes WHERE comment_id = $1 AND vote_type = 1', [id]);
        const dislikesRes = await query('SELECT COUNT(*)::int AS dislikes FROM comment_votes WHERE comment_id = $1 AND vote_type = -1', [id]);
        const likes = likesRes.rows[0]?.likes || 0;
        const dislikes = dislikesRes.rows[0]?.dislikes || 0;
        await query('UPDATE comments SET likes_count = $1, dislikes_count = $2 WHERE id = $3', [likes, dislikes, id]);

        // Broadcast SSE
        try {
            const clients = req.app && req.app.locals && req.app.locals.sseClients ? req.app.locals.sseClients : [];
            const payload = JSON.stringify({ commentId: id, likesCount: likes, dislikesCount: dislikes, userId: req.user.id, action: 'remove', viewerReaction: null });
            clients.forEach(c => {
                try {
                    c.res.write(`event: comment.reaction\n`)
                    c.res.write(`data: ${payload}\n\n`)
                } catch (e) { /* noop */ }
            })
        } catch (e) { console.warn('Error broadcasting reaction SSE', e && e.message) }

        res.json({ success: true, message: 'Voto eliminado', data: { likesCount: likes, dislikesCount: dislikes } });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener reacciones del usuario para los comentarios de un target
 * GET /api/comments/my-reactions?targetType=request&targetId=<id>
 */
const getWallComments = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 50);
        const offset = (page - 1) * limit;
        const targetId = '00000000-0000-0000-0000-000000000000';

        const result = await query(
            `SELECT c.*, COALESCE(c.recommended_series_cover_url, rs.cover_url, rs.cover_url_web, rs.cover_url_tmo, rs.cover_url_oni) AS recommended_series_cover_url, rs.slug AS recommended_series_slug, u.username, u.display_name, u.avatar_url, u.role as user_role, u.experience,
                    u.is_premium AS author_is_premium,
                    EXISTS(
                        SELECT 1 FROM comment_votes cv
                        WHERE cv.comment_id = c.id AND cv.user_id = $3 AND cv.vote_type = 1
                    ) AS user_liked,
                    EXISTS(
                        SELECT 1 FROM comment_votes cv
                        WHERE cv.comment_id = c.id AND cv.user_id = $3 AND cv.vote_type = -1
                    ) AS user_disliked
             FROM comments c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN LATERAL (
                 SELECT s.id, s.slug, s.cover_url, s.cover_url_web, s.cover_url_tmo, s.cover_url_oni
                 FROM series s
                 WHERE (c.recommended_series_id IS NOT NULL AND s.id = c.recommended_series_id)
                    OR (c.recommended_series_title IS NOT NULL
                        AND lower(trim(s.title)) = lower(trim(c.recommended_series_title)))
                 ORDER BY CASE WHEN s.id = c.recommended_series_id THEN 0 ELSE 1 END
                 LIMIT 1
             ) rs ON true
             WHERE c.target_type = 'wall'
               AND c.target_id = $1
               AND c.parent_id IS NULL
               AND c.status = 'visible'
             ORDER BY c.is_pinned DESC, c.created_at DESC
             LIMIT $2 OFFSET $4`,
            [targetId, limit, req.user?.id || null, offset]
        );

        const { getUserBadgeStats } = require('./progress.controller');
        const comments = await Promise.all(result.rows.map(async (comment) => {
            let poll = null;
            try {
                const pollResult = await query(
                    `SELECT cp.id, cp.question, cp.total_votes,
                            (SELECT option_id FROM poll_votes WHERE poll_id = cp.id AND user_id = $2) AS user_voted_option_id
                     FROM comment_polls cp
                     WHERE cp.comment_id = $1`,
                    [comment.id, req.user?.id || null]
                );
                if (pollResult.rows.length > 0) {
                    const pollRow = pollResult.rows[0];
                    const options = await query(
                        'SELECT id, option_text, option_order, vote_count FROM poll_options WHERE poll_id = $1 ORDER BY option_order',
                        [pollRow.id]
                    );
                    const userVoted = !!pollRow.user_voted_option_id;
                    poll = {
                        id: pollRow.id,
                        question: pollRow.question,
                        total_votes: pollRow.total_votes,
                        user_voted: userVoted,
                        user_voted_option_id: pollRow.user_voted_option_id,
                        options: options.rows.map((option) => ({
                            id: option.id,
                            text: option.option_text,
                            order: option.option_order,
                            vote_count: userVoted ? option.vote_count : null,
                            percentage: userVoted && pollRow.total_votes > 0
                                ? Math.round((option.vote_count / pollRow.total_votes) * 100)
                                : null
                        }))
                    };
                }
            } catch (pollError) {
                console.warn('Error obteniendo encuesta del comentario', comment.id, pollError);
            }

            let badgeStats = {};
            try {
                badgeStats = await getUserBadgeStats(comment.user_id, req.user?.timezone || req.headers?.['x-timezone']);
            } catch {
                badgeStats = {};
            }

            return {
                id: comment.id,
                content: comment.content,
                rating: comment.rating,
                targetType: comment.target_type,
                targetId: comment.target_id,
                parentId: comment.parent_id,
                rootId: comment.root_id,
                likes: comment.likes_count,
                dislikes: comment.dislikes_count,
                repliesCount: comment.replies_count,
                isPinned: comment.is_pinned,
                isSpoiler: comment.is_spoiler,
                isEdited: comment.is_edited,
                recommendedSeries: (comment.recommended_series_id || comment.recommended_series_title) ? {
                    id: comment.recommended_series_id || null,
                    title: comment.recommended_series_title,
                    slug: comment.recommended_series_slug,
                    coverUrl: comment.recommended_series_cover_url
                } : null,
                userLiked: comment.user_liked,
                userDisliked: comment.user_disliked,
                poll,
                createdAt: comment.created_at,
                editedAt: comment.edited_at,
                author: {
                    id: comment.user_id,
                    username: comment.username,
                    displayName: comment.display_name,
                    avatarUrl: comment.avatar_url,
                    role: comment.user_role,
                    isPremium: comment.author_is_premium,
                    experience: parseInt(comment.experience) || 0,
                    ...badgeStats
                }
            };
        }));

        const count = await query(
            `SELECT COUNT(*)::integer AS count
             FROM comments
             WHERE target_type = 'wall'
               AND target_id = $1
               AND parent_id IS NULL
               AND status = 'visible'`,
            [targetId]
        );

        const total = count.rows[0]?.count || 0;
        res.json({
            success: true,
            data: {
                comments,
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

const getMyReactions = async (req, res, next) => {
    try {
        const { targetType, targetId } = req.query;
        if (!targetType || !targetId) return res.status(400).json({ success: false, message: 'Faltan parámetros' });

        const rows = await query(
            `SELECT cv.comment_id, cv.vote_type FROM comment_votes cv
             JOIN comments c ON c.id = cv.comment_id
             WHERE cv.user_id = $1 AND c.target_type = $2 AND c.target_id = $3`,
            [req.user.id, targetType, targetId]
        );

        const reactions = (rows.rows || []).map(r => ({ commentId: r.comment_id, reaction: r.vote_type === 1 ? 'like' : (r.vote_type === -1 ? 'dislike' : null) }));
        res.json({ success: true, data: { reactions } });
    } catch (error) {
        next(error);
    }
}

/**
 * Fijar comentario
 * POST /api/comments/:id/pin
 */
const pinComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await query(
            'UPDATE comments SET is_pinned = true WHERE id = $1',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Comentario fijado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Desfijar comentario
 * DELETE /api/comments/:id/pin
 */
const unpinComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await query(
            'UPDATE comments SET is_pinned = false WHERE id = $1',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Comentario desfijado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ocultar comentario
 * POST /api/comments/:id/hide
 */
const hideComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await query(
            'UPDATE comments SET status = \'hidden\' WHERE id = $1',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Comentario ocultado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reportar comentario
 * POST /api/comments/:id/report
 */
const reportComment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason, description } = req.body;
        
        // Verificar comentario existe
        const commentResult = await query(
            'SELECT id FROM comments WHERE id = $1',
            [id]
        );
        
        if (commentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }
        
        // Verificar si ya reportó
        const existingReport = await query(
            'SELECT id FROM reports WHERE reporter_id = $1 AND reported_type = \'comment\' AND reported_id = $2',
            [req.user.id, id]
        );
        
        if (existingReport.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Ya has reportado este comentario',
                code: 'ALREADY_REPORTED'
            });
        }
        
        await query(
            `INSERT INTO reports (reporter_id, reported_type, reported_id, report_type, description)
             VALUES ($1, 'comment', $2, $3, $4)`,
            [req.user.id, id, reason || 'other', description]
        );
        
        res.json({
            success: true,
            message: 'Reporte enviado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Votar en encuesta de comentario
 * POST /api/comments/:id/poll/vote
 */
const votePoll = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { option_id } = req.body;
        
        if (!option_id) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere option_id'
            });
        }
        
        // 1. Obtener la encuesta del comentario
        const pollResult = await query(
            'SELECT cp.id FROM comment_polls cp JOIN comments c ON cp.comment_id = c.id WHERE c.id = $1 AND c.status = \'visible\'',
            [id]
        );
        
        if (pollResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Encuesta no encontrada'
            });
        }
        
        const pollId = pollResult.rows[0].id;
        
        // 2. Verificar que el usuario NO haya votado ya
        const existingVote = await query(
            'SELECT id FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
            [pollId, req.user.id]
        );
        
        if (existingVote.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Ya has votado en esta encuesta'
            });
        }
        
        // 3. Verificar que la opción pertenece a esta encuesta
        const optionCheck = await query(
            'SELECT id FROM poll_options WHERE id = $1 AND poll_id = $2',
            [option_id, pollId]
        );
        
        if (optionCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Opción no válida'
            });
        }
        
        // 4. Registrar el voto
        await query(
            'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)',
            [pollId, option_id, req.user.id]
        );
        
        // 5. Incrementar contadores
        await query(
            'UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = $1',
            [option_id]
        );
        
        await query(
            'UPDATE comment_polls SET total_votes = total_votes + 1 WHERE id = $1',
            [pollId]
        );
        
        // 6. Devolver los resultados actualizados
        const updatedPoll = await query(
            'SELECT cp.id, cp.question, cp.total_votes FROM comment_polls cp WHERE cp.id = $1',
            [pollId]
        );
        
        const updatedOptions = await query(
            'SELECT id, option_text, option_order, vote_count FROM poll_options WHERE poll_id = $1 ORDER BY option_order ASC',
            [pollId]
        );
        
        const totalVotes = updatedPoll.rows[0].total_votes;
        
        res.json({
            success: true,
            message: 'Voto registrado',
            data: {
                poll: {
                    id: pollId,
                    question: updatedPoll.rows[0].question,
                    total_votes: totalVotes,
                    user_voted: true,
                    user_voted_option_id: option_id,
                    options: updatedOptions.rows.map(opt => ({
                        id: opt.id,
                        text: opt.option_text,
                        order: opt.option_order,
                        vote_count: opt.vote_count,
                        percentage: totalVotes > 0 
                            ? Math.round((opt.vote_count / totalVotes) * 100)
                            : 0
                    }))
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener votos de encuesta
 * GET /api/comments/:id/poll/votes
 */
const getPollVotes = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Verificar que el comentario existe y tiene encuesta
        const pollResult = await query(
            `SELECT cp.id, cp.question, cp.total_votes,
                    (SELECT option_id FROM poll_votes WHERE poll_id = cp.id AND user_id = $2) as user_voted_option_id
             FROM comment_polls cp 
             JOIN comments c ON cp.comment_id = c.id 
             WHERE c.id = $1 AND c.status = 'visible'`,
            [id, req.user?.id || null]
        );
        
        if (pollResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Encuesta no encontrada'
            });
        }
        
        const pollInfo = pollResult.rows[0];
        const pollId = pollInfo.id;
        const userVoted = !!pollInfo.user_voted_option_id;
        
        // Obtener opciones
        const optionsResult = await query(
            'SELECT id, option_text, option_order, vote_count FROM poll_options WHERE poll_id = $1 ORDER BY option_order ASC',
            [pollId]
        );
        
        res.json({
            success: true,
            data: {
                poll: {
                    id: pollId,
                    question: pollInfo.question,
                    total_votes: pollInfo.total_votes,
                    user_voted: userVoted,
                    user_voted_option_id: pollInfo.user_voted_option_id,
                    options: optionsResult.rows.map(opt => ({
                        id: opt.id,
                        text: opt.option_text,
                        order: opt.option_order,
                        // Solo mostrar votos si el usuario ya votó
                        vote_count: userVoted ? opt.vote_count : null,
                        percentage: userVoted && pollInfo.total_votes > 0 
                            ? Math.round((opt.vote_count / pollInfo.total_votes) * 100)
                            : null
                    }))
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getComment,
    getCommentReplies,
    getWallComments,
    createComment,
    updateComment,
    deleteComment,
    likeComment,
    dislikeComment,
    removeVote,
    getMyReactions,
    pinComment,
    unpinComment,
    hideComment,
    reportComment,
    votePoll,
    getPollVotes
};

/**
 * Recibir evento de "typing" y retransmitir por SSE a clientes conectados.
 * POST /api/comments/typing
 */
const typingEvent = async (req, res, next) => {
    try {
        const { requestId, clientId, user: typingUser, ts } = req.body || {};
        const payload = JSON.stringify({ type: 'typing', requestId: String(requestId || ''), clientId: String(clientId || ''), user: typingUser || null, ts: ts || Date.now() });
        try {
            const clients = req.app && req.app.locals && req.app.locals.sseClients ? req.app.locals.sseClients : [];
            clients.forEach(c => {
                try {
                    c.res.write(`event: comment.typing\n`)
                    c.res.write(`data: ${payload}\n\n`)
                } catch (e) { /* noop */ }
            })
        } catch (e) { /* noop */ }

        res.status(204).end();
    } catch (error) {
        next(error);
    }
};

// Exponer el handler adicional
module.exports.typingEvent = typingEvent;
