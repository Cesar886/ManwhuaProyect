/**
 * Rutas de Capítulos
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const chapterController = require('../controllers/chapter.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission, requirePremium } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation, idParam } = require('../middleware/validators');
const { voteLimiter } = require('../middleware/rateLimit');

const chapterSlugParams = [
    param('seriesSlug').trim().notEmpty().withMessage('Slug de serie requerido'),
    param('chapterSlug').trim().notEmpty().withMessage('Slug de capítulo requerido'),
];

// Validaciones
const createChapterValidation = [
    body('seriesId')
        .isUUID()
        .withMessage('ID de serie inválido'),
    body('number')
        .isFloat({ min: 0 })
        .withMessage('Número de capítulo inválido'),
    body('title')
        .optional()
        .trim()
        .isLength({ max: 500 }),
    body('pages')
        .isArray()
        .withMessage('Páginas requeridas')
];

// Rating de capítulos (público, identificado por visitorId/FingerprintJS)
// IMPORTANTE: Estas rutas deben ir ANTES de /:seriesSlug/:chapterSlug para evitar que
// la ruta genérica con requireApiKeyOrAuth las eclipse.
router.post('/:seriesSlug/:chapterNum/rate',
    voteLimiter,
    validate([
        param('seriesSlug').trim().notEmpty().withMessage('Slug de serie requerido'),
        param('chapterNum').isFloat({ min: 0 }).withMessage('Número de capítulo inválido'),
        body('rating').isInt({ min: 1, max: 5 }).withMessage('El voto debe ser un número entero entre 1 y 5'),
        body('visitorId').trim().notEmpty().withMessage('visitorId requerido'),
    ]),
    chapterController.rateChapter
);

router.get('/:seriesSlug/:chapterNum/user-rating', validate([
    param('seriesSlug').trim().notEmpty().withMessage('Slug de serie requerido'),
    param('chapterNum').isFloat({ min: 0 }).withMessage('Número de capítulo inválido'),
]), chapterController.getChapterUserRating);

router.get('/:seriesSlug/:chapterNum/rating', validate([
    param('seriesSlug').trim().notEmpty().withMessage('Slug de serie requerido'),
    param('chapterNum').isFloat({ min: 0 }).withMessage('Número de capítulo inválido'),
]), chapterController.getChapterRating);

// Rutas públicas (protegidas con API key)
router.get('/', requireApiKeyOrAuth, validate(paginationValidation), chapterController.getAllChapters);
router.get('/:seriesSlug/:chapterSlug', requireApiKeyOrAuth, optionalAuth, validate(chapterSlugParams), chapterController.getChapter);
router.get('/:seriesSlug/:chapterSlug/pages', requireApiKeyOrAuth, optionalAuth, validate(chapterSlugParams), chapterController.getChapterPages);
router.get('/:seriesSlug/:chapterSlug/comments', requireApiKeyOrAuth, optionalAuth, validate([...chapterSlugParams, ...paginationValidation]), chapterController.getChapterComments);

// Rutas protegidas
router.use(authenticate);

// Progreso de lectura
router.post('/:seriesSlug/:chapterSlug/progress', validate(chapterSlugParams), chapterController.updateReadingProgress);

// CRUD (requiere permisos)
router.post('/', requirePermission('chapters:create'), validate(createChapterValidation), chapterController.createChapter);
router.put('/:id', requirePermission('chapters:update'), validate(idParam()), chapterController.updateChapter);
router.delete('/:id', requirePermission('chapters:delete'), validate(idParam()), chapterController.deleteChapter);

// Subir páginas
router.post('/:id/pages', requirePermission('upload:chapters'), validate(idParam()), chapterController.uploadPages);

module.exports = router;
