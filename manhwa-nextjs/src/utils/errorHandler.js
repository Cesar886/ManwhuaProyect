/**
 * Sistema centralizado de manejo de errores
 * Proporciona logging consistente y manejo de errores en toda la app
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Niveles de log
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Logger centralizado con niveles
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  debug(message, data) {
    if (isDevelopment) {
      console.log(`🔵 [${this.context}] ${message}`, data || '');
    }
  }

  info(message, data) {
    if (isDevelopment) {
      console.info(`ℹ️ [${this.context}] ${message}`, data || '');
    }
  }

  warn(message, data) {
    console.warn(`⚠️ [${this.context}] ${message}`, data || '');
  }

  error(message, error) {
    console.error(`🔴 [${this.context}] ${message}`, error || '');

    // Enviar a servicio de tracking en producción
    if (!isDevelopment && typeof window !== 'undefined') {
      this.trackError(message, error);
    }
  }

  trackError(message, error) {
    // Integración con servicios de tracking (Sentry, LogRocket, etc.)
    try {
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: `${message}: ${error?.message || error}`,
          fatal: false,
        });
      }
    } catch (e) {
      // Ignorar errores de tracking
    }
  }
}

/**
 * Crear logger con contexto
 */
export const createLogger = (context) => new Logger(context);

/**
 * Logger por defecto
 */
export const logger = new Logger('App');

/**
 * Wrapper para funciones async con manejo de errores
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Opciones de configuración
 * @returns {Function} - Función wrapped con manejo de errores
 */
export const withErrorHandler = (fn, options = {}) => {
  const {
    context = 'Operation',
    fallbackValue = null,
    onError = null,
    silent = false,
  } = options;

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (!silent) {
        logger.error(`${context} failed`, error);
      }

      if (onError) {
        onError(error);
      }

      return fallbackValue;
    }
  };
};

/**
 * Validar y normalizar datos de API
 * @param {*} data - Datos a validar
 * @param {Object} schema - Schema de validación
 * @returns {Object} - Datos normalizados
 */
export const validateApiResponse = (data, schema = {}) => {
  if (!data) {
    throw new Error('No data provided');
  }

  const normalized = {};

  for (const [key, validator] of Object.entries(schema)) {
    const value = data[key];

    if (validator.required && (value === undefined || value === null)) {
      throw new Error(`Missing required field: ${key}`);
    }

    if (validator.type && value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== validator.type) {
        logger.warn(`Type mismatch for ${key}: expected ${validator.type}, got ${actualType}`);
      }
    }

    normalized[key] = validator.default !== undefined && (value === undefined || value === null)
      ? validator.default
      : value;
  }

  return normalized;
};

/**
 * Retry helper para operaciones que pueden fallar
 * @param {Function} fn - Función a ejecutar
 * @param {Object} options - Opciones de retry
 * @returns {Promise} - Resultado de la función
 */
export const retryOperation = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    delayMs = 1000,
    exponentialBackoff = true,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = exponentialBackoff
          ? delayMs * Math.pow(2, attempt)
          : delayMs;

        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);

        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

/**
 * Safe JSON parse con fallback
 * @param {string} json - JSON string
 * @param {*} fallback - Valor de fallback si falla el parse
 * @returns {*} - Objeto parseado o fallback
 */
export const safeJsonParse = (json, fallback = null) => {
  try {
    return JSON.parse(json);
  } catch (e) {
    logger.warn('Failed to parse JSON', e);
    return fallback;
  }
};

/**
 * Safe localStorage operations
 */
export const storage = {
  get: (key, fallback = null) => {
    if (typeof window === 'undefined') return fallback;

    try {
      const item = localStorage.getItem(key);
      return item ? safeJsonParse(item, fallback) : fallback;
    } catch (e) {
      logger.warn(`Failed to get item from localStorage: ${key}`, e);
      return fallback;
    }
  },

  set: (key, value) => {
    if (typeof window === 'undefined') return false;

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      logger.warn(`Failed to set item in localStorage: ${key}`, e);
      return false;
    }
  },

  remove: (key) => {
    if (typeof window === 'undefined') return false;

    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      logger.warn(`Failed to remove item from localStorage: ${key}`, e);
      return false;
    }
  },

  clear: () => {
    if (typeof window === 'undefined') return false;

    try {
      localStorage.clear();
      return true;
    } catch (e) {
      logger.warn('Failed to clear localStorage', e);
      return false;
    }
  },
};

export default {
  logger,
  createLogger,
  withErrorHandler,
  validateApiResponse,
  retryOperation,
  safeJsonParse,
  storage,
};
