/**
 * Rutas de Tracking de Comportamiento
 * 
 * Endpoints REST para recolección silenciosa de behavioral data
 * - POST /tracking/event - Registrar evento raw
 * - POST /tracking/session - Actualizar sesión de lectura
 * - POST /tracking/progress - Actualizar progreso de capítulo
 * - GET /tracking/metrics - Obtener métricas agregadas del usuario
 * - POST /tracking/detect-abandoned - Detectar obras abandonadas
 * - POST /tracking/detect-rereads - Detectar relecturas
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const trackingController = require('../controllers/tracking.controller');
const logger = require('../utils/logger');

// ============================================
// MIDDLEWARE: Validación de Errores
// ============================================
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// ============================================
// Middleware: Rate limiting para tracking
// (Permisivo: 1000 events/min por usuario)
// ============================================
const trackingLimiter = require('express-rate-limit')({
    windowMs: 60 * 1000,    // 1 minuto
    max: 1000,               // 1000 eventos por minuto
    keyGenerator: (req) => {
        // Limitar por user_id si está autenticado
        return req.user?.id || req.ip;
    },
    skip: (req) => !req.user,  // Solo aplicar a usuarios autenticados
    message: 'Too many tracking events',
    statusCode: 429
});

// ============================================
// 1. POST /tracking/event
// Registrar evento raw de comportamiento
// ============================================
router.post(
    '/event',
    authenticate,
    trackingLimiter,
    body('event_type')
        .notEmpty().withMessage('event_type es requerido')
        .isIn(['page_load', 'scroll', 'chapter_change', 'session_start', 
               'session_end', 'tab_close', 'inactivity', 'progress_update'])
        .withMessage('event_type inválido'),
    body('work_id').optional({ checkFalsy: true }).isUUID(),
    body('chapter_id').optional({ checkFalsy: true }).isUUID(),
    body('session_id').optional().isString().trim(),
    body('user_agent').optional().isString().trim().isLength({ max: 1000 }),
    handleValidationErrors,
    trackingController.trackEvent
);

// ============================================
// 2. POST /tracking/session
// Actualizar sesión de lectura completa
// ============================================
router.post(
    '/session',
    authenticate,
    trackingLimiter,
    body('work_id')
        .notEmpty().withMessage('work_id es requerido')
        .isUUID(),
    body('chapter_id')
        .notEmpty().withMessage('chapter_id es requerido')
        .isUUID(),
    body('duration_seconds')
        .notEmpty().withMessage('duration_seconds es requerido')
        .isInt({ min: 0, max: 86400 }),  // Máx 24 horas
    body('scroll_depth_percent')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 100 }),
    body('interactions_count')
        .optional({ checkFalsy: true })
        .isInt({ min: 0 }),
    body('is_completed')
        .optional({ checkFalsy: true })
        .isBoolean(),
    body('exit_reason')
        .optional({ checkFalsy: true })
        .isString()
        .isIn(['completed', 'tab_closed', 'inactive', 'user_left']),
    handleValidationErrors,
    trackingController.updateReadingSession
);

// ============================================
// 3. POST /tracking/progress
// Actualizar progreso de capítulo
// ============================================
router.post(
    '/progress',
    authenticate,
    trackingLimiter,
    body('work_id')
        .notEmpty().withMessage('work_id es requerido')
        .isUUID(),
    body('chapter_id')
        .notEmpty().withMessage('chapter_id es requerido')
        .isUUID(),
    body('chapter_number')
        .notEmpty().withMessage('chapter_number es requerido')
        .isInt({ min: 1 }),
    body('is_completed')
        .optional({ checkFalsy: true })
        .isBoolean(),
    body('time_spent_minutes')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 10080 }),  // Máx 7 días
    handleValidationErrors,
    trackingController.updateChapterProgress
);

// ============================================
// 4. GET /tracking/metrics
// Obtener todas las métricas agregadas del usuario
// ============================================
router.get(
    '/metrics',
    authenticate,
    trackingController.getUserMetrics
);

// ============================================
// 5. POST /tracking/detect-abandoned
// Detectar y registrar obras abandonadas
// (Se puede llamar periódicamente o al login)
// ============================================
router.post(
    '/detect-abandoned',
    authenticate,
    trackingController.detectAbandonedWorks
);

// ============================================
// 6. POST /tracking/detect-rereads
// Detectar y registrar relecturas de obras
// (Se puede llamar periódicamente)
// ============================================
router.post(
    '/detect-rereads',
    authenticate,
    trackingController.detectRereads
);

// ============================================
// Health check endpoint
// ============================================
router.get('/health', (req, res) => {
    res.json({
        status: 'operational',
        service: 'tracking-api',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// Error handling
// ============================================
router.use((error, req, res, next) => {
    logger.error('Tracking route error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

module.exports = router;
