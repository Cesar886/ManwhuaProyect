/**
 * Configuración de conexión a PostgreSQL
 * OPTIMIZADO: Pool más robusto, timeouts configurables, prepared statements
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// ============================================
// CONFIGURACIÓN OPTIMIZADA DEL POOL
// ============================================
const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'manhwa_db',
    user: process.env.DB_USER || 'manhwa_app',
    password: process.env.DB_PASSWORD,
    // Pool optimizado para mejor rendimiento
    max: parseInt(process.env.DB_POOL_MAX) || 25,              // Más conexiones para manejar picos
    min: parseInt(process.env.DB_POOL_MIN) || 5,               // Mantener conexiones mínimas calientes
    idleTimeoutMillis: 60000,                                  // 60s antes de cerrar conexión idle
    connectionTimeoutMillis: 5000,                             // 5s timeout para obtener conexión
    // Mantener conexiones vivas
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
};

// Timeout de statements (se configurará por sesión)
const statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000;

const pool = new Pool(poolConfig);

// Cache de prepared statements para queries frecuentes
const preparedStatements = new Map();

// ============================================
// MÉTRICAS Y MONITOREO
// ============================================
let queryMetrics = {
    total: 0,
    slow: 0,        // queries > 100ms
    verySlow: 0,    // queries > 500ms
    errors: 0
};

// Reiniciar métricas cada hora
setInterval(() => {
    if (process.env.NODE_ENV === 'development') {
        logger.info('📊 Métricas de queries (última hora):', queryMetrics);
    }
    queryMetrics = { total: 0, slow: 0, verySlow: 0, errors: 0 };
}, 3600000);

// Eventos del pool con más información
pool.on('connect', (client) => {
    // Configurar opciones de sesión para rendimiento
    // ✅ SEGURO: Validar y sanitizar antes de usar
    const timeoutMs = Math.max(0, parseInt(statementTimeout) || 30000);
    // Nota: PostgreSQL SET requiere valor literal, no acepta $1 para statement_timeout
    // Validamos que sea número para prevenir inyección
    if (Number.isInteger(timeoutMs) && timeoutMs >= 0) {
        client.query(`SET statement_timeout = ${timeoutMs}`).catch(err => {
            console.warn('⚠️ No se pudo establecer statement_timeout:', err.message);
        });
    }
    if (process.env.NODE_ENV === 'development') {
        logger.info(`📦 Nueva conexión (total: ${pool.totalCount}, idle: ${pool.idleCount})`);
    }
});

pool.on('error', (err) => {
    console.error('❌ Error en el pool de PostgreSQL:', err);
    queryMetrics.errors++;
});

pool.on('remove', () => {
    if (process.env.NODE_ENV === 'development') {
        logger.info(`🔌 Conexión removida (total: ${pool.totalCount})`);
    }
});

/**
 * Probar conexión a la base de datos
 */
const testConnection = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as now');
        client.release();
        logger.info('✅ Conexión a PostgreSQL exitosa:', result.rows[0].now);
        logger.info(`📊 Pool config: max=${poolConfig.max}, min=${poolConfig.min}`);
        return true;
    } catch (error) {
        logger.error('❌ Error conectando a PostgreSQL:', error.message);
        throw error;
    }
};

// ============================================
// UMBRALES DE QUERIES CONFIGURABLES
// ============================================
const QUERY_THRESHOLDS = {
    slow: parseInt(process.env.DB_SLOW_QUERY_MS) || 100,      // Query lenta: > 100ms
    verySlow: parseInt(process.env.DB_VERY_SLOW_QUERY_MS) || 500 // Query muy lenta: > 500ms
};

/**
 * Ejecutar query con manejo de errores OPTIMIZADO
 * - Métricas de rendimiento
 * - Logging inteligente
 * - Retry automático para errores transitorios
 */
const query = async (text, params, options = {}) => {
    const start = Date.now();
    const { retryCount = 0, maxRetries = 2 } = options;
    
    queryMetrics.total++;
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        // Clasificar query por rendimiento
        if (duration > QUERY_THRESHOLDS.verySlow) {
            queryMetrics.verySlow++;
            logger.warn('🐌 Query MUY LENTA:', { 
                text: text.substring(0, 120), 
                duration: `${duration}ms`,
                params: params?.length || 0
            });
        } else if (duration > QUERY_THRESHOLDS.slow) {
            queryMetrics.slow++;
            if (process.env.NODE_ENV === 'development') {
                logger.debug('🐢 Query lenta:', { 
                    text: text.substring(0, 100), 
                    duration: `${duration}ms` 
                });
            }
        }
        
        return result;
    } catch (error) {
        queryMetrics.errors++;
        
        // Retry para errores transitorios (conexión perdida, timeout)
        const isTransient = error.code === 'ECONNRESET' || 
                           error.code === '57P01' || // admin shutdown
                           error.code === '57P02' || // crash shutdown
                           error.code === '08006';   // connection failure
        
        if (isTransient && retryCount < maxRetries) {
            logger.warn(`⚠️ Error transitorio, reintentando (${retryCount + 1}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, 100 * (retryCount + 1)));
            return query(text, params, { ...options, retryCount: retryCount + 1 });
        }
        
        logger.error('❌ Error en query:', { 
            message: error.message, 
            code: error.code,
            query: text.substring(0, 80) 
        });
        throw error;
    }
};

/**
 * Query optimizada para autenticación (más frecuente)
 * Usa campos mínimos necesarios para mejor rendimiento
 */
const queryUserForAuth = async (userId) => {
    // Query optimizada: solo campos necesarios para auth
    const result = await query(
        `SELECT id, username, email, display_name, avatar_url, role, status, 
                is_premium, premium_until, email_verified_at
         FROM users 
         WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
    );
    return result;
};

/**
 * Ejecutar transacción con retry automático
 */
const transaction = async (callback, options = {}) => {
    const { maxRetries = 2 } = options;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            lastError = error;
            
            // Solo reintentar errores de serialización
            if (error.code === '40001' && attempt < maxRetries) {
                console.warn(`⚠️ Conflicto de serialización, reintentando (${attempt + 1}/${maxRetries})...`);
                await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
                continue;
            }
            throw error;
        } finally {
            client.release();
        }
    }
    throw lastError;
};

/**
 * Obtener estadísticas del pool (útil para monitoreo)
 */
const getPoolStats = () => ({
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    metrics: { ...queryMetrics }
});

module.exports = {
    pool,
    query,
    queryUserForAuth,
    transaction,
    testConnection,
    getPoolStats,
    QUERY_THRESHOLDS
};
