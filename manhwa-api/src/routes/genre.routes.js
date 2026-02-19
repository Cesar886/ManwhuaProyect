/**
 * Rutas de Géneros
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const genreController = require('../controllers/genre.controller');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { slugParam, idParam, paginationValidation } = require('../middleware/validators');

// Rutas públicas (protegidas con API key)
router.get('/', requireApiKeyOrAuth, validate(paginationValidation), genreController.listGenres);
router.get('/:slug', requireApiKeyOrAuth, validate(slugParam), genreController.getGenre);
router.get('/:slug/series', requireApiKeyOrAuth, validate([...slugParam, ...paginationValidation]), genreController.getGenreSeries);

// Rutas protegidas (Admin)
router.use(authenticate);
router.use(requirePermission('admin:settings'));

router.post('/', validate([
    body('name').trim().notEmpty().withMessage('Nombre requerido'),
    body('slug').trim().notEmpty().withMessage('Slug requerido'),
    body('description').optional().trim(),
    body('icon').optional().trim(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/)
]), genreController.createGenre);

router.put('/:id', validate(idParam()), genreController.updateGenre);
router.delete('/:id', validate(idParam()), genreController.deleteGenre);

module.exports = router;
