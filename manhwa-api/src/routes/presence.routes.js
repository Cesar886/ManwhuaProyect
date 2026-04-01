/**
 * Presence Routes — online/offline en tiempo real via SSE
 */

const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');

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

/* ============================================================
   LECTORES DE CAPÍTULO EN TIEMPO REAL
   ============================================================ */

/** Serializa el set de lectores de un capítulo para enviar por SSE */
function buildReadersPayload(app, key) {
    const set = app.locals.chapterReaders.get(key);
    if (!set || set.size === 0) return { count: 0, readers: [] };
    const readers = [...set].map(r => ({
        userId:      r.userId,
        username:    r.username,
        displayName: r.displayName,
        avatarUrl:   r.avatarUrl || null,
    }));
    return { count: readers.length, readers };
}

/** Envía el estado actual al cliente SSE dado */
function sendReadersTo(res, payload) {
    try { 
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
    } catch (err) {
        console.warn('[ChapterReaders] Error enviando datos:', err.message);
    }
}

/** Broadcast a todos los lectores del mismo capítulo */
function broadcastChapterReaders(app, key) {
    const payload = buildReadersPayload(app, key);
    const set = app.locals.chapterReaders.get(key);
    if (!set) return;
    
    console.log(`[ChapterReaders] 📢 Broadcasting a ${set.size} conexiones`);
    console.log(`[ChapterReaders] 📦 Payload:`, payload.readers.map(r => r.username));
    
    const deadConnections = [];
    let sent = 0;
    for (const r of set) {
        if (r.res.writableEnded) {
            deadConnections.push(r);
        } else {
            sendReadersTo(r.res, payload);
            sent++;
            console.log(`[ChapterReaders] ✉️ Enviado a: ${r.username}`);
        }
    }
    
    console.log(`[ChapterReaders] ✅ Broadcast completado: ${sent} enviados, ${deadConnections.length} muertos`);
    
    // Limpiar conexiones muertas
    if (deadConnections.length > 0) {
        for (const dead of deadConnections) {
            set.delete(dead);
        }
    }
}

/**
 * GET /api/presence/chapter/:slug/:numero/stream
 * SSE — emite en tiempo real quién está leyendo este capítulo.
 * Usuarios autenticados se añaden a la lista; anónimos solo escuchan.
 */
router.get('/chapter/:slug/:numero/stream', optionalAuth, (req, res) => {
    const app = req.app;
    const key = `${req.params.slug}_${req.params.numero}`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders(); // Enviar headers inmediatamente

    // Enviar estado actual inmediatamente
    sendReadersTo(res, buildReadersPayload(app, key));

    let reader = null;

    if (req.user) {
        // Inicializar set si es el primer lector de este capítulo
        if (!app.locals.chapterReaders.has(key)) {
            app.locals.chapterReaders.set(key, new Set());
        }
        
        // Validar datos del usuario antes de crear el reader
        if (!req.user.id || !req.user.username) {
            console.warn('[ChapterReaders] Usuario sin ID o username:', req.user);
        } else {
            reader = {
                userId:      req.user.id,
                username:    req.user.username,
                displayName: req.user.displayName || req.user.username,
                avatarUrl:   req.user.avatarUrl || null,
                res,
                connectedAt: Date.now(),
            };
            
            app.locals.chapterReaders.get(key).add(reader);
            
            console.log(`[ChapterReaders] ✅ Usuario agregado: ${reader.username} → ${key}`);
            console.log(`[ChapterReaders] 📊 Total lectores ahora: ${app.locals.chapterReaders.get(key).size}`);
            console.log(`[ChapterReaders] 📋 Lista actual:`, [...app.locals.chapterReaders.get(key)].map(r => r.username));
            
            // Notificar a todos (incluido el recién llegado)
            broadcastChapterReaders(app, key);
        }
    } else {
        console.log(`[ChapterReaders] Anónimo conectado → ${key}`);
    }

    // Heartbeat cada 25s para mantener conexión viva
    const heartbeat = setInterval(() => {
        try { 
            res.write(': ping\n\n'); 
        } catch (err) { 
            clearInterval(heartbeat);
            console.warn(`[ChapterReaders] Heartbeat failed → ${key}`);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        if (reader) {
            const set = app.locals.chapterReaders.get(key);
            if (set) {
                set.delete(reader);
                
                if (set.size === 0) {
                    app.locals.chapterReaders.delete(key);
                } else {
                    broadcastChapterReaders(app, key);
                }
            }
        }
    });
});

module.exports = router;
