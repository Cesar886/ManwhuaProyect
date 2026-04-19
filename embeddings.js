const { getPool, dbAvailable } = require('./db');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

// Logger fallback
let logger = {
    info: (msg, data) => console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg, data: data || null })),
    warn: (msg, data) => console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg, data: data || null })),
    error: (msg, err) => console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg, error: err && (err.message || err) }))
};

function setLogger(l) {
    if (l) logger = l;
}

/**
 * Construye el texto rico para generar el embedding de una serie.
 * Concatena todos los campos semánticos relevantes.
 */
function buildEmbeddingText(series) {
    const parts = [];

    if (series.title) parts.push(`Titulo: ${series.title}`);
    if (series.originalTitle) parts.push(`Titulo original: ${series.originalTitle}`);
    if (series.synopsis) parts.push(`Sinopsis: ${series.synopsis}`);

    const genres = Array.isArray(series.genres)
        ? series.genres.map(g => (g && (g.name || g)) || '').filter(Boolean)
        : [];
    if (genres.length > 0) parts.push(`Generos: ${genres.join(', ')}`);

    const themes = Array.isArray(series.themes) ? series.themes.filter(Boolean) : [];
    if (themes.length > 0) parts.push(`Temas: ${themes.join(', ')}`);

    const tropes = Array.isArray(series.narrativeTropes) ? series.narrativeTropes.filter(Boolean) : [];
    if (tropes.length > 0) parts.push(`Tropos: ${tropes.join(', ')}`);

    if (series.tone) parts.push(`Tono: ${series.tone}`);
    if (series.protagonistType) parts.push(`Protagonista: ${series.protagonistType}`);
    if (series.powerSystem) parts.push(`Sistema de poder: ${series.powerSystem}`);
    if (series.artStyle) parts.push(`Estilo de arte: ${series.artStyle}`);
    if (series.targetDemographic) parts.push(`Demografica: ${series.targetDemographic}`);
    if (series.romanceLevel) parts.push(`Romance: ${series.romanceLevel}`);
    if (series.status) parts.push(`Estado: ${series.status}`);

    const altTitles = Array.isArray(series.alternativeTitles) ? series.alternativeTitles.filter(Boolean) : [];
    if (altTitles.length > 0) parts.push(`Titulos alternativos: ${altTitles.join(', ')}`);

    const hashtags = Array.isArray(series.officialHashtags) ? series.officialHashtags.filter(Boolean) : [];
    if (hashtags.length > 0) parts.push(`Tags: ${hashtags.join(', ')}`);

    // Limitar a 8000 caracteres para no exceder límites del modelo
    return parts.join('. ').substring(0, 8000);
}

/**
 * Llama a la API de OpenAI para generar embeddings.
 * Soporta batching (múltiples textos a la vez).
 */
async function getEmbeddings(texts) {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada');
    if (!texts || texts.length === 0) return [];

    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: texts
        })
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`OpenAI Embeddings API error ${response.status}: ${errorBody.substring(0, 200)}`);
    }

    const data = await response.json();

    // Ordenar por index para mantener correspondencia con textos de entrada
    return data.data
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding);
}

// QUERY_EXPANSIONS vive en ./query-expansions para que query-rewriter.js
// y los tests puedan requerirlo sin arrastrar la dependencia de DB.
const { QUERY_EXPANSIONS } = require('./query-expansions');

/**
 * Expande la query del usuario con sinónimos y términos relacionados.
 * Mejora la similitud vectorial sin cambiar la intención.
 */
function expandQueryForEmbedding(queryText) {
    const lower = queryText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let expanded = queryText;

    for (const [key, expansion] of Object.entries(QUERY_EXPANSIONS)) {
        if (lower.includes(key)) {
            expanded += ' ' + expansion;
        }
    }

    // Limitar a 500 chars para no diluir la query
    return expanded.substring(0, 500);
}

/**
 * Wrapper para obtener el embedding de una sola query.
 * Aplica query expansion antes de generar el embedding.
 */
async function getQueryEmbedding(queryText) {
    const expandedQuery = expandQueryForEmbedding(queryText);
    logger.info('Query expandida para embedding', {
        original: queryText,
        expanded: expandedQuery.substring(0, 100) + (expandedQuery.length > 100 ? '...' : '')
    });
    const embeddings = await getEmbeddings([expandedQuery]);
    return embeddings[0];
}

/**
 * Inserta o actualiza el embedding de una serie en PostgreSQL.
 */
async function upsertSeriesEmbedding(id, title, embeddingText, embedding) {
    const pool = getPool();
    if (!pool) return;

    const pgvector = require('pgvector');
    const vectorStr = pgvector.toSql(embedding);

    await pool.query(
        `INSERT INTO series_embeddings (id, title, embedding_text, embedding, updated_at)
         VALUES ($1, $2, $3, $4::vector, NOW())
         ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            embedding_text = EXCLUDED.embedding_text,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()`,
        [id, title, embeddingText, vectorStr]
    );
}

/**
 * Búsqueda vectorial: encuentra las series más similares a un embedding dado.
 * Usa cosine similarity con el índice HNSW.
 *
 * Opciones:
 *   - allowedIds: array de IDs de series. Si se provee, pgvector solo calcula
 *     similitud sobre esas filas (pre-filtrado a nivel DB). Útil para forzar
 *     que la búsqueda ocurra dentro de un subset (p.ej. series de un idioma).
 */
async function vectorSearch(queryEmbedding, limit = 15, minSimilarity = 0.30, options = {}) {
    const pool = getPool();
    if (!pool) return [];

    const pgvector = require('pgvector');
    const vectorStr = pgvector.toSql(queryEmbedding);

    const allowedIds = Array.isArray(options.allowedIds) && options.allowedIds.length > 0
        ? options.allowedIds
        : null;

    const sql = allowedIds
        ? `SELECT id, title, 1 - (embedding <=> $1::vector) AS similarity
           FROM series_embeddings
           WHERE 1 - (embedding <=> $1::vector) >= $2
             AND id = ANY($4::text[])
           ORDER BY embedding <=> $1::vector
           LIMIT $3`
        : `SELECT id, title, 1 - (embedding <=> $1::vector) AS similarity
           FROM series_embeddings
           WHERE 1 - (embedding <=> $1::vector) >= $2
           ORDER BY embedding <=> $1::vector
           LIMIT $3`;

    const params = allowedIds
        ? [vectorStr, minSimilarity, limit, allowedIds]
        : [vectorStr, minSimilarity, limit];

    const result = await pool.query(sql, params);

    return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        similarity: parseFloat(row.similarity)
    }));
}

/**
 * Obtiene un embedding de query cacheado en PostgreSQL.
 */
async function getCachedQueryEmbedding(queryKey) {
    const pool = getPool();
    if (!pool) return null;

    const result = await pool.query(
        'SELECT embedding FROM query_embeddings_cache WHERE query_key = $1',
        [queryKey]
    );

    if (result.rows.length === 0) return null;

    // pgvector devuelve el vector como string, parsearlo
    const pgvector = require('pgvector');
    return pgvector.fromSql(result.rows[0].embedding);
}

/**
 * Cachea un embedding de query en PostgreSQL.
 */
async function cacheQueryEmbedding(queryKey, embedding) {
    const pool = getPool();
    if (!pool) return;

    const pgvector = require('pgvector');
    const vectorStr = pgvector.toSql(embedding);

    await pool.query(
        `INSERT INTO query_embeddings_cache (query_key, embedding, created_at)
         VALUES ($1, $2::vector, NOW())
         ON CONFLICT (query_key) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            created_at = NOW()`,
        [queryKey, vectorStr]
    );
}

/**
 * Sincroniza embeddings de series nuevas que no existen en PostgreSQL.
 * Solo procesa las que faltan para no repetir trabajo.
 */
async function syncEmbeddings(seriesCache) {
    const pool = getPool();
    if (!pool || !dbAvailable()) {
        logger.warn('syncEmbeddings: DB no disponible');
        return { synced: 0, errors: 0 };
    }

    // Obtener IDs que ya tienen embedding
    const existingResult = await pool.query('SELECT id FROM series_embeddings');
    const existingIds = new Set(existingResult.rows.map(r => r.id));

    // Filtrar series que necesitan embedding
    const pending = seriesCache.filter(s => !existingIds.has(s.id));

    if (pending.length === 0) {
        logger.info('syncEmbeddings: Todas las series ya tienen embedding');
        return { synced: 0, errors: 0 };
    }

    logger.info('syncEmbeddings: Iniciando sync', { pending: pending.length, existing: existingIds.size });

    let synced = 0;
    let errors = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);

        try {
            // Construir textos de embedding para el batch
            const texts = batch.map(s => buildEmbeddingText(s));

            // Obtener embeddings de OpenAI
            const embeddings = await getEmbeddings(texts);

            // Upsert cada uno
            for (let j = 0; j < batch.length; j++) {
                try {
                    await upsertSeriesEmbedding(
                        batch[j].id,
                        batch[j].title,
                        texts[j],
                        embeddings[j]
                    );
                    synced++;
                } catch (err) {
                    errors++;
                    logger.warn('Error en upsert de embedding', { id: batch[j].id, error: err.message });
                }
            }

            logger.info('syncEmbeddings: Batch procesado', {
                batch: Math.floor(i / BATCH_SIZE) + 1,
                total_batches: Math.ceil(pending.length / BATCH_SIZE),
                synced,
                errors
            });

            // Pausa de 1s entre batches para no saturar la API
            if (i + BATCH_SIZE < pending.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (err) {
            errors += batch.length;
            logger.error('Error en batch de embeddings', { batch: Math.floor(i / BATCH_SIZE) + 1, error: err.message });
            // Pausa más larga si hay error (rate limit, etc.)
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    logger.info('syncEmbeddings: Completado', { synced, errors, total: pending.length });
    return { synced, errors };
}

module.exports = {
    buildEmbeddingText,
    expandQueryForEmbedding,
    getEmbeddings,
    getQueryEmbedding,
    upsertSeriesEmbedding,
    vectorSearch,
    getCachedQueryEmbedding,
    cacheQueryEmbedding,
    syncEmbeddings,
    setLogger,
    QUERY_EXPANSIONS
};
