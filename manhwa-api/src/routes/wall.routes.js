const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const { optionalAuth } = require('../middleware/auth');
const { paginationValidation } = require('../middleware/validators');
const { validate } = require('../middleware/validate');

router.get('/comments', optionalAuth, validate(paginationValidation), commentController.getWallComments);

module.exports = router;
