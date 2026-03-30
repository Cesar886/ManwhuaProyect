/**
 * MANHWA API - Servidor Principal
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { pool, testConnection } = require('./config/database');
const { authenticate } = require('./middleware/auth');
const { requireRole } = require('./middleware/authorize');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { requireValidOrigin, isAllowedSearchBot } = require('./middleware/security');
const logger = require('./utils/logger');
const { startIndexingDaemon, stopIndexingDaemon } = require('./services/googleIndexing');
const { startIndexNowDaemon, stopIndexNowDaemon } = require('./services/indexNowDaemon');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const seriesRoutes = require('./routes/series.routes');
const chapterRoutes = require('./routes/chapter.routes');
const commentRoutes = require('./routes/comment.routes');
const webhookRoutes = require('./routes/webhook.routes');
const collectionRoutes = require('./routes/collection.routes');
const requestRoutes = require('./routes/request.routes');
const bookmarkRoutes = require('./routes/bookmark.routes');
const genreRoutes = require('./routes/genre.routes');
const searchRoutes = require('./routes/search.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');
const spacesRoutes = require('./routes/spaces.routes');
const progressRoutes = require('./routes/progress.routes');
const donationRoutes = require('./routes/donation.routes');


const app = express();
// Permitir confianza solo en el primer proxy (más seguro)
app.set('trust proxy', 1);

// Lista de clientes SSE conectados (comentarios)
app.locals.sseClients = []

// Lista de clientes SSE para actualizaciones de racha (por usuario)
app.locals.streakClients = []

// ============================================
// CONFIGURACIÓN DE SEGURIDAD
// ============================================

// Helmet - Headers de seguridad
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
        }
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: "deny" }
}));

// Limpiar headers CORS duplicados de CDN/proxy
app.use((req, res, next) => {
    res.removeHeader('Access-Control-Allow-Origin');
    res.removeHeader('Access-Control-Allow-Methods');
    res.removeHeader('Access-Control-Allow-Headers');
    res.removeHeader('Access-Control-Allow-Credentials');
    next();
});

// Configuración CORS
const allowedOrigins = [
    'https://manhwaimperial.site',
    'https://www.manhwaimperial.site',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Requests sin Origin (server-to-server) no están sujetos a CORS en el navegador.
        // La protección real contra acceso no autorizado es JWT, no CORS.
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'x-api-key'],
    exposedHeaders: ['Content-Type', 'Cache-Control', 'ETag']
}));

// Middleware de seguridad estricta para Origin/Referer
app.use((req, res, next) => {
    // Excluir webhooks, callback de auth y assets estáticos si los hay
    if (req.path.startsWith('/webhooks') || req.path.includes('/auth/callback')) return next();

    // CAMBIO: Permitir crawlers de motores de búsqueda legítimos (Googlebot, Bingbot, etc.)
    // Sin esto, los crawlers que no envían Origin/Referer recibían 403 en producción.
    const ua = req.headers['user-agent'] || '';
    if (isAllowedSearchBot(ua)) return next();

    // Permitir acceso a imágenes/recursos públicos sin validación estricta de origen
    if (req.method === 'GET' && !req.path.startsWith('/api/admin')) return next();

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // Verificar si el origen o referer coinciden con los permitidos
    // Usamos allowedOrigins definido arriba para consistencia
    const isAllowedOrigin = origin && allowedOrigins.some(domain => origin === domain || origin.startsWith(domain));
    const isAllowedReferer = referer && allowedOrigins.some(domain => referer.startsWith(domain));

    // Si hay Origin, debe ser válido
    if (origin && !isAllowedOrigin) {
        return res.status(403).json({ 
            success: false, 
            message: 'Origen no permitido',
            code: 'INVALID_ORIGIN'
        });
    }

    // Para métodos mutables (POST, PUT, DELETE, PATCH), EXIGIR Origin o Referer válido
    // Esto previene ataques CSRF y uso no autorizado de la API desde herramientas externas
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        if (!isAllowedOrigin && !isAllowedReferer) {
            // Permitir localhost/Postman solo en desarrollo si es necesario, 
            // pero en producción bloquear si no hay origin/referer válido.
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Acceso denegado: Se requiere origen válido para esta operación',
                    code: 'MISSING_ORIGIN'
                });
            }
        }
    }

    next();
});

// Proteccion adicional de Origen/Referer
app.use(requireValidOrigin);

// Rate limiting general
// CAMBIO: Se agrega skip para crawlers de motores de búsqueda.
// El rate limit de 100 req/15min bloqueaba el crawleo masivo de Googlebot
// y también los SSR fetches internos desde localhost cuando Google
// rastreaba muchas páginas simultáneamente.
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        success: false,
        message: 'Demasiadas peticiones, intenta de nuevo más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Eximir crawlers legítimos
        if (isAllowedSearchBot(req.headers['user-agent'] || '')) return true;
        // Eximir SSR internos (Next.js en localhost) que usan API key válida
        const apiKey = req.headers['x-api-key'];
        if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) return true;
        return false;
    }
});
app.use('/api/', limiter);

// Rate limiting estricto para auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Demasiados intentos de autenticación'
    }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Rate limiting para búsqueda (anti-scraping)
const searchLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: {
        success: false,
        message: 'Demasiadas búsquedas, intenta de nuevo en un momento'
    }
});
app.use('/api/search', searchLimiter);

// Rate limiting anti-scraping para catálogo de series y spaces
// CAMBIO: Se agrega skip para crawlers legítimos.
// El límite de 40 req/min combinado con keyGenerator que usa IP+UA
// bloqueaba tanto a Googlebot directo como a los SSR fetches internos.
const catalogLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: parseInt(process.env.CATALOG_RATE_LIMIT) || 40, // 40 req/min
    message: {
        success: false,
        message: 'Demasiadas peticiones al catálogo. Intenta de nuevo en un momento.',
        code: 'RATE_LIMITED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Usar IP + User-Agent para dificultar rotación de IPs
        return `${req.ip}-${(req.get('User-Agent') || 'unknown').slice(0, 50)}`;
    },
    skip: (req) => {
        if (isAllowedSearchBot(req.headers['user-agent'] || '')) return true;
        const apiKey = req.headers['x-api-key'];
        if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) return true;
        return false;
    }
});
app.use('/api/series', catalogLimiter);
app.use('/api/spaces', catalogLimiter);

// Rate limiting para reset de password (anti email bombing)
const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Demasiadas solicitudes de restablecimiento de contraseña'
    }
});
app.use('/api/auth/forgot-password', passwordResetLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);

// Rate limiting para uploads (anti abuso)
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: {
        success: false,
        message: 'Demasiadas subidas, intenta de nuevo más tarde'
    }
});
app.use('/api/upload', uploadLimiter);

// ============================================
// MIDDLEWARE GENERAL
// ============================================

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// ============================================
// RUTAS DE LA API
// ============================================

app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Manhwa API v1.0',
        version: '1.0.0'
    });
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy'
        });
    }
});

// Monitoreo detallado — solo admins autenticados
app.get('/api/health/detailed', authenticate, requireRole('admin'), async (req, res) => {
    try {
        const { getPoolStats } = require('./config/database');
        const { getAuthCacheStats } = require('./middleware/auth');
        const spacesController = require('./controllers/spaces.controller');

        const dbStart = Date.now();
        await pool.query('SELECT 1');
        const dbLatency = Date.now() - dbStart;

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
            },
            database: {
                status: 'connected',
                latency: dbLatency + 'ms',
                pool: getPoolStats()
            },
            caches: {
                auth: getAuthCacheStats(),
                spaces: spacesController.getCacheStats()
            },
            sse: {
                spacesClients: app.locals.spacesClients?.length || 0,
                commentClients: app.locals.sseClients?.length || 0,
                streakClients: app.locals.streakClients?.length || 0
            }
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: 'Health check failed'
        });
    }
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/chapters', chapterRoutes);

// SSE endpoint para comentarios en tiempo real (con límite de conexiones)
const MAX_SSE_CLIENTS = 200;
app.get('/api/comments/stream', (req, res) => {
    if (app.locals.sseClients.length >= MAX_SSE_CLIENTS) {
        return res.status(503).json({
            success: false,
            message: 'Demasiadas conexiones activas'
        });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')

    res.write(': connected\n\n')

    const client = { id: Date.now() + Math.random(), res, connectedAt: Date.now() }
    app.locals.sseClients.push(client)

    req.on('close', () => {
        try {
            app.locals.sseClients = app.locals.sseClients.filter(c => c !== client)
        } catch (e) { /* noop */ }
    })
});

app.use('/api/comments', commentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/genres', genreRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/donations', donationRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use(notFound);
app.use(errorHandler);

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await testConnection();

        app.listen(PORT, () => {
            logger.info(`MANHWA API v1.0 - Servidor corriendo en http://localhost:${PORT} - Entorno: ${process.env.NODE_ENV || 'development'}`);

            const spacesController = require('./controllers/spaces.controller');
            spacesController.preloadCache();
            spacesController.startAutoPreload();

            // Iniciar daemons de indexación
            startIndexingDaemon();
            startIndexNowDaemon();

            // Limpieza periódica de clientes SSE zombie
            const SSE_CLIENT_TIMEOUT = 15 * 60 * 1000;
            setInterval(() => {
                const now = Date.now();
                let zombiesRemoved = 0;

                if (app.locals.spacesClients?.length > 0) {
                    const beforeCount = app.locals.spacesClients.length;
                    app.locals.spacesClients = app.locals.spacesClients.filter(client => {
                        const age = now - (client.lastActivity || client.connectedAt);
                        if (age > SSE_CLIENT_TIMEOUT) {
                            return false;
                        }
                        return true;
                    });
                    zombiesRemoved += beforeCount - app.locals.spacesClients.length;
                }

                if (app.locals.sseClients?.length > 0) {
                    const beforeCount = app.locals.sseClients.length;
                    app.locals.sseClients = app.locals.sseClients.filter(client => {
                        const age = now - (client.connectedAt || now);
                        if (age > SSE_CLIENT_TIMEOUT) {
                            return false;
                        }
                        return true;
                    });
                    zombiesRemoved += beforeCount - app.locals.sseClients.length;
                }

                if (app.locals.streakClients?.length > 0) {
                    const beforeCount = app.locals.streakClients.length;
                    app.locals.streakClients = app.locals.streakClients.filter(client => {
                        const age = now - (client.connectedAt || now);
                        return age <= SSE_CLIENT_TIMEOUT;
                    });
                    zombiesRemoved += beforeCount - app.locals.streakClients.length;
                }

                try {
                    const { getUpdateClientsMap } = spacesController;
                    if (getUpdateClientsMap) {
                        const updateClientsMap = getUpdateClientsMap();
                        if (updateClientsMap && updateClientsMap.size > 0) {
                            for (const [clientId, client] of updateClientsMap.entries()) {
                                const age = now - (client.lastActivity || client.connectedAt);
                                if (age > SSE_CLIENT_TIMEOUT) {
                                    updateClientsMap.delete(clientId);
                                    zombiesRemoved++;
                                }
                            }
                        }
                    }
                } catch (e) { /* noop */ }

                if (zombiesRemoved > 0) {
                    logger.info(`Limpieza SSE: ${zombiesRemoved} clientes zombie eliminados`);
                }
            }, 60000);
        });
    } catch (error) {
        console.error('Error iniciando servidor:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
const shutdown = (signal) => {
    logger.info(`${signal} recibido. Cerrando servidor...`);
    stopIndexingDaemon();
    stopIndexNowDaemon();
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
