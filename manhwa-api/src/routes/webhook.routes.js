const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const webhookController = require('../controllers/webhook.controller');
const { authenticate } = require('../middleware/auth');

const reactionValidation = [
    body('commentId').exists().withMessage('commentId es requerido'),
    body('action').isIn(['like','dislike','remove']).withMessage('action inválida')
];

router.post('/comment-reaction', authenticate, validate(reactionValidation), webhookController.commentReaction);

module.exports = router;
