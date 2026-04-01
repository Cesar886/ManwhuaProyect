/**
 * Controlador de Logros (Achievements)
 * Maneja el sistema de achievements y badges del usuario
 */

const { query, transaction } = require('../config/database');
const { 
    ACHIEVEMENT_TYPES,
    calculateAchievementLevel,
    getAllAchievements,
    checkAchievementUnlock
} = require('../utils/achievementSystem');

/**
 * Obtener todos los logros del usuario
 * GET /api/achievements
 */
const getUserAchievements = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Obtener estadísticas actuales del usuario desde getUserBadgeStats
        const { getUserBadgeStats } = require('./progress.controller');
        const timezone = req.user?.timezone || req.headers?.['x-timezone'] || null;
        const stats = await getUserBadgeStats(userId, timezone);

        // Obtener logros desbloqueados del usuario
        const achievementsResult = await query(
            `SELECT achievement_type, level, unlocked_at
             FROM user_achievements
             WHERE user_id = $1
             ORDER BY unlocked_at DESC`,
            [userId]
        );

        const unlockedAchievements = {};
        for (const row of achievementsResult.rows) {
            unlockedAchievements[row.achievement_type] = {
                level: row.level,
                unlockedAt: row.unlocked_at
            };
        }

        // Calcular el estado actual de cada logro
        const achievements = {
            racha: {
                type: ACHIEVEMENT_TYPES.RACHA,
                ...calculateAchievementLevel(ACHIEVEMENT_TYPES.RACHA, stats.streak),
                unlocked: !!unlockedAchievements.racha,
                unlockedAt: unlockedAchievements.racha?.unlockedAt || null
            },
            diamante: {
                type: ACHIEVEMENT_TYPES.DIAMANTE,
                ...calculateAchievementLevel(ACHIEVEMENT_TYPES.DIAMANTE, stats.totalChapters),
                unlocked: !!unlockedAchievements.diamante,
                unlockedAt: unlockedAchievements.diamante?.unlockedAt || null
            },
            veloz: {
                type: ACHIEVEMENT_TYPES.VELOZ,
                ...calculateAchievementLevel(ACHIEVEMENT_TYPES.VELOZ, stats.maxChaptersPerHour),
                unlocked: !!unlockedAchievements.veloz,
                unlockedAt: unlockedAchievements.veloz?.unlockedAt || null
            },
            critico: {
                type: ACHIEVEMENT_TYPES.CRITICO,
                ...calculateAchievementLevel(ACHIEVEMENT_TYPES.CRITICO, stats.comments),
                unlocked: !!unlockedAchievements.critico,
                unlockedAt: unlockedAchievements.critico?.unlockedAt || null
            },
            nocturno: {
                type: ACHIEVEMENT_TYPES.NOCTURNO,
                ...calculateAchievementLevel(ACHIEVEMENT_TYPES.NOCTURNO, stats.nightReads),
                unlocked: !!unlockedAchievements.nocturno,
                unlockedAt: unlockedAchievements.nocturno?.unlockedAt || null
            },
            estrella: {
                type: ACHIEVEMENT_TYPES.ESTRELLA,
                ...calculateAchievementLevel(ACHIEVEMENT_TYPES.ESTRELLA, stats.ratings),
                unlocked: !!unlockedAchievements.estrella,
                unlockedAt: unlockedAchievements.estrella?.unlockedAt || null
            }
        };

        res.json({
            success: true,
            data: {
                achievements,
                stats
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener configuración de todos los logros disponibles
 * GET /api/achievements/config
 */
const getAchievementsConfig = async (req, res, next) => {
    try {
        const configs = getAllAchievements();
        
        res.json({
            success: true,
            data: { configs }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Verificar y actualizar logros del usuario
 * Esta función se llama internamente cuando el usuario realiza acciones
 * que pueden desbloquear o subir de nivel un logro
 * 
 * @param {number} userId - ID del usuario
 * @param {string} achievementType - Tipo de logro a verificar
 * @param {number} newValue - Nuevo valor de la estadística
 * @returns {Promise<object>} Información sobre logros desbloqueados
 */
const checkAndUpdateAchievements = async (userId, achievementType, newValue) => {
    try {
        return await transaction(async (client) => {
            // Obtener nivel actual del logro
            const currentResult = await client.query(
                `SELECT level FROM user_achievements 
                 WHERE user_id = $1 AND achievement_type = $2`,
                [userId, achievementType]
            );

            const currentLevel = currentResult.rows[0]?.level || 0;
            
            // Calcular nuevo nivel basado en el valor
            const levelInfo = calculateAchievementLevel(achievementType, newValue);
            const newLevel = levelInfo.level;

            // Si subió de nivel o desbloqueó el logro
            if (newLevel > currentLevel) {
                // Insertar o actualizar el logro
                await client.query(
                    `INSERT INTO user_achievements (user_id, achievement_type, level, unlocked_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (user_id, achievement_type)
                     DO UPDATE SET 
                        level = EXCLUDED.level,
                        unlocked_at = NOW()`,
                    [userId, achievementType, newLevel]
                );

                // Actualizar progreso
                await client.query(
                    `INSERT INTO achievement_progress (user_id, achievement_type, current_value)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (user_id, achievement_type)
                     DO UPDATE SET 
                        current_value = EXCLUDED.current_value,
                        updated_at = NOW()`,
                    [userId, achievementType, newValue]
                );

                return {
                    unlocked: true,
                    newLevel,
                    previousLevel: currentLevel,
                    levelName: levelInfo.name,
                    color: levelInfo.color,
                    achievementType
                };
            }

            // Solo actualizar progreso
            await client.query(
                `INSERT INTO achievement_progress (user_id, achievement_type, current_value)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, achievement_type)
                 DO UPDATE SET 
                    current_value = EXCLUDED.current_value,
                    updated_at = NOW()`,
                [userId, achievementType, newValue]
            );

            return {
                unlocked: false,
                newLevel: currentLevel,
                previousLevel: currentLevel
            };
        });
    } catch (error) {
        console.error('Error checking achievements:', error);
        // No crítico - no afectar la operación principal
        return { unlocked: false, error: error.message };
    }
};

/**
 * Actualizar múltiples logros del usuario (batch update)
 * Se llama después de acciones que pueden afectar múltiples logros
 * 
 * @param {number} userId - ID del usuario
 * @param {object} stats - Estadísticas actuales del usuario
 * @returns {Promise<array>} Array de logros desbloqueados
 */
const updateMultipleAchievements = async (userId, stats) => {
    const updates = [];
    
    try {
        // Verificar cada tipo de logro (incluye racha)
        const checks = [
            checkAndUpdateAchievements(userId, ACHIEVEMENT_TYPES.RACHA, stats.streak),
            checkAndUpdateAchievements(userId, ACHIEVEMENT_TYPES.DIAMANTE, stats.totalChapters),
            checkAndUpdateAchievements(userId, ACHIEVEMENT_TYPES.VELOZ, stats.maxChaptersPerHour),
            checkAndUpdateAchievements(userId, ACHIEVEMENT_TYPES.CRITICO, stats.comments),
            checkAndUpdateAchievements(userId, ACHIEVEMENT_TYPES.NOCTURNO, stats.nightReads),
            checkAndUpdateAchievements(userId, ACHIEVEMENT_TYPES.ESTRELLA, stats.ratings)
        ];

        const results = await Promise.allSettled(checks);
        
        // Filtrar solo los que se desbloquearon
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.unlocked) {
                updates.push(result.value);
            }
        }

        return updates;
    } catch (error) {
        console.error('Error updating multiple achievements:', error);
        return updates;
    }
};

/**
 * Obtener el top de usuarios por logros
 * GET /api/achievements/leaderboard
 */
const getAchievementsLeaderboard = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const achievementType = req.query.type || null;

        let leaderboardQuery;
        let queryParams;

        if (achievementType && Object.values(ACHIEVEMENT_TYPES).includes(achievementType)) {
            // Leaderboard de un logro específico
            leaderboardQuery = `
                SELECT 
                    u.id, u.username, u.display_name, u.avatar_url,
                    ua.level, ua.unlocked_at,
                    ap.current_value
                FROM user_achievements ua
                JOIN users u ON ua.user_id = u.id
                LEFT JOIN achievement_progress ap 
                    ON ua.user_id = ap.user_id 
                    AND ua.achievement_type = ap.achievement_type
                WHERE ua.achievement_type = $1
                ORDER BY ua.level DESC, ap.current_value DESC, ua.unlocked_at ASC
                LIMIT $2
            `;
            queryParams = [achievementType, limit];
        } else {
            // Leaderboard general - usuarios con más logros totales
            leaderboardQuery = `
                SELECT 
                    u.id, u.username, u.display_name, u.avatar_url,
                    COUNT(ua.id) as total_achievements,
                    SUM(ua.level) as total_levels,
                    MAX(ua.unlocked_at) as last_unlock
                FROM users u
                LEFT JOIN user_achievements ua ON u.id = ua.user_id
                GROUP BY u.id, u.username, u.display_name, u.avatar_url
                HAVING COUNT(ua.id) > 0
                ORDER BY total_levels DESC, total_achievements DESC, last_unlock DESC
                LIMIT $1
            `;
            queryParams = [limit];
        }

        const result = await query(leaderboardQuery, queryParams);

        res.json({
            success: true,
            data: {
                leaderboard: result.rows,
                type: achievementType || 'general',
                count: result.rows.length
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUserAchievements,
    getAchievementsConfig,
    checkAndUpdateAchievements,
    updateMultipleAchievements,
    getAchievementsLeaderboard
};
