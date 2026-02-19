/**
 * Rutas de Comentarios
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const commentController = require('../controllers/comment.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation, idParam } = require('../middleware/validators');

// Validaciones
const createCommentValidation = [
    body('targetType')
        .isIn(['series', 'chapter', 'collection', 'request'])
        .withMessage('Tipo de target inválido'),
    body('targetId')
        .isUUID()
        .withMessage('ID de target inválido'),
    body('content')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Contenido no debe exceder 2000 caracteres'),
    body('parentId')
        .optional()
        .isUUID(),
    body('rating')
        .optional()
        .isInt({ min: 1, max: 10 }),
    body('isSpoiler')
        .optional()
        .isBoolean(),
    body('poll')
        .optional()
        .isObject(),
    body('poll.question')
        .optional()
        .trim()
        .isLength({ min: 1, max: 300 })
        .withMessage('La pregunta debe tener entre 1 y 300 caracteres'),
    body('poll.options')
        .optional()
        .isArray({ min: 2, max: 5 })
        .withMessage('La encuesta debe tener entre 2 y 5 opciones')
];

const updateCommentValidation = [
    body('content')
        .trim()
        .isLength({ min: 1, max: 2000 })
        .withMessage('Contenido debe tener entre 1 y 2000 caracteres')
];

// Rutas públicas (protegidas con API key)
// Indicador de escritura (typing) - requiere API key
router.post('/typing', requireApiKeyOrAuth, commentController.typingEvent);

// Obtener las reacciones del usuario para los comentarios de un target
router.get('/my-reactions', authenticate, commentController.getMyReactions);
router.get('/:id', requireApiKeyOrAuth, optionalAuth, validate(idParam()), commentController.getComment);
router.get('/:id/replies', requireApiKeyOrAuth, optionalAuth, validate([...idParam(), ...paginationValidation]), commentController.getCommentReplies);

// Rutas protegidas
router.use(authenticate);

router.post('/', validate(createCommentValidation), commentController.createComment);
router.put('/:id', validate(updateCommentValidation), commentController.updateComment);
router.delete('/:id', validate(idParam()), commentController.deleteComment);

// Votos
router.post('/:id/like', validate(idParam()), commentController.likeComment);
router.post('/:id/dislike', validate(idParam()), commentController.dislikeComment);
router.delete('/:id/vote', validate(idParam()), commentController.removeVote);

// Moderación
router.post('/:id/pin', requirePermission('comments:pin'), validate(idParam()), commentController.pinComment);
router.delete('/:id/pin', requirePermission('comments:pin'), validate(idParam()), commentController.unpinComment);
router.post('/:id/hide', requirePermission('comments:hide'), validate(idParam()), commentController.hideComment);

// Reportar
router.post('/:id/report', validate([
    ...idParam(),
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Razón demasiado larga'),
]), commentController.reportComment);

// Encuestas
router.post('/:id/poll/vote', validate(idParam()), commentController.votePoll);
router.get('/:id/poll/votes', optionalAuth, validate([...idParam(), ...paginationValidation]), commentController.getPollVotes);

module.exports = router;
