const rateLimit = require('express-rate-limit');

/**
 * Limitador general de API
 * 100 peticiones por 15 minutos por IP
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Has excedido el límite de peticiones. Por favor intenta de nuevo en 15 minutos.'
    }
});

/**
 * Limitador específico para votos/ratings
 * Más estricto para prevenir spam de votos
 * 10 votos por hora por IP
 */
const voteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 20, // 20 votos por hora
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Usar visitorId si está disponible para mayor precisión, o IP como fallback
        // Nota: req.body puede no estar parseado en algunos middlewares si se coloca antes de body-parser
        // Asegúrate de usar esto DESPUÉS de express.json()
        return req.body.visitorId || req.ip; 
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Has votado demasiadas veces recientemente. Intenta de nuevo más tarde.'
        });
    }
});

/**
 * Limitador para intentos de login/auth
 * Prevenir fuerza bruta
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 intentos
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
    }
});

/**
 * Limitador para donaciones
 * 10 intentos por hora por IP — pagos no necesitan más
 */
const donationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiados intentos de pago. Intenta de nuevo más tarde.'
    }
});

module.exports = {
    apiLimiter,
    voteLimiter,
    authLimiter,
    donationLimiter
};
