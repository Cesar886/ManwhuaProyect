/**
 * Rutas de Usuarios
 */

const express = require('express');
const router = express.Router();
const { body, param, query: queryValidator } = require('express-validator');
const { validate } = require('../middleware/validate');
const userController = require('../controllers/user.controller');
const progressController = require('../controllers/progress.controller');
const achievementController = require('../controllers/achievement.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { paginationValidation } = require('../middleware/validators');
const { normalizeSocialLinks } = require('../utils/socialLinks');
const { validateFavoriteCharacters } = require('../utils/favoriteCharacters');
const { validateDisplayName } = require('../utils/usernameValidator');

// Validaciones
const updateProfileValidation = [
    body('displayName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('El nombre no puede estar vacío')
        .isLength({ max: 100 })
        .withMessage('El nombre no puede exceder 100 caracteres')
        .custom(value => {
            const result = validateDisplayName(value);
            if (!result.valid) throw new Error(result.errors[0]);
            return true;
        }),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('La bio no puede exceder 500 caracteres'),
    body('location')
        .optional()
        .trim()
        .isLength({ max: 100 }),
    body('showActiveReader')
        .optional()
        .isBoolean()
        .withMessage('La preferencia de lector activo debe ser booleana')
        .toBoolean(),
    body('website')
        .optional()
        .trim()
        .isURL()
        .withMessage('URL inválida'),
    body('socialLinks')
        .optional({ nullable: true })
        .custom(value => {
            normalizeSocialLinks(value);
            return true;
        }),
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
        .withMessage('Esquema de color inválido'),
    body('favoriteCharacters')
        .optional()
        .custom(value => {
            const result = validateFavoriteCharacters(value);
            if (Array.isArray(result) && result.some(item => item.field)) {
                const firstError = result.find(item => item.field && item.message);
                if (firstError) {
                    throw new Error(`${firstError.field}: ${firstError.message}`);
                }
            }
            return true;
        })
];

const usernameParam = [
    param('username')
        .trim()
        .notEmpty()
        .withMessage('Username requerido')
];

// Rutas públicas
// Endpoint para chequear disponibilidad de username
router.get('/check-username', requireApiKeyOrAuth, validate([
    queryValidator('username').trim().notEmpty().withMessage('Username requerido').isLength({ max: 50 }),
]), userController.checkUsername);
// Endpoint para top usuarios por racha
router.get('/top-streak', userController.getTopUsersByStreak);
// Endpoint para top usuarios por experiencia (XP)
router.get('/top-xp', userController.getTopUsersByXP);
// Endpoint para validar username (sin consultar DB) usando usernameValidator
router.get('/validate-username', requireApiKeyOrAuth, validate([
    queryValidator('username').trim().notEmpty().withMessage('Username requerido').isLength({ max: 50 }),
]), userController.validateUsername);

// PATCH /:id (Antes de /:username para evitar conflictos si id se parece, aunque UUID es distinto)
router.patch('/:id', authenticate, userController.updatePartialUser);

router.get('/:username', optionalAuth, validate(usernameParam), userController.getProfile);
router.get('/:username/collections', validate([...usernameParam, ...paginationValidation]), userController.getUserCollections);
router.get('/:username/activity', validate([...usernameParam, ...paginationValidation]), userController.getUserActivity);
router.get('/:username/ratings', validate([...usernameParam, ...paginationValidation]), userController.getUserRatings);
router.get('/:username/comments', validate([...usernameParam, ...paginationValidation]), userController.getUserComments);
router.get('/:username/bookmarks', optionalAuth, validate([...usernameParam, ...paginationValidation]), userController.getUserBookmarks);
router.get('/:username/progress', validate(usernameParam), progressController.getPublicRecentProgress);
router.get('/:username/achievements', validate(usernameParam), achievementController.getPublicUserAchievements);
router.get('/:username/followers', optionalAuth, validate([...usernameParam, ...paginationValidation]), userController.getUserFollowers);
router.get('/:username/following', optionalAuth, validate([...usernameParam, ...paginationValidation]), userController.getUserFollowing);

// Rutas protegidas
router.use(authenticate);

router.put('/profile', validate(updateProfileValidation), userController.updateProfile);
router.put('/avatar', userController.updateAvatar);
router.put('/banner', validate([
    body('bannerUrl').optional().isString().withMessage('URL del banner inválida'),
    body('positionX').optional().isInt({ min: 0, max: 100 }).withMessage('La posición horizontal debe estar entre 0 y 100').toInt(),
    body('positionY').optional().isInt({ min: 0, max: 100 }).withMessage('La posición vertical debe estar entre 0 y 100').toInt(),
]), userController.updateBanner);
router.put('/preferences', userController.updatePreferences);

// Follows
router.post('/:username/follow', validate(usernameParam), userController.followUser);
router.delete('/:username/follow', validate(usernameParam), userController.unfollowUser);

// Historial y bookmarks del usuario actual
router.get('/me/history', userController.getReadingHistory);
router.get('/me/bookmarks', userController.getBookmarks);
router.delete('/me/history', userController.clearHistory);

// XP y nivel del usuario actual
router.get('/me/xp', userController.getUserXp);

// Admin: gestionar usuarios
router.get('/', requirePermission('admin:users'), userController.listUsers);
router.put('/:username/role', requirePermission('users:manage_roles'), userController.updateUserRole);
router.put('/:username/status', requirePermission('users:ban'), userController.updateUserStatus);

module.exports = router;
