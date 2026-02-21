/**
 * Rutas de Series
 */

const express = require('express');
const router = express.Router();
const { body, param, query: queryValidator } = require('express-validator');
const { validate } = require('../middleware/validate');
const seriesController = require('../controllers/series.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation, searchQueryValidation } = require('../middleware/validators');
const uploadToSpaces = require('../middleware/uploadToSpaces');
const { voteLimiter } = require('../middleware/rateLimit');

// Validaciones
const createSeriesValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Título requerido')
        .isLength({ max: 500 })
        .withMessage('Título muy largo'),
    body('synopsis')
        .optional()
        .trim()
        .isLength({ max: 5000 }),
    body('contentType')
        .optional()
        .isIn(['manhwa', 'manga', 'manhua', 'webtoon']),
    body('status')
        .optional()
        .isIn(['ongoing', 'completed', 'hiatus', 'dropped', 'upcoming']),
    body('genres')
        .optional()
        .isArray()
        .withMessage('Géneros debe ser un array'),
    body('isAdult')
        .optional()
        .isBoolean()
];

const updateSeriesValidation = [
    body('title')
        .optional()
        .trim()
        .isLength({ max: 500 }),
    body('synopsis')
        .optional()
        .trim()
        .isLength({ max: 5000 }),
    body('status')
        .optional()
        .isIn(['ongoing', 'completed', 'hiatus', 'dropped', 'upcoming']),
    body('genres')
        .optional()
        .isArray()
];

const slugParam = [
    param('slug')
        .trim()
        .notEmpty()
        .withMessage('Slug requerido')
];

// Rutas protegidas con API Key o JWT (anti-scraping)
router.get('/', requireApiKeyOrAuth, optionalAuth, validate([...paginationValidation, ...searchQueryValidation]), seriesController.listSeries);
router.get('/statuses', requireApiKeyOrAuth, seriesController.getSeriesStatuses);
router.get('/featured', requireApiKeyOrAuth, validate(paginationValidation), seriesController.getFeaturedSeries);
router.get('/popular', requireApiKeyOrAuth, validate(paginationValidation), seriesController.getPopularSeries);
router.get('/latest', requireApiKeyOrAuth, validate(paginationValidation), seriesController.getLatestSeries);
router.get('/trending', requireApiKeyOrAuth, validate(paginationValidation), seriesController.getTrendingSeries);
router.get('/new-releases', requireApiKeyOrAuth, validate(paginationValidation), seriesController.getNewReleases);
router.get('/:slug', requireApiKeyOrAuth, optionalAuth, validate(slugParam), seriesController.getSeriesDetail);
router.get('/:slug/chapters', requireApiKeyOrAuth, validate(slugParam), seriesController.getSeriesChapters);
router.get('/:slug/comments', requireApiKeyOrAuth, optionalAuth, validate(slugParam), seriesController.getSeriesComments);
router.get('/:slug/related', requireApiKeyOrAuth, validate(slugParam), seriesController.getRelatedSeries);

// Rating (público para visitors, auth opcional)
const userRatingValidation = [
    queryValidator('visitorId').optional().isString()
];
const rateValidation = [
    body('score').optional().isInt({ min: 1, max: 10 }),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('El voto debe ser un número entero entre 1 y 5'),
    body('visitorId').trim().notEmpty().withMessage('Visitor ID requerido'),
    body('review').optional().isString().isLength({ max: 500 })
];

router.get('/:slug/rating', validate(slugParam), seriesController.getSeriesRating);
router.get('/:slug/user-rating', validate([...slugParam, ...userRatingValidation]), optionalAuth, seriesController.getUserRating);
router.post('/:slug/rate', voteLimiter, validate([...slugParam, ...rateValidation]), optionalAuth, seriesController.rateSeries);

// Rutas protegidas
router.use(authenticate);

// Like y bookmark
router.post('/:slug/like', validate(slugParam), seriesController.likeSeries);
router.delete('/:slug/like', validate(slugParam), seriesController.unlikeSeries);
router.post('/:slug/bookmark', validate(slugParam), seriesController.bookmarkSeries);
router.delete('/:slug/bookmark', validate(slugParam), seriesController.unbookmarkSeries);



// CRUD (requiere permisos)
router.post('/', requirePermission('series:create'), validate(createSeriesValidation), seriesController.createSeries);
router.patch(
    '/:slug',
    requirePermission('series:update'),
    validate([...slugParam, ...updateSeriesValidation]),
    seriesController.updateSeries
);
router.delete('/:slug', requirePermission('series:delete'), validate(slugParam), seriesController.deleteSeries);

// Ruta específica para actualizar solo la imagen de portada
router.post(
    '/:slug/cover',
    requirePermission('series:update'),
    uploadToSpaces('cover'),
    validate(slugParam),
    seriesController.updateSeriesCover
);

// Features (admin/mod)
router.post('/:slug/feature', requirePermission('series:feature'), validate(slugParam), seriesController.featureSeries);
router.delete('/:slug/feature', requirePermission('series:feature'), validate(slugParam), seriesController.unfeatureSeries);

module.exports = router;
