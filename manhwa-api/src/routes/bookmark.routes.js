/**
 * Rutas de Bookmarks
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const bookmarkController = require('../controllers/bookmark.controller');
const { validate } = require('../middleware/validate');
const { paginationValidation, seriesIdParam } = require('../middleware/validators');

// Todas las rutas requieren autenticación
router.use(authenticate);

// CRUD de bookmarks
router.get('/', validate(paginationValidation), bookmarkController.getBookmarks);
router.post('/:seriesId', validate(seriesIdParam), bookmarkController.addBookmark);
router.delete('/:seriesId', validate(seriesIdParam), bookmarkController.removeBookmark);
router.put('/:seriesId', validate(seriesIdParam), bookmarkController.updateBookmark);

// Verificar si una serie está en bookmarks
router.get('/check/:seriesId', validate(seriesIdParam), bookmarkController.checkBookmark);

// Actualizar progreso de lectura
router.put('/:seriesId/progress', validate(seriesIdParam), bookmarkController.updateProgress);

// Notificaciones
router.put('/:seriesId/notifications', validate(seriesIdParam), bookmarkController.toggleNotifications);

module.exports = router;
