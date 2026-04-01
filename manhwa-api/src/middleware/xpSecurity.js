/**
 * Middleware de Seguridad para Sistema de XP
 * Previene farming, abuse, y manipulación del sistema
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Detectar patrones sospechosos de farming de XP
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} { isSuspicious, reason, severity }
 */
async function detectXpFarming(userId) {
    try {
        // 1. Verificar lectura excesivamente rápida en ventana corta
        const rapidReadingCheck = await query(
            `SELECT COUNT(*) as count
             FROM user_xp_history
             WHERE user_id = $1 
               AND created_at > NOW() - INTERVAL '5 minutes'
               AND reason = 'chapter_complete'`,
            [userId]
        );

        const recentReads = parseInt(rapidReadingCheck.rows[0]?.count) || 0;
        
        // Más de 10 capítulos en 5 minutos es sospechoso (incluso al límite mínimo de 90s)
        if (recentReads > 10) {
            return {
                isSuspicious: true,
                reason: 'Lectura excesivamente rápida detectada',
                severity: 'high',
                details: `${recentReads} capítulos en 5 minutos`
            };
        }

        // 2. Verificar patrones idénticos repetitivos (mismo tiempo de lectura)
        const patternCheck = await query(
            `SELECT 
                metadata->>'timeSpentSeconds' as time,
                COUNT(*) as count
             FROM user_xp_history
             WHERE user_id = $1 
               AND created_at > NOW() - INTERVAL '1 hour'
               AND reason = 'chapter_complete'
             GROUP BY metadata->>'timeSpentSeconds'
             HAVING COUNT(*) > 5`,
            [userId]
        );

        if (patternCheck.rows.length > 0) {
            return {
                isSuspicious: true,
                reason: 'Patrón de lectura robótico detectado',
                severity: 'medium',
                details: `${patternCheck.rows[0].count} lecturas con exactamente ${patternCheck.rows[0].time}s`
            };
        }

        // 3. Verificar si está alcanzando el límite diario consistentemente (posible bot)
        const dailyLimitCheck = await query(
            `SELECT COUNT(*) as days_at_limit
             FROM user_xp_daily
             WHERE user_id = $1 
               AND date >= CURRENT_DATE - INTERVAL '7 days'
               AND xp_earned >= $2`,
            [userId, 195] // 195+ XP = casi al límite
        );

        const daysAtLimit = parseInt(dailyLimitCheck.rows[0]?.days_at_limit) || 0;
        
        // 7 días seguidos al límite exacto es sospechoso
        if (daysAtLimit >= 7) {
            return {
                isSuspicious: true,
                reason: 'Alcanza límite diario consistentemente (posible automatización)',
                severity: 'medium',
                details: `${daysAtLimit} días en los últimos 7 días`
            };
        }

        // 4. Verificar lecturas a horas inusuales (3-6 AM consistentemente)
        const nightReadingCheck = await query(
            `SELECT COUNT(*) as night_reads
             FROM user_xp_history
             WHERE user_id = $1 
               AND created_at > NOW() - INTERVAL '7 days'
               AND EXTRACT(HOUR FROM created_at) BETWEEN 3 AND 6
               AND reason = 'chapter_complete'`,
            [userId]
        );

        const nightReads = parseInt(nightReadingCheck.rows[0]?.night_reads) || 0;
        const totalReadsCheck = await query(
            `SELECT COUNT(*) as total
             FROM user_xp_history
             WHERE user_id = $1 
               AND created_at > NOW() - INTERVAL '7 days'
               AND reason = 'chapter_complete'`,
            [userId]
        );

        const totalReads = parseInt(totalReadsCheck.rows[0]?.total) || 1;
        const nightPercentage = (nightReads / totalReads) * 100;

        // Más del 80% de lecturas entre 3-6 AM es sospechoso
        if (nightPercentage > 80 && totalReads > 20) {
            return {
                isSuspicious: true,
                reason: 'Patrón de lectura nocturno inusual',
                severity: 'low',
                details: `${nightPercentage.toFixed(1)}% de lecturas entre 3-6 AM`
            };
        }

        return {
            isSuspicious: false,
            reason: null,
            severity: null
        };

    } catch (error) {
        logger.error('Error en detección de farming:', error);
        // En caso de error, no bloquear al usuario
        return {
            isSuspicious: false,
            reason: 'Error en validación',
            severity: null
        };
    }
}

/**
 * Rate limiter simple en memoria para endpoints de XP
 * Previene spam de requests
 */
class XpRateLimiter {
    constructor() {
        this.attempts = new Map(); // userId -> [timestamps]
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup cada minuto
    }

    /**
     * Verificar si el usuario puede hacer una acción
     * @param {string} userId
     * @param {number} maxAttempts - Máximo de intentos permitidos
     * @param {number} windowMs - Ventana de tiempo en ms
     * @returns {boolean}
     */
    check(userId, maxAttempts = 50, windowMs = 60000) {
        const now = Date.now();
        const userAttempts = this.attempts.get(userId) || [];
        
        // Filtrar solo intentos dentro de la ventana
        const recentAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
        
        if (recentAttempts.length >= maxAttempts) {
            logger.warn(`Rate limit excedido para usuario ${userId}: ${recentAttempts.length} intentos en ${windowMs}ms`);
            return false;
        }

        // Agregar nuevo intento
        recentAttempts.push(now);
        this.attempts.set(userId, recentAttempts);
        
        return true;
    }

    /**
     * Limpiar intentos antiguos
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 300000; // 5 minutos

        for (const [userId, attempts] of this.attempts.entries()) {
            const recentAttempts = attempts.filter(timestamp => now - timestamp < maxAge);
            
            if (recentAttempts.length === 0) {
                this.attempts.delete(userId);
            } else {
                this.attempts.set(userId, recentAttempts);
            }
        }
    }

    /**
     * Destruir el limiter
     */
    destroy() {
        clearInterval(this.cleanupInterval);
        this.attempts.clear();
    }
}

// Instancia global del rate limiter
const xpRateLimiter = new XpRateLimiter();

/**
 * Middleware para rate limiting de endpoints de XP
 */
const xpRateLimitMiddleware = (req, res, next) => {
    if (!req.user?.id) {
        return res.status(401).json({
            success: false,
            message: 'No autenticado'
        });
    }

    // 50 requests por minuto por usuario
    if (!xpRateLimiter.check(req.user.id, 50, 60000)) {
        return res.status(429).json({
            success: false,
            message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
            retryAfter: 60
        });
    }

    next();
};

/**
 * Validar integridad de datos de progreso
 * @param {object} progressData
 * @returns {object} { valid, errors }
 */
function validateProgressData(progressData) {
    const errors = [];

    // Validar slug
    if (!progressData.slug || typeof progressData.slug !== 'string') {
        errors.push('Slug inválido');
    } else if (progressData.slug.length > 200) {
        errors.push('Slug demasiado largo');
    }

    // Validar chapterNum
    if (!Number.isInteger(progressData.chapterNum) || progressData.chapterNum < 0) {
        errors.push('Número de capítulo inválido');
    } else if (progressData.chapterNum > 10000) {
        errors.push('Número de capítulo fuera de rango');
    }

    // Validar scrollPosition
    if (typeof progressData.scrollPosition !== 'number' || progressData.scrollPosition < 0) {
        errors.push('Posición de scroll inválida');
    }

    // Validar progress
    if (typeof progressData.progress !== 'number' || progressData.progress < 0 || progressData.progress > 100) {
        errors.push('Progreso debe estar entre 0 y 100');
    }

    // Validar totalPages
    if (!Number.isInteger(progressData.totalPages) || progressData.totalPages < 0) {
        errors.push('Total de páginas inválido');
    } else if (progressData.totalPages > 1000) {
        errors.push('Total de páginas fuera de rango (máx: 1000)');
    }

    // Validar isCompleted
    if (typeof progressData.isCompleted !== 'boolean') {
        errors.push('isCompleted debe ser boolean');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Logging estructurado de eventos de XP
 * @param {string} event - Tipo de evento
 * @param {object} data - Datos del evento
 */
function logXpEvent(event, data) {
    const logData = {
        timestamp: new Date().toISOString(),
        event,
        userId: data.userId,
        ...data
    };

    switch (event) {
        case 'xp_granted':
            logger.info('💎 XP otorgado:', logData);
            break;
        case 'xp_denied':
            logger.warn('⛔ XP denegado:', logData);
            break;
        case 'level_up':
            logger.info('🎊 ¡LEVEL UP!:', logData);
            break;
        case 'farming_detected':
            logger.warn('🚨 Farming detectado:', logData);
            break;
        case 'rate_limit':
            logger.warn('⏱️ Rate limit alcanzado:', logData);
            break;
        default:
            logger.info('📊 Evento XP:', logData);
    }
}

module.exports = {
    detectXpFarming,
    xpRateLimiter,
    xpRateLimitMiddleware,
    validateProgressData,
    logXpEvent
};
