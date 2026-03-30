/**
 * Rutas de Progreso de Lectura
 * Sincronización de progreso entre dispositivos
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const progressController = require('../controllers/progress.controller');
const { authenticate } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Validaciones
const saveProgressValidation = [
    body('slug')
        .trim()
        .notEmpty()
        .withMessage('Slug del manhwa requerido'),
    body('chapterNum')
        .isFloat({ min: 0.1 })
        .withMessage('Número de capítulo inválido'),
    body('scrollPosition')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Posición de scroll debe ser un número positivo'),
    body('progress')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Progreso debe estar entre 0 y 100'),
    body('totalPages')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Total de páginas debe ser un número positivo'),
    body('isCompleted')
        .optional()
        .isBoolean()
        .withMessage('isCompleted debe ser booleano'),
    body('deviceId')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('deviceId inválido')
];

const getProgressValidation = [
    param('slug')
        .trim()
        .notEmpty()
        .withMessage('Slug requerido'),
    param('chapterNum')
        .isFloat({ min: 0.1 })
        .withMessage('Número de capítulo inválido')
];

// Rutas — las rutas fijas van ANTES de las parametrizadas
// Obtener todo el progreso del usuario (para sincronización inicial)
router.get('/sync', progressController.syncProgress);

// Obtener últimos capítulos leídos (para "Continuar leyendo")
router.get('/recent', progressController.getRecentProgress);

// Obtener racha de lectura del usuario
router.get('/streak', progressController.getStreak);

// SSE — stream de actualizaciones de racha en tiempo real
router.get('/stream', progressController.streamStreak);

// Guardar/actualizar progreso de lectura
router.post('/', validate(saveProgressValidation), progressController.saveProgress);

// Obtener progreso de un capítulo específico
router.get('/:slug/:chapterNum', validate(getProgressValidation), progressController.getProgress);

// Eliminar progreso de un capítulo específico
router.delete('/:slug/:chapterNum', validate(getProgressValidation), progressController.deleteProgress);

// Limpiar todo el progreso del usuario
router.delete('/', progressController.clearAllProgress);

module.exports = router;
