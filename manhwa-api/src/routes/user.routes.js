/**
 * Rutas de Usuarios
 */

const express = require('express');
const router = express.Router();
const { body, param, query: queryValidator } = require('express-validator');
const { validate } = require('../middleware/validate');
const userController = require('../controllers/user.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation } = require('../middleware/validators');

// Validaciones
const updateProfileValidation = [
    body('displayName')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('El nombre no puede exceder 100 caracteres'),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('La bio no puede exceder 500 caracteres'),
    body('location')
        .optional()
        .trim()
        .isLength({ max: 100 }),
    body('website')
        .optional()
        .trim()
        .isURL()
        .withMessage('URL inválida'),
    body('themePrimaryColor')
        .optional()
        .matches(/^#[0-9A-Fa-f]{6}$/)
        .withMessage('Color primario inválido'),
    body('themeAccentColor')
        .optional()
        .matches(/^#[0-9A-Fa-f]{6}$/)
        .withMessage('Color de acento inválido'),
    body('colorScheme')
        .optional()
        .isIn(['light', 'dark', 'system'])
        .withMessage('Esquema de color inválido')
];

const usernameParam = [
    param('username')
        .trim()
        .notEmpty()
        .withMessage('Username requerido')
];

// Rutas públicas (protegidas con API key)
// Endpoint para chequear disponibilidad de username
router.get('/check-username', requireApiKeyOrAuth, validate([
    queryValidator('username').trim().notEmpty().withMessage('Username requerido').isLength({ max: 50 }),
]), userController.checkUsername);
// Endpoint para validar username (sin consultar DB) usando usernameValidator
router.get('/validate-username', requireApiKeyOrAuth, validate([
    queryValidator('username').trim().notEmpty().withMessage('Username requerido').isLength({ max: 50 }),
]), userController.validateUsername);

// PATCH /:id (Antes de /:username para evitar conflictos si id se parece, aunque UUID es distinto)
router.patch('/:id', authenticate, userController.updatePartialUser);

router.get('/:username', requireApiKeyOrAuth, optionalAuth, validate(usernameParam), userController.getProfile);
router.get('/:username/collections', requireApiKeyOrAuth, validate([...usernameParam, ...paginationValidation]), userController.getUserCollections);
router.get('/:username/activity', requireApiKeyOrAuth, validate([...usernameParam, ...paginationValidation]), userController.getUserActivity);
router.get('/:username/followers', requireApiKeyOrAuth, validate([...usernameParam, ...paginationValidation]), userController.getUserFollowers);
router.get('/:username/following', requireApiKeyOrAuth, validate([...usernameParam, ...paginationValidation]), userController.getUserFollowing);

// Rutas protegidas
router.use(authenticate);

router.put('/profile', validate(updateProfileValidation), userController.updateProfile);
router.put('/avatar', userController.updateAvatar);
router.put('/banner', userController.updateBanner);
router.put('/preferences', userController.updatePreferences);

// Follows
router.post('/:username/follow', validate(usernameParam), userController.followUser);
router.delete('/:username/follow', validate(usernameParam), userController.unfollowUser);

// Historial y bookmarks del usuario actual
router.get('/me/history', userController.getReadingHistory);
router.get('/me/bookmarks', userController.getBookmarks);
router.delete('/me/history', userController.clearHistory);

// Admin: gestionar usuarios
router.get('/', requirePermission('admin:users'), userController.listUsers);
router.put('/:username/role', requirePermission('users:manage_roles'), userController.updateUserRole);
router.put('/:username/status', requirePermission('users:ban'), userController.updateUserStatus);

module.exports = router;
