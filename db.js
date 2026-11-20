'use strict';

const { Pool } = require('pg');

let pool = null;
let available = false;
let logger = {
    info: (message, data) => console.log(message, data || ''),
    warn: (message, data) => console.warn(message, data || ''),
    error: (message, error) => console.error(message, error || ''),
};

function setLogger(nextLogger) {
    if (nextLogger) logger = nextLogger;
}

function getConnectionConfig() {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === 'false'
                ? false
                : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
        };
    }

    if (!process.env.DB_HOST) return null;

    return {
        host: process.env.DB_HOST,
        port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true'
            ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
            : false,
    };
}

async function ensureSchema(client) {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(`
        CREATE TABLE IF NOT EXISTS series_embeddings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            embedding_text TEXT NOT NULL,
            embedding vector(1536) NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS series_embeddings_embedding_hnsw_idx
        ON series_embeddings USING hnsw (embedding vector_cosine_ops)
    `);
    await client.query(`
        CREATE TABLE IF NOT EXISTS query_embeddings_cache (
            query_key TEXT PRIMARY KEY,
            embedding vector(1536) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await client.query(`
        CREATE INDEX IF NOT EXISTS query_embeddings_cache_created_at_idx
        ON query_embeddings_cache (created_at)
    `);
}

async function initDB() {
    if (pool) return healthCheck();

    const config = getConnectionConfig();
    if (!config) {
        available = false;
        logger.warn('PostgreSQL no configurado; búsqueda vectorial deshabilitada');
        return false;
    }

    pool = new Pool({
        ...config,
        max: Number.parseInt(process.env.DB_POOL_MAX, 10) || 10,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 5000,
        idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
    });
    pool.on('error', (error) => {
        available = false;
        logger.error('Error inesperado en el pool PostgreSQL', error);
    });

    let client;
    try {
        client = await pool.connect();
        await ensureSchema(client);
        available = true;
        logger.info('PostgreSQL conectado; búsqueda vectorial habilitada');
        return true;
    } catch (error) {
        available = false;
        logger.warn('PostgreSQL no disponible; búsqueda vectorial deshabilitada', {
            error: error.message,
        });
        await pool.end().catch(() => {});
        pool = null;
        return false;
    } finally {
        client?.release();
    }
}

async function healthCheck() {
    if (!pool) {
        available = false;
        return false;
    }
    try {
        await pool.query('SELECT 1');
        available = true;
        return true;
    } catch (error) {
        available = false;
        logger.warn('Health check PostgreSQL falló', { error: error.message });
        return false;
    }
}

function dbAvailable() {
    return available;
}

function getPool() {
    return available ? pool : null;
}

async function getSeriesEmbeddingCount() {
    if (!pool || !available) return 0;
    const result = await pool.query('SELECT COUNT(*)::integer AS count FROM series_embeddings');
    return Number(result.rows[0]?.count) || 0;
}

async function cleanQueryCache(maxAgeDays = 7) {
    if (!pool || !available) return 0;
    const days = Math.max(1, Number.parseInt(maxAgeDays, 10) || 7);
    const result = await pool.query(
        `DELETE FROM query_embeddings_cache
         WHERE created_at < NOW() - ($1::integer * INTERVAL '1 day')`,
        [days]
    );
    return result.rowCount || 0;
}

module.exports = {
    initDB,
    dbAvailable,
    healthCheck,
    setLogger,
    getPool,
    getSeriesEmbeddingCount,
    cleanQueryCache,
};




