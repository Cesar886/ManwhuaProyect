/**
 * API Client - Achievements (Logros)
 * Funciones para interactuar con el sistema de logros
 */

import api from './client';

/**
 * Obtener todos los logros del usuario autenticado
 * @returns {Promise<Object>} - Logros y estadísticas del usuario
 */
export const getUserAchievements = async () => {
  try {
    const response = await api.get('achievements');
    return response?.data || null;
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    return {
      achievements: {},
      stats: {
        streak: 0,
        totalChapters: 0,
        comments: 0,
        nightReads: 0,
        maxChaptersPerHour: 0,
        ratings: 0,
      },
    };
  }
};

/**
 * Obtener configuración de todos los logros disponibles
 * @returns {Promise<Object>} - Configuraciones de logros
 */
export const getAchievementsConfig = async () => {
  try {
    const response = await api.get('achievements/config');
    return response?.data?.configs || [];
  } catch (error) {
    console.error('Error fetching achievements config:', error);
    return [];
  }
};

/**
 * Obtener leaderboard de logros
 * @param {string} type - Tipo de logro (opcional)
 * @param {number} limit - Límite de resultados (default: 50)
 * @returns {Promise<Object>} - Leaderboard
 */
export const getAchievementsLeaderboard = async (type = null, limit = 50) => {
  try {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    params.append('limit', limit.toString());
    
    const response = await api.get(`achievements/leaderboard?${params.toString()}`);
    return response?.data || { leaderboard: [], type: type || 'general', count: 0 };
  } catch (error) {
    console.error('Error fetching achievements leaderboard:', error);
    return { leaderboard: [], type: type || 'general', count: 0 };
  }
};

export default {
  getUserAchievements,
  getAchievementsConfig,
  getAchievementsLeaderboard,
};
