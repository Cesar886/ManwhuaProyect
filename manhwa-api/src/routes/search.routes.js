/**
 * Rutas de Búsqueda
 */

const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation, searchQueryValidation } = require('../middleware/validators');

// Todas las rutas requieren API key + auth opcional
router.use(requireApiKeyOrAuth);
router.use(optionalAuth);

// Búsqueda general
router.get('/', validate([...searchQueryValidation, ...paginationValidation]), searchController.search);

// Búsquedas específicas
router.get('/series', validate([...searchQueryValidation, ...paginationValidation]), searchController.searchSeries);
router.get('/users', validate([...searchQueryValidation, ...paginationValidation]), searchController.searchUsers);
router.get('/collections', validate([...searchQueryValidation, ...paginationValidation]), searchController.searchCollections);

// Autocompletado
router.get('/autocomplete', validate(searchQueryValidation), searchController.autocomplete);

// Búsqueda avanzada
router.get('/advanced', validate([...searchQueryValidation, ...paginationValidation]), searchController.advancedSearch);

module.exports = router;
