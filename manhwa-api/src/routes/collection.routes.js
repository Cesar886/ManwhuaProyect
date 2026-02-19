/**
 * Rutas de Colecciones
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const collectionController = require('../controllers/collection.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation, idParam } = require('../middleware/validators');

// Validaciones
const createCollectionValidation = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Nombre debe tener entre 1 y 200 caracteres'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 }),
    body('isPublic')
        .optional()
        .isBoolean(),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 100 }),
    body('tags')
        .optional()
        .isArray()
];

const updateCollectionValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 }),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 }),
    body('isPublic')
        .optional()
        .isBoolean()
];

const slugParam = [
    param('slug')
        .trim()
        .notEmpty()
];

// Rutas públicas (protegidas con API key)
router.get('/', requireApiKeyOrAuth, validate(paginationValidation), collectionController.listCollections);
router.get('/popular', requireApiKeyOrAuth, validate(paginationValidation), collectionController.getPopularCollections);
router.get('/:slug', requireApiKeyOrAuth, optionalAuth, validate(slugParam), collectionController.getCollection);
router.get('/:slug/manhwas', requireApiKeyOrAuth, validate([...slugParam, ...paginationValidation]), collectionController.getCollectionManhwas);
router.get('/:slug/comments', requireApiKeyOrAuth, optionalAuth, validate([...slugParam, ...paginationValidation]), collectionController.getCollectionComments);

// Rutas protegidas
router.use(authenticate);

// CRUD
router.post('/', validate(createCollectionValidation), collectionController.createCollection);
router.put('/:slug', validate([...slugParam, ...updateCollectionValidation]), collectionController.updateCollection);
router.delete('/:slug', validate(slugParam), collectionController.deleteCollection);

// Gestión de manhwas en colección
router.post('/:slug/manhwas', validate(slugParam), collectionController.addManhwaToCollection);
router.delete('/:slug/manhwas/:seriesId', validate([...slugParam, ...idParam('seriesId')]), collectionController.removeManhwaFromCollection);
router.put('/:slug/manhwas/reorder', validate(slugParam), collectionController.reorderManhwas);

// Interacciones
router.post('/:slug/follow', validate(slugParam), collectionController.followCollection);
router.delete('/:slug/follow', validate(slugParam), collectionController.unfollowCollection);
router.post('/:slug/like', validate(slugParam), collectionController.likeCollection);
router.delete('/:slug/like', validate(slugParam), collectionController.unlikeCollection);

// Moderación
router.post('/:slug/verify', requirePermission('collections:verify'), validate(slugParam), collectionController.verifyCollection);

module.exports = router;
