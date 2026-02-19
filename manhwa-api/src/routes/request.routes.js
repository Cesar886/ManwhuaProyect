/**
 * Rutas de Pedidos (Requests)
 */

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const requestController = require('../controllers/request.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation, uuidParam } = require('../middleware/validators');

// Validaciones
const createRequestValidation = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('Título requerido (máximo 500 caracteres)'),
    body('originalTitle')
        .optional()
        .trim()
        .isLength({ max: 500 }),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 }),
    body('genres')
        .optional()
        .isArray(),
    body('coverUrl')
        .optional()
        .isURL({ require_tld: false })
];

const updateStatusValidation = [
    body('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed', 'rejected']),
    body('progress')
        .optional()
        .isInt({ min: 0, max: 100 }),
    body('rejectionReason')
        .optional()
        .trim()
        .isLength({ max: 500 }),
    body('seriesId')
        .optional()
        .isUUID()
];

// Rutas públicas (protegidas con API key)
router.get('/', requireApiKeyOrAuth, optionalAuth, validate(paginationValidation), requestController.listRequests);
router.get('/:id', requireApiKeyOrAuth, optionalAuth, validate(uuidParam()), requestController.getRequest);
router.get('/:id/comments', requireApiKeyOrAuth, optionalAuth, validate([...uuidParam(), ...paginationValidation]), requestController.getRequestComments);

// Obtener o crear request para capítulo (público, pero recomendado con auth para mejor seguimiento)
router.post('/chapter', requireApiKeyOrAuth, optionalAuth, requestController.getOrCreateChapterRequest);

// Rutas protegidas
router.use(authenticate);

// Crear pedido
router.post('/', validate(createRequestValidation), requestController.createRequest);

// Editar pedido (propietario o permisos)
router.put('/:id', validate([
    body('title').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Título inválido'),
    body('originalTitle').optional().trim().isLength({ max: 500 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('genres').optional().isArray(),
    body('coverUrl').optional().isURL({ require_tld: false })
]), requestController.updateRequest);

// Votar
router.post('/:id/vote', validate(uuidParam()), requestController.voteRequest);
router.delete('/:id/vote', validate(uuidParam()), requestController.unvoteRequest);

// Moderación (admin/mod)
router.put('/:id/status', requirePermission('requests:manage'), validate([...uuidParam(), ...updateStatusValidation]), requestController.updateRequestStatus);
// Eliminar pedido: delegar verificación al controlador para permitir que el propietario o un admin borren.
router.delete('/:id', validate(uuidParam()), requestController.deleteRequest);

module.exports = router;
