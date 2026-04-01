/**
 * Rutas de Logros (Achievements)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
    getUserAchievements,
    getAchievementsConfig,
    getAchievementsLeaderboard
} = require('../controllers/achievement.controller');

/**
 * @route   GET /api/achievements
 * @desc    Obtener todos los logros del usuario autenticado
 * @access  Private
 */
router.get('/', authenticate, getUserAchievements);

/**
 * @route   GET /api/achievements/config
 * @desc    Obtener configuración de todos los logros disponibles
 * @access  Public
 */
router.get('/config', getAchievementsConfig);

/**
 * @route   GET /api/achievements/leaderboard
 * @desc    Obtener ranking de usuarios por logros
 * @query   ?type=diamante&limit=50
 * @access  Public
 */
router.get('/leaderboard', getAchievementsLeaderboard);

module.exports = router;
