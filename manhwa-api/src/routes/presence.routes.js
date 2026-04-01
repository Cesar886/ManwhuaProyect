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

/* ============================================================
   LECTORES DE CAPÍTULO EN TIEMPO REAL
   ============================================================ */

/** Serializa el set de lectores para enviar por SSE (deduplicado por userId) */
function buildReadersPayloadFromSet(set) {
    if (!set || set.size === 0) return { count: 0, readers: [] };
    
    const uniqueReaders = new Map();
    for (const r of set) {
        // Validación estricta
        if (!r || typeof r !== 'object') continue;
        if (!r.userId && !r.username) continue;
        
        // Deduplicación por userId primero (más confiable)
        const userKey = r.userId ? String(r.userId) : String(r.username || '');
        if (!userKey || !userKey.trim()) continue;
        
        // Si ya existe este usuario, solo actualizar si es más reciente
        if (uniqueReaders.has(userKey)) {
            const existing = uniqueReaders.get(userKey);
            if (r.connectedAt && existing.connectedAt && r.connectedAt > existing.connectedAt) {
                uniqueReaders.set(userKey, {
                    userId:      r.userId || existing.userId,
                    username:    r.username || existing.username,
                    displayName: r.displayName || existing.displayName,
                    avatarUrl:   r.avatarUrl || existing.avatarUrl || null,
                });
            }
            continue;
        }
        
        uniqueReaders.set(userKey, {
            userId:      r.userId,
            username:    r.username,
            displayName: r.displayName || r.username,
            avatarUrl:   r.avatarUrl || null,
        });
    }
    
    const readers = [...uniqueReaders.values()];
    return { count: readers.length, readers };
}

/** Serializa lectores desde un map de presencia y una key */
function buildReadersPayload(app, mapName, key) {
    const set = app.locals[mapName]?.get(key);
    return buildReadersPayloadFromSet(set);
}

/** Envía el estado actual al cliente SSE dado */
function sendReadersTo(res, payload) {
    try { 
        // Verificar múltiples estados de muerte de conexión
        if (!res || res.writableEnded || res.destroyed || !res.writable) {
            return false;
        }
        
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        return true;
    } catch (err) {
        // Silencial pero marca como falla
        return false;
    }
}

/** Broadcast a todos los lectores del mismo capítulo/manhwa con limpieza de muertos */
function broadcastReaders(app, mapName, key) {
    const payload = buildReadersPayload(app, mapName, key);
    const set = app.locals[mapName]?.get(key);
    if (!set) return;

    const deadConnections = [];
    let successCount = 0;
    
    for (const r of set) {
        // Verificar si la conexión está muerta antes de enviar
        if (!r.res || r.res.writableEnded || r.res.destroyed) {
            deadConnections.push(r);
        } else {
            if (sendReadersTo(r.res, payload)) {
                successCount++;
            } else {
                deadConnections.push(r);
            }
        }
    }

    // Limpiar conexiones muertas inmediatamente
    if (deadConnections.length > 0) {
        for (const dead of deadConnections) {
            set.delete(dead);
        }
        // Si quedan lectores, actualizar a los vivos
        if (set.size > 0) {
            const updatedPayload = buildReadersPayloadFromSet(set);
            for (const r of set) {
                if (r.res && !r.res.writableEnded && r.res.writable) {
                    sendReadersTo(r.res, updatedPayload);
                }
            }
        }
    }
}

function broadcastChapterReaders(app, key) {
    broadcastReaders(app, 'chapterReaders', key);
}

function broadcastManhwaReaders(app, slug) {
    const payload = buildReadersPayload(app, 'manhwaReaders', slug);
    
    // Enviar a los readers (gente leyendo capítulos)
    broadcastReaders(app, 'manhwaReaders', slug);
    
    // Enviar a los watchers de detalles con limpieza de muertos
    const watchers = app.locals.manhwaDetailWatchers?.get(slug);
    if (watchers && watchers.size > 0) {
        const deadWatchers = [];
        let successCount = 0;
        
        for (const w of watchers) {
            // Detección agresiva de conexiones muertas
            if (!w.res || w.res.writableEnded || w.res.destroyed) {
                deadWatchers.push(w);
            } else {
                if (sendReadersTo(w.res, payload)) {
                    successCount++;
                } else {
                    deadWatchers.push(w);
                }
            }
        }
        
        // Limpiar conexiones muertas inmediatamente
        if (deadWatchers.length > 0) {
            for (const dead of deadWatchers) {
                watchers.delete(dead);
            }
            // Si no quedan watchers, eliminar el mapping completo
            if (watchers.size === 0) {
                app.locals.manhwaDetailWatchers.delete(slug);
            }
        }
    }
}

/**
 * GET /api/presence/chapter/:slug/:numero/stream
 * SSE — emite en tiempo real quién está leyendo este capítulo.
 * Solo usuarios autenticados pueden conectarse y ver lectores.
 */
router.get('/chapter/:slug/:numero/stream', authenticate, (req, res) => {
    const app = req.app;
    const slug = req.params.slug;
    const key = `${req.params.slug}_${req.params.numero}`;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders(); // Enviar headers inmediatamente

    // Enviar estado actual inmediatamente
    sendReadersTo(res, buildReadersPayload(app, 'chapterReaders', key));

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

            if (!app.locals.manhwaReaders.has(slug)) {
                app.locals.manhwaReaders.set(slug, new Set());
            }
            app.locals.manhwaReaders.get(slug).add(reader);

            // Notificar a todos (incluido el recién llegado)
            broadcastChapterReaders(app, key);
            broadcastManhwaReaders(app, slug);
        }
    }

    // Heartbeat cada 25s para mantener conexión viva
    const heartbeat = setInterval(() => {
        try { 
            res.write(': ping\n\n'); 
        } catch (err) { 
            clearInterval(heartbeat);
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

            const manhwaSet = app.locals.manhwaReaders.get(slug);
            if (manhwaSet) {
                manhwaSet.delete(reader);
                if (manhwaSet.size === 0) {
                    app.locals.manhwaReaders.delete(slug);
                }
                // Siempre broadcast cuando alguien se desconecta, incluso si queda vacío
                broadcastManhwaReaders(app, slug);
            }
        }
    });
});

/**
 * GET /api/presence/manhwa/:slug/list
 * Endpoint REST de polling — devuelve la lista actual de readers
 * Útil como fallback si la conexión SSE falla
 */
router.get('/manhwa/:slug/list', authenticate, (req, res) => {
    const app = req.app;
    const slug = req.params.slug;
    
    const payload = buildReadersPayload(app, 'manhwaReaders', slug);
    res.json(payload);
});

/**
 * GET /api/presence/chapter/:slug/:numero/list
 * Endpoint REST de polling — devuelve la lista actual de readers del capítulo
 */
router.get('/chapter/:slug/:numero/list', authenticate, (req, res) => {
    const app = req.app;
    const key = `${req.params.slug}_${req.params.numero}`;
    
    const payload = buildReadersPayload(app, 'chapterReaders', key);
    res.json(payload);

/**
 * GET /api/presence/manhwa/:slug/stream
 * SSE — emite en tiempo real quién está leyendo este manhwa (solo lectores de capítulos).
 * Solo escucha, NO agrega al usuario a la lista — los lectores vienen de capítulos que el usuario abre.
 * Solo usuarios autenticados pueden conectarse.
 */
router.get('/manhwa/:slug/stream', authenticate, (req, res) => {
    const app = req.app;
    const slug = req.params.slug;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Enviar estado actual inmediatamente
    sendReadersTo(res, buildReadersPayload(app, 'manhwaReaders', slug));

    // Registrar este watcher para recibir broadcasts
    if (!app.locals.manhwaDetailWatchers.has(slug)) {
        app.locals.manhwaDetailWatchers.set(slug, new Set());
    }
    
    const watcher = { res, connectedAt: Date.now() };
    app.locals.manhwaDetailWatchers.get(slug).add(watcher);

    // Heartbeat cada 25s para mantener conexión viva
    const heartbeat = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch (_) {
            clearInterval(heartbeat);
        }
    }, 25000);

    // Limpiar cuando el cliente se desconecta
    req.on('close', () => {
        clearInterval(heartbeat);
        const watchers = app.locals.manhwaDetailWatchers.get(slug);
        if (watchers) {
            watchers.delete(watcher);
            if (watchers.size === 0) {
                app.locals.manhwaDetailWatchers.delete(slug);
            }
        }
    });
});

module.exports = router;
