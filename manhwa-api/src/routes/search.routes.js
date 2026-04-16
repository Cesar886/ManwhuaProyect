/**
 * Rutas de Búsqueda
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation, searchQueryValidation } = require('../middleware/validators');

// Rate limiter para /ai/track: evita inflar contadores o spamear la DB
const aiTrackLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    message: { success: false, error: 'Demasiadas solicitudes de tracking, espera 1 minuto' },
});

// IA: optionalAuth para detectar usuario registrado (10 consultas) vs invitado (5)
// No requieren API key — son rutas públicas con rate-limit por cuota propia
router.post('/ai/read', optionalAuth, searchController.aiRead);
router.post('/ai/track', aiTrackLimiter, searchController.trackAiSearch);
router.get('/ai/quota', optionalAuth, searchController.getAiQuota);
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

// IA search proxy con límite diario para invitados

module.exports = router;
