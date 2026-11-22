/**
 * Rutas de Bookmarks
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const bookmarkController = require('../controllers/bookmark.controller');
const { validate } = require('../middleware/validate');
const { paginationValidation, uuidParam } = require('../middleware/validators');

// Todas las rutas requieren autenticación
router.use(authenticate);

// CRUD de bookmarks
router.get('/', validate(paginationValidation), bookmarkController.getBookmarks);
router.post('/:seriesId', validate(uuidParam('seriesId')), bookmarkController.addBookmark);
router.delete('/:seriesId', validate(uuidParam('seriesId')), bookmarkController.removeBookmark);
router.put('/:seriesId', validate(uuidParam('seriesId')), bookmarkController.updateBookmark);

// Verificar si una serie está en bookmarks
router.get('/check/:seriesId', validate(uuidParam('seriesId')), bookmarkController.checkBookmark);

// Actualizar progreso de lectura
router.put('/:seriesId/progress', validate(uuidParam('seriesId')), bookmarkController.updateProgress);

// Notificaciones
router.put('/:seriesId/notifications', validate(uuidParam('seriesId')), bookmarkController.toggleNotifications);

module.exports = router;
