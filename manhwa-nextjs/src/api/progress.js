/**
 * API de Progreso de Lectura - Ultra Optimizada v2
 * - Manejo robusto de errores
 * - Validación de datos
 * - Logging inteligente
 * - Retry automático
 */

import { api } from './client';
import { createLogger, storage, validateApiResponse, withErrorHandler } from '../utils/errorHandler';
import { ENDPOINTS } from '../config';

const logger = createLogger('ProgressAPI');

// Device ID cache
let cachedDeviceId = null;

/**
 * Obtener o generar Device ID
 * @returns {string} Device ID único del dispositivo
 */
export function getDeviceId() {
  if (typeof window === 'undefined') return null;
  if (cachedDeviceId) return cachedDeviceId;

  try {
    let deviceId = storage.get('device_id');

    if (!deviceId) {
      // Generar UUID v4
      if (window.crypto?.randomUUID) {
        deviceId = window.crypto.randomUUID();
      } else {
        // Fallback para navegadores viejos
        deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }

      storage.set('device_id', deviceId);
    }

    cachedDeviceId = deviceId;
    return deviceId;
  } catch (error) {
    logger.warn('Failed to get/set device ID, using temp ID', error);

    // ID temporal en memoria
    if (!cachedDeviceId) {
      cachedDeviceId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return cachedDeviceId;
  }
}

/**
 * Guardar progreso de lectura
 * @param {Object} data - Datos del progreso
 * @returns {Promise<Object|null>} Respuesta del servidor
 */
export const saveProgress = withErrorHandler(
  async (data) => {
    // Validación de entrada
    if (!data?.slug || !(Number(data?.chapterNum) >= 1)) {
      logger.warn('Invalid progress data', { slug: data?.slug, chapterNum: data?.chapterNum });
      throw new Error('slug y chapterNum son requeridos');
    }

    // Normalizar y validar datos
    const payload = {
      slug: String(data.slug).trim(),
      chapterNum: Math.max(0, Number(data.chapterNum) || 0),
      scrollPosition: Math.max(0, Number(data.scrollPosition) || 0),
      progress: Math.min(100, Math.max(0, Number(data.progress) || 0)),
      totalPages: Math.max(0, Number(data.totalPages) || 0),
      isCompleted: Boolean(data.isCompleted),
      deviceId: data.deviceId || getDeviceId(),
    };

    logger.debug('Saving progress', payload);

    const response = await api.post('progress', '', payload);

    logger.debug('Progress saved successfully');

    return response?.data || response;
  },
  {
    context: 'saveProgress',
    fallbackValue: null,
    onError: (error) => {
      logger.error('Failed to save progress', error);
    },
  }
);

/**
 * Obtener progreso de un capítulo
 * @param {string} slug - Slug de la serie
 * @param {string|number} chapterNum - Número del capítulo
 * @returns {Promise<Object|null>} Datos del progreso
 */
export const getProgress = withErrorHandler(
  async (slug, chapterNum) => {
    // Validación
    if (!slug || !(Number(chapterNum) >= 1)) {
      logger.warn('Invalid getProgress params', { slug, chapterNum });
      return null;
    }

    const cleanSlug = String(slug).trim();
    const cleanChapter = String(chapterNum).trim();

    logger.debug('Fetching progress', { slug: cleanSlug, chapter: cleanChapter });

    const response = await api.get('progress', `${cleanSlug}/${cleanChapter}`);

    const progressData = response?.data?.progress;

    if (!progressData) {
      logger.debug('No progress data found');
      return null;
    }

    // Validar estructura de respuesta
    const validated = validateApiResponse(progressData, {
      progress: { type: 'number', default: 0 },
      scrollPosition: { type: 'number', default: 0 },
      totalPages: { type: 'number', default: 0 },
      syncedAt: { type: 'string', required: false },
      updatedAt: { type: 'string', required: false },
    });

    logger.debug('Progress fetched successfully', { progress: validated.progress });

    return validated;
  },
  {
    context: 'getProgress',
    fallbackValue: null,
    silent: false,
  }
);

/**
 * Sincronizar todo el progreso del usuario
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>} Lista de progresos
 */
export const syncProgress = withErrorHandler(
  async (limit = 100) => {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 100), 500);

    logger.debug('Syncing progress', { limit: safeLimit });

    const response = await api.get('progress', `sync?limit=${safeLimit}`);

    const progressList = response?.data?.progress;

    if (!Array.isArray(progressList)) {
      logger.warn('Invalid sync response, expected array');
      return [];
    }

    logger.debug('Progress synced', { count: progressList.length });

    return progressList;
  },
  {
    context: 'syncProgress',
    fallbackValue: [],
  }
);

/**
 * Obtener progresos recientes
 * @param {number} limit - Límite de resultados
 * @returns {Promise<Array>} Lista de progresos recientes
 */
export const getRecentProgress = withErrorHandler(
  async (limit = 10) => {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 50);

    logger.debug('Fetching recent progress', { limit: safeLimit });

    const response = await api.get('progress', `recent?limit=${safeLimit}`);

    const recentList = response?.data?.recent;

    if (!Array.isArray(recentList)) {
      logger.warn('Invalid recent response, expected array');
      return [];
    }

    logger.debug('Recent progress fetched', { count: recentList.length });

    return recentList;
  },
  {
    context: 'getRecentProgress',
    fallbackValue: [],
  }
);

/**
 * Eliminar progreso de un capítulo
 * @param {string} slug - Slug de la serie
 * @param {string|number} chapterNum - Número del capítulo
 * @returns {Promise<Object|null>} Respuesta del servidor
 */
export const deleteProgress = withErrorHandler(
  async (slug, chapterNum) => {
    if (!slug || !chapterNum) {
      logger.warn('Invalid deleteProgress params', { slug, chapterNum });
      return null;
    }

    const cleanSlug = String(slug).trim();
    const cleanChapter = String(chapterNum).trim();

    logger.debug('Deleting progress', { slug: cleanSlug, chapter: cleanChapter });

    const response = await api.del('progress', `${cleanSlug}/${cleanChapter}`);

    logger.debug('Progress deleted successfully');

    return response;
  },
  {
    context: 'deleteProgress',
    fallbackValue: null,
  }
);

/**
 * Limpiar todo el progreso del usuario
 * @returns {Promise<Object|null>} Respuesta del servidor
 */
export const clearAllProgress = withErrorHandler(
  async () => {
    logger.info('Clearing all progress');

    const response = await api.del('progress', '');

    logger.info('All progress cleared');

    return response;
  },
  {
    context: 'clearAllProgress',
    fallbackValue: null,
  }
);

export const getStreak = withErrorHandler(
  async () => {
    const response = await api.get('progress', 'streak');
    const data = response?.data;
    return {
      streak: data?.streak || 0,
      maxStreak: data?.maxStreak || 0,
      readToday: data?.readToday || false,
      totalDaysRead: data?.totalDaysRead || 0,
      chaptersRead: data?.chaptersRead || 0,
      lastReadAt: data?.lastReadAt || null,
    };
  },
  {
    context: 'getStreak',
    fallbackValue: { streak: 0, maxStreak: 0, readToday: false, totalDaysRead: 0, chaptersRead: 0, lastReadAt: null },
  }
);

/**
 * URL del endpoint SSE para actualizaciones de racha en tiempo real
 */
export const getStreakStreamUrl = () => `${ENDPOINTS.progress}/stream`;

const progressApi = {
  saveProgress,
  getProgress,
  syncProgress,
  getRecentProgress,
  getStreak,
  getStreakStreamUrl,
  deleteProgress,
  clearAllProgress,
  getDeviceId,
};

export default progressApi;

