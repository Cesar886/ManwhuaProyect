/**
 * Controlador de Requests/Pedidos
 */

const { query, transaction } = require('../config/database');
const { hasPermission } = require('../config/roles');

/**
 * Listar pedidos
 * GET /api/requests
 */
const listRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        const { status, sort = 'votes', order = 'desc' } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramCount = 0;
        
        if (status) {
            paramCount++;
            whereClause += ` AND r.status = $${paramCount}`;
            params.push(status);
        }
        
        const validSorts = {
            'votes': 'r.votes_count',
            'date': 'r.created_at',
            'progress': 'r.progress'
        };
        const sortField = validSorts[sort] || 'r.votes_count';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
        
        const result = await query(
            `SELECT r.*, u.username, u.display_name, u.avatar_url,
                    EXISTS(SELECT 1 FROM request_votes WHERE user_id = $${paramCount + 1} AND request_id = r.id) as user_voted
             FROM requests r
             JOIN users u ON r.requested_by = u.id
             ${whereClause}
             ORDER BY ${sortField} ${sortOrder}
             LIMIT $${paramCount + 2} OFFSET $${paramCount + 3}`,
            [...params, req.user?.id || null, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) FROM requests r ${whereClause}`,
            params
        );
        
        const total = parseInt(countResult.rows[0].count);
        
        // Estadísticas
        const statsResult = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected
             FROM requests`
        );
        
        res.json({
            success: true,
            data: {
                requests: result.rows.map(r => ({
                    id: r.id,
                    title: r.title,
                    originalTitle: r.original_title,
                    description: r.description,
                    coverUrl: r.cover_url,
                    genres: r.genres,
                    status: r.status,
                    priority: r.priority,
                    progress: r.progress,
                    votes: r.votes_count,
                    commentsCount: r.comments_count,
                    userVoted: r.user_voted,
                    requestedBy: {
                        username: r.username,
                        displayName: r.display_name,
                        avatarUrl: r.avatar_url
                    },
                    createdAt: r.created_at
                })),
                stats: statsResult.rows[0],
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
 * Obtener detalle de pedido
 * GET /api/requests/:id
 */
const getRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `SELECT r.*, u.username, u.display_name, u.avatar_url, u.bio as user_bio,
                    s.title as series_title, s.slug as series_slug,
                    EXISTS(SELECT 1 FROM request_votes WHERE user_id = $2 AND request_id = r.id) as user_voted
             FROM requests r
             JOIN users u ON r.requested_by = u.id
             LEFT JOIN series s ON r.series_id = s.id
             WHERE r.id = $1`,
            [id, req.user?.id || null]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }
        
        const request = result.rows[0];
        
        // Obtener comentarios recientes
        const commentsResult = await query(
            `SELECT c.*, u.username, u.display_name, u.avatar_url
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.target_type = 'request' AND c.target_id = $1 
                   AND c.parent_id IS NULL AND c.status = 'visible'
             ORDER BY c.created_at DESC
             LIMIT 5`,
            [id]
        );
        
        res.json({
            success: true,
            data: {
                request: {
                    id: request.id,
                    title: request.title,
                    originalTitle: request.original_title,
                    description: request.description,
                    coverUrl: request.cover_url,
                    genres: request.genres,
                    status: request.status,
                    priority: request.priority,
                    progress: request.progress,
                    votes: request.votes_count,
                    commentsCount: request.comments_count,
                    userVoted: request.user_voted,
                    requestedBy: {
                        id: request.requested_by,
                        username: request.username,
                        displayName: request.display_name,
                        avatarUrl: request.avatar_url,
                        bio: request.user_bio
                    },
                    series: request.series_id ? {
                        id: request.series_id,
                        title: request.series_title,
                        slug: request.series_slug
                    } : null,
                    rejectionReason: request.rejection_reason,
                    reviewedAt: request.reviewed_at,
                    createdAt: request.created_at,
                    updatedAt: request.updated_at
                },
                recentComments: commentsResult.rows.map(c => ({
                    id: c.id,
                    content: c.content,
                    author: {
                        username: c.username,
                        displayName: c.display_name,
                        avatarUrl: c.avatar_url
                    },
                    likes: c.likes_count,
                    dislikes: c.dislikes_count,
                    createdAt: c.created_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Crear pedido
 * POST /api/requests
 */
const createRequest = async (req, res, next) => {
    try {
        const { title, originalTitle, description, coverUrl, genres } = req.body;
        
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Título requerido'
            });
        }
        
        // NOTE: Se permite crear pedidos aunque existan similares — permitir múltiples pedidos iguales.
        
        const result = await query(
            `INSERT INTO requests (title, original_title, description, cover_url, genres, requested_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, originalTitle, description, coverUrl, JSON.stringify(genres || []), req.user.id]
        );
        
        const request = result.rows[0];
        
        // Votar automáticamente por tu propio pedido
        await query(
            'INSERT INTO request_votes (user_id, request_id) VALUES ($1, $2)',
            [req.user.id, request.id]
        );
        
        // Registrar actividad
        await query(
            `INSERT INTO activities (user_id, action, target_type, target_id, metadata)
             VALUES ($1, 'create_request', 'request', $2, $3)`,
            [req.user.id, request.id, JSON.stringify({ title })]
        );
        
        res.status(201).json({
            success: true,
            message: 'Pedido creado',
            data: {
                request: {
                    id: request.id,
                    title: request.title,
                    votes: 1
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar pedido (propietario o permisos)
 * PUT /api/requests/:id
 */
const updateRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, originalTitle, description, coverUrl, genres } = req.body;

        // Obtener pedido actual
        const requestResult = await query('SELECT * FROM requests WHERE id = $1', [id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
        }

        const current = requestResult.rows[0];

        // Verificar permisos: propietario o permiso de gestión
        if (req.user.id !== current.requested_by && !hasPermission(req.user.role, 'requests:manage')) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para editar este pedido' });
        }

        // Construir valores para UPDATE
        const updatedTitle = typeof title === 'string' && title.trim() !== '' ? title.trim() : current.title;
        const updatedOriginal = typeof originalTitle === 'string' ? originalTitle.trim() : current.original_title;
        const updatedDesc = typeof description === 'string' ? description.trim() : current.description;
        const updatedCover = typeof coverUrl === 'string' ? coverUrl.trim() : current.cover_url;
        const updatedGenres = Array.isArray(genres) ? JSON.stringify(genres) : current.genres;

        const result = await query(
            `UPDATE requests SET title = $1, original_title = $2, description = $3, cover_url = $4, genres = $5, updated_at = NOW() WHERE id = $6 RETURNING *`,
            [updatedTitle, updatedOriginal, updatedDesc, updatedCover, updatedGenres, id]
        );

        res.json({ success: true, message: 'Pedido actualizado', data: { request: result.rows[0] } });
    } catch (error) {
        next(error);
    }
};

/**
 * Votar por un pedido
 * POST /api/requests/:id/vote
 */
const voteRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Verificar pedido existe
        const requestResult = await query(
            'SELECT id, status FROM requests WHERE id = $1',
            [id]
        );
        
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }
        
        const request = requestResult.rows[0];
        
        if (request.status === 'completed' || request.status === 'rejected') {
            return res.status(400).json({
                success: false,
                message: 'No puedes votar por un pedido cerrado'
            });
        }
        
        // Insertar voto y actualizar contador en una transacción
        const voteResult = await query(
            `INSERT INTO request_votes (user_id, request_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, request_id) DO NOTHING
             RETURNING user_id`,
            [req.user.id, id]
        );
        
        // Solo actualizar si realmente se insertó un voto nuevo
        if (voteResult.rows.length > 0) {
            await query(
                `UPDATE requests 
                 SET votes_count = (SELECT COUNT(*) FROM request_votes WHERE request_id = $1)
                 WHERE id = $1`,
                [id]
            );
        }
        
        // Obtener nuevo conteo y estado de voto
        const countResult = await query(
            `SELECT r.votes_count,
                    EXISTS(SELECT 1 FROM request_votes WHERE user_id = $2 AND request_id = $1) as user_voted
             FROM requests r WHERE r.id = $1`,
            [id, req.user.id]
        );
        
        res.json({
            success: true,
            message: 'Voto registrado',
            data: { 
                votes: countResult.rows[0].votes_count,
                userVoted: countResult.rows[0].user_voted
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Quitar voto de pedido
 * DELETE /api/requests/:id/vote
 */
const unvoteRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Eliminar voto
        const deleteResult = await query(
            'DELETE FROM request_votes WHERE user_id = $1 AND request_id = $2 RETURNING user_id',
            [req.user.id, id]
        );
        
        // Solo actualizar si realmente se eliminó un voto
        if (deleteResult.rows.length > 0) {
            await query(
                `UPDATE requests 
                 SET votes_count = (SELECT COUNT(*) FROM request_votes WHERE request_id = $1)
                 WHERE id = $1`,
                [id]
            );
        }
        
        // Obtener nuevo conteo y estado de voto
        const countResult = await query(
            `SELECT r.votes_count,
                    EXISTS(SELECT 1 FROM request_votes WHERE user_id = $2 AND request_id = $1) as user_voted
             FROM requests r WHERE r.id = $1`,
            [id, req.user.id]
        );
        
        res.json({
            success: true,
            message: 'Voto eliminado',
            data: { 
                votes: countResult.rows[0]?.votes_count || 0,
                userVoted: countResult.rows[0]?.user_voted || false
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Actualizar estado del pedido (Admin/Mod)
 * PUT /api/requests/:id/status
 */
const updateRequestStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, progress, rejectionReason, seriesId } = req.body;
        
        const validStatuses = ['pending', 'in_progress', 'completed', 'rejected'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido'
            });
        }
        
        // Obtener pedido actual
        const requestResult = await query(
            'SELECT * FROM requests WHERE id = $1',
            [id]
        );
        
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }
        
        const currentRequest = requestResult.rows[0];
        
        await query(
            `UPDATE requests 
             SET status = COALESCE($1, status),
                 progress = COALESCE($2, progress),
                 rejection_reason = $3,
                 series_id = $4,
                 reviewed_by = $5,
                 reviewed_at = NOW(),
                 updated_at = NOW()
             WHERE id = $6`,
            [status, progress, rejectionReason, seriesId, req.user.id, id]
        );
        
        // Notificar al usuario que hizo el pedido
        let notificationMessage;
        if (status === 'in_progress') {
            notificationMessage = `Tu pedido "${currentRequest.title}" está siendo procesado`;
        } else if (status === 'completed') {
            notificationMessage = `¡Tu pedido "${currentRequest.title}" ha sido completado!`;
        } else if (status === 'rejected') {
            notificationMessage = `Tu pedido "${currentRequest.title}" fue rechazado: ${rejectionReason || 'Sin razón especificada'}`;
        }
        
        if (notificationMessage) {
            await query(
                `INSERT INTO notifications (user_id, type, title, message, data, url)
                 VALUES ($1, 'request_update', 'Actualización de pedido', $2, $3, $4)`,
                [
                    currentRequest.requested_by,
                    notificationMessage,
                    JSON.stringify({ requestId: id, status }),
                    seriesId ? `/series/${seriesId}` : `/pedidos/${id}`
                ]
            );
        }
        
        // Registrar en audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
             VALUES ($1, 'update_request_status', 'request', $2, $3, $4, $5)`,
            [
                req.user.id,
                id,
                JSON.stringify({ status: currentRequest.status, progress: currentRequest.progress }),
                JSON.stringify({ status, progress, rejectionReason }),
                req.ip
            ]
        );
        
        res.json({
            success: true,
            message: 'Estado del pedido actualizado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar pedido (Admin)
 * DELETE /api/requests/:id
 */
const deleteRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Verificar pedido existe
        const requestResult = await query(
            'SELECT requested_by FROM requests WHERE id = $1',
            [id]
        );
        
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }
        
        const request = requestResult.rows[0];
        
        // Verificar permisos (solo admin o el creador pueden eliminar)
        if (request.requested_by !== req.user.id && !hasPermission(req.user.role, 'requests:delete')) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar este pedido'
            });
        }
        
        await query('DELETE FROM requests WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Pedido eliminado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener comentarios de un pedido
 * GET /api/requests/:id/comments
 */
const getRequestComments = async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const offset = (page - 1) * limit;
        
        // Verificar pedido existe
        const requestResult = await query(
            'SELECT id, comments_count FROM requests WHERE id = $1',
            [id]
        );
        
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pedido no encontrado'
            });
        }
        
        const request = requestResult.rows[0];
        
        const result = await query(
            `SELECT c.*, u.username, u.display_name, u.avatar_url, u.role as user_role
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.target_type = 'request' AND c.target_id = $1 
                   AND c.parent_id IS NULL AND c.status = 'visible'
             ORDER BY c.created_at DESC
             LIMIT $2 OFFSET $3`,
            [id, limit, offset]
        );
        
        // Obtener encuestas para cada comentario
        const comments = await Promise.all(result.rows.map(async (c) => {
            let poll = null;
            
            try {
                const pollResult = await query(
                    `SELECT cp.id as poll_id, cp.question, cp.total_votes,
                            (SELECT option_id FROM poll_votes WHERE poll_id = cp.id AND user_id = $2) as user_voted_option_id
                     FROM comment_polls cp 
                     WHERE cp.comment_id = $1`,
                    [c.id, req.user?.id || null]
                );
                
                if (pollResult.rows.length > 0) {
                    const pollInfo = pollResult.rows[0];
                    const pollId = pollInfo.poll_id;
                    
                    const optionsResult = await query(
                        'SELECT id, option_text, option_order, vote_count FROM poll_options WHERE poll_id = $1 ORDER BY option_order ASC',
                        [pollId]
                    );
                    
                    const userVoted = !!pollInfo.user_voted_option_id;
                    
                    poll = {
                        id: pollId,
                        question: pollInfo.question,
                        total_votes: pollInfo.total_votes,
                        user_voted: userVoted,
                        user_voted_option_id: pollInfo.user_voted_option_id,
                        options: optionsResult.rows.map(opt => ({
                            id: opt.id,
                            text: opt.option_text,
                            order: opt.option_order,
                            vote_count: userVoted ? opt.vote_count : null,
                            percentage: userVoted && pollInfo.total_votes > 0 
                                ? Math.round((opt.vote_count / pollInfo.total_votes) * 100)
                                : null
                        }))
                    };
                }
            } catch (pollErr) {
                console.warn('Error obteniendo encuesta del comentario', c.id, pollErr);
            }
            
            return {
                id: c.id,
                content: c.content,
                author: {
                    username: c.username,
                    displayName: c.display_name,
                    avatarUrl: c.avatar_url,
                    role: c.user_role
                },
                likes: c.likes_count,
                dislikes: c.dislikes_count,
                repliesCount: c.replies_count,
                poll: poll,
                createdAt: c.created_at
            };
        }));
        
        res.json({
            success: true,
            data: {
                comments: comments,
                pagination: {
                    page,
                    limit,
                    total: request.comments_count,
                    pages: Math.ceil(request.comments_count / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener o crear request para un capítulo específico
 * POST /api/requests/chapter
 * Body: { slug, chapterNum, title?, seriesTitle? }
 */
const getOrCreateChapterRequest = async (req, res, next) => {
    try {
        const { slug, chapterNum, title, seriesTitle } = req.body;
        
        if (!slug || !chapterNum) {
            return res.status(400).json({
                success: false,
                message: 'slug y chapterNum son requeridos'
            });
        }

        // Crear identificador único para este capítulo
        const chapterIdentifier = `chapter:${slug}:${chapterNum}`;
        
        // Buscar si ya existe un request para este capítulo
        // Usamos el campo description para almacenar el identificador
        let result = await query(
            `SELECT r.*, 
                    EXISTS(SELECT 1 FROM request_votes WHERE user_id = $1 AND request_id = r.id) as user_voted
             FROM requests r
             WHERE r.description = $2 AND r.status = 'completed'
             LIMIT 1`,
            [req.user?.id || null, chapterIdentifier]
        );

        if (result.rows.length > 0) {
            // Request ya existe, devolverlo
            return res.json({
                success: true,
                data: {
                    request: {
                        id: result.rows[0].id,
                        title: result.rows[0].title,
                        type: 'chapter',
                        slug: slug,
                        chapterNum: chapterNum,
                        votesCount: result.rows[0].votes_count,
                        commentsCount: result.rows[0].comments_count,
                        userVoted: result.rows[0].user_voted,
                        createdAt: result.rows[0].created_at
                    }
                }
            });
        }

        // No existe, crear uno nuevo
        // Buscar un usuario del sistema para crear requests automáticos
        let systemUserId = req.user?.id;
        
        if (!systemUserId) {
            // Buscar cualquier usuario del sistema (sin usar el enum de roles que puede variar)
            const systemUserResult = await query(
                `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`
            );
            
            if (systemUserResult.rows.length === 0) {
                // No hay usuarios en la BD, devolver error informativo
                return res.status(500).json({
                    success: false,
                    message: 'No se pudo crear el request automático: no hay usuarios en el sistema. Por favor, crea una cuenta primero.'
                });
            }
            
            systemUserId = systemUserResult.rows[0].id;
        }
        
        const requestTitle = title || `${seriesTitle || slug.replace(/-/g, ' ')} - Capítulo ${chapterNum}`;
        
        result = await query(
            `INSERT INTO requests (title, description, status, requested_by, progress)
             VALUES ($1, $2, 'completed', $3, 100)
             RETURNING *`,
            [requestTitle, chapterIdentifier, systemUserId]
        );

        const newRequest = result.rows[0];

        res.status(201).json({
            success: true,
            data: {
                request: {
                    id: newRequest.id,
                    title: newRequest.title,
                    type: 'chapter',
                    slug: slug,
                    chapterNum: chapterNum,
                    votesCount: 0,
                    commentsCount: 0,
                    userVoted: false,
                    createdAt: newRequest.created_at
                }
            }
        });
    } catch (error) {
        console.error('Error en getOrCreateChapterRequest:', error);
        next(error);
    }
};

module.exports = {
    listRequests,
    getRequest,
    updateRequest,
    createRequest,
    voteRequest,
    unvoteRequest,
    updateRequestStatus,
    deleteRequest,
    getRequestComments,
    getOrCreateChapterRequest
};
