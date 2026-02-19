'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getProgress } from '../api/progress';
import { checkBookmark } from '../api/requests';
import { createLogger, storage, withErrorHandler, retryOperation } from '../utils/errorHandler';

const logger = createLogger('useSeriesProgress');

// Constantes de configuración
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Hook ultra-optimizado para progreso de lectura
 *
 * Características:
 * - ✅ Cache inteligente con localStorage
 * - ✅ Sincronización automática con backend
 * - ✅ Retry automático en caso de fallo
 * - ✅ Validación de datos
 * - ✅ Manejo robusto de errores
 * - ✅ Prevención de race conditions
 * - ✅ Cleanup automático
 *
 * @param {string} seriesId - ID de la serie
 * @param {string} slug - Slug de la serie
 * @param {Object} user - Usuario actual
 * @returns {Object} Estado del progreso y funciones
 */
export function useSeriesProgress(seriesId, slug, user) {
  const [state, setState] = useState({
    loading: true,
    bookmarkData: null,
    readingProgress: null,
    error: null,
  });

  // Refs para prevenir race conditions
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  // Cache key seguro
  const cacheKey = useMemo(
    () => {
      if (!seriesId || typeof seriesId !== 'string') return null;
      return `progress_v2_${seriesId}`;
    },
    [seriesId]
  );

  /**
   * Cargar datos desde cache
   */
  const loadFromCache = useCallback(() => {
    if (!cacheKey) return null;

    try {
      const cached = storage.get(cacheKey);
      if (!cached) return null;

      const age = Date.now() - (cached.timestamp || 0);
      if (age > CACHE_DURATION_MS) {
        logger.debug('Cache expired, removing');
        storage.remove(cacheKey);
        return null;
      }

      logger.debug('Cache hit', { age: `${Math.round(age / 1000)}s` });
      return cached;
    } catch (error) {
      logger.warn('Failed to load from cache', error);
      return null;
    }
  }, [cacheKey]);

  /**
   * Guardar datos en cache
   */
  const saveToCache = useCallback((data) => {
    if (!cacheKey) return false;

    try {
      const cacheData = {
        ...data,
        timestamp: Date.now(),
      };
      return storage.set(cacheKey, cacheData);
    } catch (error) {
      logger.warn('Failed to save to cache', error);
      return false;
    }
  }, [cacheKey]);

  /**
   * Normalizar datos del último capítulo leído
   */
  const getLastReadChapter = useCallback((bookmark) => {
    if (!bookmark) return null;
    return bookmark.lastReadChapter ||
           bookmark.last_read_chapter ||
           bookmark.lastChapter ||
           null;
  }, []);

  /**
   * Obtener datos de progreso con retry
   */
  const fetchProgressWithRetry = useCallback(async (slug, chapter) => {
    return await retryOperation(
      () => getProgress(slug, chapter),
      {
        maxRetries: MAX_RETRIES,
        delayMs: RETRY_DELAY_MS,
        onRetry: (attempt) => {
          logger.info(`Retrying progress fetch (${attempt}/${MAX_RETRIES})`);
        },
      }
    );
  }, []);

  /**
   * Fetch completo de datos
   */
  const fetchProgressData = useCallback(async (skipCache = false) => {
    // Validación de entrada
    if (!user || !seriesId || !slug) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
      return;
    }

    // Validar tipos
    if (typeof seriesId !== 'string' || typeof slug !== 'string') {
      logger.error('Invalid parameters', { seriesId, slug });
      if (mountedRef.current) {
        setState({
          loading: false,
          bookmarkData: null,
          readingProgress: null,
          error: 'Parámetros inválidos',
        });
      }
      return;
    }

    // Cancelar request anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      // Intentar cargar desde cache primero (solo si no se skipea)
      if (!skipCache) {
        const cached = loadFromCache();
        if (cached && mountedRef.current) {
          setState({
            loading: false,
            bookmarkData: cached.bookmark,
            readingProgress: cached.progress,
            error: null,
          });
          // Continuar obteniendo datos frescos en background
        }
      }

      // Obtener bookmark con retry
      const bookmarkResponse = await retryOperation(
        () => checkBookmark(seriesId),
        {
          maxRetries: MAX_RETRIES,
          delayMs: RETRY_DELAY_MS,
          onRetry: (attempt) => {
            logger.info(`Retrying bookmark fetch (${attempt}/${MAX_RETRIES})`);
          },
        }
      );

      if (!mountedRef.current) return;

      if (!bookmarkResponse?.data) {
        logger.warn('No bookmark data received');
        if (mountedRef.current) {
          setState({
            loading: false,
            bookmarkData: null,
            readingProgress: null,
            error: null,
          });
        }
        return;
      }

      const bookmark = bookmarkResponse.data;
      const lastChapter = getLastReadChapter(bookmark);

      let progressData = null;

      // Obtener progreso si existe último capítulo
      if (lastChapter && slug) {
        try {
          const progress = await fetchProgressWithRetry(slug, lastChapter);

          if (progress && mountedRef.current) {
            progressData = {
              chapter: lastChapter,
              progress: Math.min(100, Math.max(0, progress.progress || 0)),
              scrollPosition: progress.scrollPosition || 0,
              totalPages: progress.totalPages || 0,
              lastRead: progress.syncedAt || progress.updatedAt || null,
            };
          }
        } catch (error) {
          logger.warn('Failed to fetch progress, using fallback', error);
          // Fallback: datos básicos
          if (mountedRef.current) {
            progressData = {
              chapter: lastChapter,
              progress: 0,
            };
          }
        }
      }

      if (!mountedRef.current) return;

      // Guardar en cache
      saveToCache({
        bookmark,
        progress: progressData,
      });

      // Actualizar estado
      setState({
        loading: false,
        bookmarkData: bookmark,
        readingProgress: progressData,
        error: null,
      });

      logger.debug('Progress data loaded successfully');

    } catch (error) {
      logger.error('Failed to fetch progress data', error);

      if (mountedRef.current) {
        setState({
          loading: false,
          bookmarkData: null,
          readingProgress: null,
          error: error.message || 'Error al cargar progreso',
        });
      }
    }
  }, [user, seriesId, slug, loadFromCache, saveToCache, getLastReadChapter, fetchProgressWithRetry]);

  // Montar/desmontar
  useEffect(() => {
    mountedRef.current = true;
    fetchProgressData();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProgressData]);

  /**
   * Refrescar datos (invalida cache)
   */
  const refresh = useCallback(() => {
    logger.info('Refreshing progress data');
    if (cacheKey) {
      storage.remove(cacheKey);
    }
    return fetchProgressData(true);
  }, [fetchProgressData, cacheKey]);

  /**
   * Valores derivados (memoizados para performance)
   */
  const derived = useMemo(() => {
    const hasProgress = Boolean(state.readingProgress);
    const progressPercent = Math.round(state.readingProgress?.progress || 0);

    return {
      hasProgress,
      lastReadChapter: state.readingProgress?.chapter || null,
      progressPercent,
      isInLibrary: state.bookmarkData?.inLibrary || false,
      isFavorite: state.bookmarkData?.isFavorite || false,
      readingStatus: state.bookmarkData?.status || null,
      notificationsEnabled: state.bookmarkData?.notifyNewChapter || false,
    };
  }, [state]);

  return {
    ...state,
    refresh,
    ...derived,
  };
}

export default useSeriesProgress;

