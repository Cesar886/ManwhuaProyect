const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const { optionalAuth } = require('../middleware/auth');
const { paginationValidation } = require('../middleware/validators');
const { validate } = require('../middleware/validate');

router.get('/comments', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
}, optionalAuth, validate(paginationValidation), commentController.getWallComments);

module.exports = router;
