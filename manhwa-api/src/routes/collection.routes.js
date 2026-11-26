const express = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, optionalAuth } = require('../middleware/auth');
const collections = require('../controllers/sharedCollection.controller');

const router = express.Router();
const id = [param('publicId').matches(/^[A-Za-z0-9]{8}$/)];
const page = [query('page').optional().isInt({ min: 1 })];
const visibility = body('visibility').optional().isIn(['private', 'unlisted', 'public']);

router.use(collections.noStore);
router.get('/', optionalAuth, validate(page), collections.list);
router.get('/indexable', validate(page), collections.indexable);
router.get('/mine', authenticate, validate([query('seriesId').optional().isUUID()]), collections.mine);
router.get('/:publicId', optionalAuth, validate(id), collections.get);
router.get('/:publicId/manhwas', optionalAuth, validate([...id, ...page]), collections.items);
router.get('/:publicId/comments', optionalAuth, validate([...id, ...page]), collections.comments);

router.use(authenticate);
router.post('/', validate([body('name').isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('coverUrl').optional({ nullable: true }).isURL()]), collections.create);
router.put('/:publicId', validate([...id, body('name').optional().isString().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('coverUrl').optional({ nullable: true }).isString(), visibility]), collections.update);
router.delete('/:publicId', validate(id), collections.remove);
router.post('/:publicId/manhwas', validate([...id, body('seriesId').isUUID()]), collections.addItem);
router.delete('/:publicId/manhwas/:seriesId', validate([...id, param('seriesId').isUUID()]), collections.removeItem);
router.put('/:publicId/manhwas/reorder', validate([...id, body('seriesIds').isArray(), body('seriesIds.*').isUUID()]), collections.reorder);
router.post('/:publicId/like', validate(id), collections.like(true));
router.delete('/:publicId/like', validate(id), collections.like(false));
router.post('/:publicId/follow', validate(id), collections.follow(true));
router.delete('/:publicId/follow', validate(id), collections.follow(false));
router.post('/:publicId/copy', validate(id), collections.copy);

module.exports = router;
