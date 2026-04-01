/**
 * Presence Routes — online/offline en tiempo real via SSE
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

/** Notifica a todos los watchers de un userId su nuevo estado */
function broadcastPresence(app, userId, isOnline) {
    const watchers = (app.locals.presenceWatchers || []).filter(w => w.userId === userId);
    const payload = `data: ${JSON.stringify({ userId, online: isOnline })}\n\n`;
    watchers.forEach(w => {
        try { w.res.write(payload); } catch (_) { /* noop */ }
    });
}

/**
 * GET /api/presence/stream
 * SSE autenticado — mantiene al usuario marcado como online mientras la conexión vive.
 */
router.get('/stream', authenticate, (req, res) => {
    const app = req.app;
    const userId = req.user.id;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(': connected\n\n');

    // Inicializar set si es la primera pestaña del usuario
    if (!app.locals.onlineUsers.has(userId)) {
        app.locals.onlineUsers.set(userId, new Set());
        broadcastPresence(app, userId, true);
    }
    app.locals.onlineUsers.get(userId).add(res);

    // Heartbeat cada 25s para mantener la conexión viva
    const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (_) { clearInterval(heartbeat); }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        const conns = app.locals.onlineUsers.get(userId);
        if (conns) {
            conns.delete(res);
            if (conns.size === 0) {
                app.locals.onlineUsers.delete(userId);
                broadcastPresence(app, userId, false);
            }
        }
    });
});

/**
 * GET /api/presence/:userId
 * Devuelve el estado online actual de un usuario (REST).
 */
router.get('/:userId', (req, res) => {
    const app = req.app;
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'userId inválido' });
    const online = app.locals.onlineUsers.has(userId);
    res.json({ success: true, userId, online });
});

/**
 * GET /api/presence/:userId/watch
 * SSE — emite {userId, online} cada vez que el estado del usuario cambia.
 * Envía el estado actual inmediatamente al conectar.
 */
router.get('/:userId/watch', (req, res) => {
    const app = req.app;
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).end();

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Estado actual inmediato
    const isOnline = app.locals.onlineUsers.has(userId);
    res.write(`data: ${JSON.stringify({ userId, online: isOnline })}\n\n`);

    const watcher = { userId, res, connectedAt: Date.now() };
    app.locals.presenceWatchers.push(watcher);

    const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch (_) { clearInterval(heartbeat); }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        app.locals.presenceWatchers = app.locals.presenceWatchers.filter(w => w !== watcher);
    });
});

module.exports = router;
