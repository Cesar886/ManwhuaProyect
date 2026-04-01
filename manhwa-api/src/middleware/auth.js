/**
 * Middleware de Autenticación
 * OPTIMIZADO: Cache de usuarios en memoria para reducir queries a la BD
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// CACHE DE USUARIOS EN MEMORIA
// Reduce queries repetitivas de autenticación
// ============================================
const USER_CACHE_CONFIG = {
    // TTL del cache: 60 segundos (balance entre freshness y performance)
    ttl: parseInt(process.env.AUTH_CACHE_TTL_MS) || 60000,
    // Máximo de usuarios en cache
    maxSize: parseInt(process.env.AUTH_CACHE_MAX_SIZE) || 500,
    // Intervalo de limpieza: cada 5 minutos
    cleanupInterval: 300000
};

// Cache simple con Map
const userCache = new Map();

// Métricas del cache
let cacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0
};

/**
 * Obtener usuario del cache o BD
 */
const getUserFromCacheOrDb = async (userId) => {
    const cacheKey = `user:${userId}`;
    const cached = userCache.get(cacheKey);
    
    // Verificar si está en cache y es válido
    if (cached && (Date.now() - cached.timestamp) < USER_CACHE_CONFIG.ttl) {
        cacheMetrics.hits++;
        return cached.data;
    }
    
    cacheMetrics.misses++;
    
    // Query a la BD (campos optimizados - solo los necesarios)
    const result = await query(
        `SELECT id, username, email, display_name, avatar_url, role, status,
                is_premium, premium_until, email_verified_at, experience
         FROM users
         WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
    );
    
    if (result.rows.length === 0) {
        return null;
    }
    
    const user = result.rows[0];
    
    // Guardar en cache
    if (userCache.size >= USER_CACHE_CONFIG.maxSize) {
        // Evictar el más antiguo
        const oldestKey = userCache.keys().next().value;
        userCache.delete(oldestKey);
        cacheMetrics.evictions++;
    }
    
    userCache.set(cacheKey, {
        data: user,
        timestamp: Date.now()
    });
    
    return user;
};

/**
 * Invalidar cache de un usuario específico
 */
const invalidateUserCache = (userId) => {
    userCache.delete(`user:${userId}`);
};

/**
 * Limpiar cache expirado periódicamente
 */
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of userCache.entries()) {
        if ((now - value.timestamp) > USER_CACHE_CONFIG.ttl) {
            userCache.delete(key);
            cleaned++;
        }
    }
    
    if (cleaned > 0 && process.env.NODE_ENV === 'development') {
        logger.info(`🧹 Auth cache: ${cleaned} entradas limpiadas (total: ${userCache.size})`);
    }
}, USER_CACHE_CONFIG.cleanupInterval);

/**
 * Verificar token JWT y añadir usuario a req
 * OPTIMIZADO: Usa cache de usuarios
 */
const authenticate = async (req, res, next) => {
    try {
        // Obtener token del header o cookie
        let token = null;
        
        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Acceso denegado. Token no proporcionado.'
            });
        }
        
        // Verificar token (operación rápida, sin I/O)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Obtener usuario del cache o BD
        const user = await getUserFromCacheOrDb(decoded.userId);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        // Verificar estado del usuario
        if (user.status === 'banned') {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta ha sido suspendida'
            });
        }
        
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Tu cuenta está temporalmente suspendida'
            });
        }
        
        // Verificar si el premium ha expirado
        if (user.is_premium && user.premium_until && new Date(user.premium_until) < new Date()) {
            // ✅ SOLUCIÓN: Actualizar inmediatamente en memoria para esta request
            user.is_premium = false;
            invalidateUserCache(user.id);
            
            // Actualizar BD en background (no bloquear respuesta)
            // Promise con manejo robusto: garantiza consistencia eventual
            query('UPDATE users SET is_premium = false WHERE id = $1', [user.id])
                .then(() => {
                        logger.info(`✅ Premium expirado actualizado para usuario ${user.id}`);
                    })
                    .catch(err => {
                        logger.error(`❌ ERROR CRÍTICO actualizando premium usuario ${user.id}:`, err);
                    // TODO: Enviar a sistema de monitoreo (Sentry/CloudWatch)
                    // La inconsistencia se resolverá en próxima autenticación (cache invalidado)
                });
        }
        
        // Timezone del cliente (enviado como header por el frontend)
        const clientTimezone = req.headers['x-timezone'] || null;

        // Añadir usuario a la request
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            role: user.role,
            status: user.status,
            isPremium: user.is_premium,
            isVerified: !!user.email_verified_at,
            experience: parseInt(user.experience) || 0,
            timezone: clientTimezone
        };
        
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        logger.error('Error en autenticación:', error);
        return res.status(500).json({
            success: false,
            message: 'Error de autenticación'
        });
    }
};

/**
 * Autenticación opcional - no falla si no hay token
 * OPTIMIZADO: Usa cache de usuarios
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token = null;
        
        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Usar cache de usuarios
        const user = await getUserFromCacheOrDb(decoded.userId);
        
        if (user && user.status === 'active') {
            req.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name,
                avatarUrl: user.avatar_url,
                role: user.role,
                status: user.status,
                isPremium: user.is_premium,
                isVerified: !!user.email_verified_at,
                experience: parseInt(user.experience) || 0
            };
        } else {
            req.user = null;
        }
        
        next();
    } catch (error) {
        // En autenticación opcional, ignorar errores de token
        req.user = null;
        next();
    }
};

/**
 * Generar tokens JWT
 */
const generateTokens = (userId) => {
    if (!process.env.JWT_REFRESH_SECRET) {
        logger.warn('JWT_REFRESH_SECRET no definido. Defínelo en .env para máxima seguridad.');
    }

    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    return { accessToken, refreshToken };
};

/**
 * Verificar refresh token
 */
const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );
        
        if (decoded.type !== 'refresh') {
            return null;
        }
        
        return decoded;
    } catch (error) {
        return null;
    }
};

/**
 * Obtener estadísticas del cache de autenticación (útil para monitoreo)
 */
const getAuthCacheStats = () => ({
    size: userCache.size,
    maxSize: USER_CACHE_CONFIG.maxSize,
    ttl: USER_CACHE_CONFIG.ttl,
    ...cacheMetrics,
    hitRate: cacheMetrics.hits + cacheMetrics.misses > 0 
        ? (cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses) * 100).toFixed(1) + '%'
        : 'N/A'
});

module.exports = {
    authenticate,
    optionalAuth,
    generateTokens,
    verifyRefreshToken,
    // Nuevas funciones para manejo de cache
    invalidateUserCache,
    getAuthCacheStats,
    USER_CACHE_CONFIG
};
