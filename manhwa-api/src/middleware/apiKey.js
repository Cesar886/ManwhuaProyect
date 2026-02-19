/**
 * Middleware de API Key
 * Protege rutas públicas contra acceso no autorizado.
 * Acepta JWT (usuarios autenticados) O una API key interna (frontend/clientes autorizados).
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Requiere API Key O JWT válido.
 * - Header: x-api-key
 * - Header: Authorization: Bearer <jwt>
 * - Cookie: token (JWT)
 *
 * Si ninguno es válido, retorna 401.
 */
const requireApiKeyOrAuth = (req, res, next) => {
    // 1. Verificar API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
        return next();
    }

    // 2. Verificar JWT (header o cookie)
    let token = null;
    if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return next();
        } catch (err) {
            // Token inválido, continuar al rechazo
        }
    }

    // 3. Ninguna credencial válida
    logger.warn(`API access denied: ${req.method} ${req.originalUrl} from ${req.ip}`);
    return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Se requiere API key o token de autenticación.',
        code: 'UNAUTHORIZED'
    });
};

module.exports = { requireApiKeyOrAuth };
