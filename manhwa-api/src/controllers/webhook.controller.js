/**
 * Controlador para Webhooks (ej. reacciones de comentarios via webhook)
 */

const { query } = require('../config/database');

const commentReaction = async (req, res, next) => {
    try {
        const { commentId, action, targetType, targetId } = req.body || {};
        if (!commentId || !action) return res.status(400).json({ success: false, message: 'Faltan parámetros' });

        const id = commentId;

        if (!['like', 'dislike', 'remove'].includes(action)) return res.status(400).json({ success: false, message: 'Acción no válida' });

        if (action === 'like') {
            await query(
                `INSERT INTO comment_votes (user_id, comment_id, vote_type)
                 VALUES ($1, $2, 1)
                 ON CONFLICT (user_id, comment_id) DO UPDATE SET vote_type = 1, created_at = NOW()`,
                [req.user.id, id]
            );
        } else if (action === 'dislike') {
            await query(
                `INSERT INTO comment_votes (user_id, comment_id, vote_type)
                 VALUES ($1, $2, -1)
                 ON CONFLICT (user_id, comment_id) DO UPDATE SET vote_type = -1, created_at = NOW()`,
                [req.user.id, id]
            );
        } else if (action === 'remove') {
            await query('DELETE FROM comment_votes WHERE user_id = $1 AND comment_id = $2', [req.user.id, id]);
        }

        // Recalcular y persistir totales
        const likesRes = await query('SELECT COUNT(*)::int AS likes FROM comment_votes WHERE comment_id = $1 AND vote_type = 1', [id]);
        const dislikesRes = await query('SELECT COUNT(*)::int AS dislikes FROM comment_votes WHERE comment_id = $1 AND vote_type = -1', [id]);
        const likes = likesRes.rows[0]?.likes || 0;
        const dislikes = dislikesRes.rows[0]?.dislikes || 0;
        await query('UPDATE comments SET likes_count = $1, dislikes_count = $2 WHERE id = $3', [likes, dislikes, id]);

        // Emitir SSE a clientes
        try {
            const clients = req.app && req.app.locals && req.app.locals.sseClients ? req.app.locals.sseClients : [];
            const payload = JSON.stringify({ commentId: id, likesCount: likes, dislikesCount: dislikes, userId: req.user.id, action, viewerReaction: action === 'remove' ? null : action });
            clients.forEach(c => {
                try {
                    c.res.write(`event: comment.reaction\n`)
                    c.res.write(`data: ${payload}\n\n`)
                } catch (e) { /* noop */ }
            })
        } catch (e) { console.warn('Error broadcasting webhook reaction SSE', e && e.message) }

        res.json({ success: true, message: 'Reacción procesada', data: { likesCount: likes, dislikesCount: dislikes } });
    } catch (error) {
        next(error);
    }
}

module.exports = { commentReaction };
