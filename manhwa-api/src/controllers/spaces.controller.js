/**
 * Controlador para sincronización con DigitalOcean Spaces
 * Lee la estructura de manhwas directamente desde Spaces y los expone via webhook/SSE
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Cliente S3 para DigitalOcean Spaces
const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION,
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET
    }
});

/**
 * Construye la URL pública de un objeto en Spaces
 */
const buildPublicUrl = (key) => {
    const endpoint = process.env.DO_SPACES_ENDPOINT.replace('https://', '').replace('http://', '');
    return `https://${process.env.DO_SPACES_BUCKET}.${endpoint}/${key}`;
};

/**
 * Lista todos los objetos de un prefix en Spaces
 */
const listAllObjects = async (prefix = '') => {
    const objects = [];
    let continuationToken = null;

    do {
        const command = new ListObjectsV2Command({
            Bucket: process.env.DO_SPACES_BUCKET,
            Prefix: prefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            objects.push(...response.Contents);
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
    } while (continuationToken);

    return objects;
};

/**
 * Parsea la estructura de Spaces y agrupa por serie/capítulo
 * Estructura esperada: {series-slug}/cap-{XXXX}/{XXX}-{uuid}.webp
 */
const parseSpacesStructure = (objects) => {
    const seriesMap = new Map();

    // Patrones para detectar portadas
    const coverPatterns = ['cover', 'portada', 'thumbnail', 'poster'];

    for (const obj of objects) {
        const key = obj.Key;
        const parts = key.split('/');

        if (parts.length < 2) continue;

        const seriesSlug = parts[0];

        // Ignorar carpetas especiales
        if (['avatars', 'comments', 'uploads', 'temp'].includes(seriesSlug)) continue;

        if (!seriesMap.has(seriesSlug)) {
            seriesMap.set(seriesSlug, {
                slug: seriesSlug,
                title: slugToTitle(seriesSlug),
                cover: null,
                chapters: new Map(),
                lastModified: obj.LastModified
            });
        }

        const series = seriesMap.get(seriesSlug);

        // Actualizar fecha de última modificación
        if (obj.LastModified > series.lastModified) {
            series.lastModified = obj.LastModified;
        }

        // Detectar si es una portada (archivo en la raíz de la serie)
        if (parts.length === 2) {
            const fileName = parts[1].toLowerCase();
            if (coverPatterns.some(p => fileName.includes(p)) ||
                (fileName.match(/\.(jpg|jpeg|png|webp|gif)$/i) && !fileName.includes('cap'))) {
                series.cover = buildPublicUrl(key);
            }
            continue;
        }

        // Detectar capítulos: cap-XXXX o capitulo-X
        const chapterFolder = parts[1];
        const chapterMatch = chapterFolder.match(/^cap[ítulo]*[-_]?(\d+)/i);

        if (chapterMatch) {
            const chapterNumber = parseInt(chapterMatch[1]);

            if (!series.chapters.has(chapterNumber)) {
                series.chapters.set(chapterNumber, {
                    number: chapterNumber,
                    slug: `capitulo-${chapterNumber}`,
                    pages: [],
                    lastModified: obj.LastModified
                });
            }

            const chapter = series.chapters.get(chapterNumber);

            // Agregar páginas
            if (parts.length >= 3) {
                const fileName = parts[parts.length - 1];
                const pageMatch = fileName.match(/^(\d+)/);

                if (pageMatch && fileName.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                    chapter.pages.push({
                        number: parseInt(pageMatch[1]),
                        url: buildPublicUrl(key),
                        key: key
                    });
                }

                // Actualizar fecha del capítulo
                if (obj.LastModified > chapter.lastModified) {
                    chapter.lastModified = obj.LastModified;
                }
            }
        }
    }

    // Ordenar páginas dentro de cada capítulo
    for (const series of seriesMap.values()) {
        for (const chapter of series.chapters.values()) {
            chapter.pages.sort((a, b) => a.number - b.number);
            chapter.pageCount = chapter.pages.length;
        }
    }

    return seriesMap;
};

/**
 * Convierte un slug a título legible
 */
const slugToTitle = (slug) => {
    return slug
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Convierte el Map de series a array ordenado
 * 🔧 MEJORADO: Consulta BD para obtener cover_url y metadata actualizados
 */
const seriesToArray = async (seriesMap) => {
    const seriesArray = [];

    // Obtener todos los slugs para consulta batch
    const slugs = Array.from(seriesMap.keys());

    // Consultar BD para todos los slugs de una vez (optimización)
    // OPTIMIZADO: Usar = ANY($1) con array en lugar de IN con múltiples parámetros
    // Esto es ~10x más rápido para listas grandes (500+ slugs)
    let dbSeriesMap = new Map();
    try {
        if (slugs.length > 0) {
            // Consulta optimizada:
            // 1. Usar = ANY($1::text[]) en lugar de IN(...) - mucho más eficiente
            // 2. Usar subconsulta lateral para géneros - evita GROUP BY costoso
            // 3. Un solo parámetro array en lugar de N parámetros
            const dbResult = await query(
                `SELECT s.slug, s.cover_url, s.cover_url_web, s.title, s.original_title, s.status, s.content_type, s.is_adult, s.language,
                        s.view_count, s.rating_average, s.created_at, s.updated_at,
                        a.name as author_name,
                        COALESCE(g_agg.genres, ARRAY[]::text[]) as genres
                 FROM series s
                 LEFT JOIN authors a ON s.author_id = a.id
                 LEFT JOIN LATERAL (
                     SELECT array_agg(g.name ORDER BY g.name) as genres
                     FROM series_genres sg
                     JOIN genres g ON sg.genre_id = g.id
                     WHERE sg.series_id = s.id
                 ) g_agg ON true
                 WHERE s.slug = ANY($1::text[]) AND s.deleted_at IS NULL`,
                [slugs]
            );

            for (const row of dbResult.rows) {
                dbSeriesMap.set(row.slug, row);
            }
            logger.debug(`📊 Consultados ${dbResult.rows.length}/${slugs.length} series desde BD`);
        }
    } catch (dbError) {
        logger.warn('⚠️ Error consultando BD para covers, usando solo Spaces:', dbError.message);
    }

    for (const series of seriesMap.values()) {
        const chapters = Array.from(series.chapters.values())
            .sort((a, b) => b.number - a.number); // Más reciente primero

        // Obtener metadata de BD si existe
        const dbData = dbSeriesMap.get(series.slug);

        seriesArray.push({
            slug: series.slug,
            title: dbData?.title || series.title,
            cover: dbData?.cover_url || series.cover || (chapters.length > 0 && chapters[0].pages.length > 0
                ? chapters[0].pages[0].url
                : null),
            coverUrl: dbData?.cover_url || series.cover, // Campo adicional por compatibilidad
            coverUrlWeb: dbData?.cover_url_web || null,
            status: dbData?.status || 'ongoing',
            contentType: dbData?.content_type || 'manhwa',
            isAdult: dbData?.is_adult || false,
            language: dbData?.language || null,
            author: dbData?.author_name || null,
            genres: dbData?.genres || [],
            rating: parseFloat(dbData?.rating_average || 0),
            createdAt: dbData?.created_at,
            updatedAt: dbData?.updated_at,
            chapterCount: chapters.length,
            chapters: chapters.slice(0, 5).map(ch => ({
                number: ch.number,
                slug: ch.slug,
                pageCount: ch.pageCount,
                time: getRelativeTime(ch.lastModified)
            })),
            lastUpdated: series.lastModified,
            viewCount: dbData?.view_count || 0
        });
    }

    // Ordenar por última actualización
    return seriesArray.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
};

/**
 * Convierte Map de series a array usando datos de BD pre-cargados
 * Versión optimizada que no hace query propia (recibe dbSeriesMap)
 */
const seriesToArrayWithDb = async (seriesMap, dbSeriesMap) => {
    const seriesArray = [];

    for (const series of seriesMap.values()) {
        const chapters = Array.from(series.chapters.values())
            .sort((a, b) => b.number - a.number);

        const dbData = dbSeriesMap.get(series.slug);

        seriesArray.push({
            slug: series.slug,
            title: dbData?.title || series.title,
            cover: dbData?.cover_url || series.cover || (chapters.length > 0 && chapters[0].pages.length > 0
                ? chapters[0].pages[0].url
                : null),
            coverUrl: dbData?.cover_url || series.cover,
            coverUrlWeb: dbData?.cover_url_web || null,
            status: dbData?.status || 'ongoing',
            contentType: dbData?.content_type || 'manhwa',
            isAdult: dbData?.is_adult || false,
            language: dbData?.language || null,
            author: dbData?.author_name || null,
            genres: dbData?.genres || [],
            rating: parseFloat(dbData?.rating_average || 0),
            createdAt: dbData?.created_at,
            updatedAt: dbData?.updated_at,
            chapterCount: chapters.length,
            chapters: chapters.slice(0, 5).map(ch => ({
                number: ch.number,
                slug: ch.slug,
                pageCount: ch.pageCount,
                time: getRelativeTime(ch.lastModified)
            })),
            lastUpdated: series.lastModified,
            viewCount: dbData?.view_count || 0
        });
    }

    return seriesArray.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
};

/**
 * Calcula tiempo relativo (hace X minutos/horas/días)
 */
const getRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `hace ${days}d`;
    if (hours > 0) return `hace ${hours}h`;
    if (minutes > 0) return `hace ${minutes}m`;
    return 'ahora';
};

// ============================================
// CONFIGURACIÓN DE CACHE OPTIMIZADA V2
// Resuelve race conditions y bloqueos
// ============================================
const isDev = process.env.NODE_ENV === 'development';

const CACHE_CONFIG = {
    // TTL del cache: 5 minutos (tiempo de vida)
    ttl: parseInt(process.env.SPACES_CACHE_TTL_MS) || 300000,
    // TTL para datos stale (aún usables si no hay alternativa): 15 minutos
    staleTtl: parseInt(process.env.SPACES_STALE_TTL_MS) || 900000,
    // TTL para datos frescos después de refresh
    freshTtl: parseInt(process.env.SPACES_FRESH_TTL_MS) || 60000,
    // Intervalo de pre-carga automática: 4 minutos
    preloadInterval: parseInt(process.env.SPACES_PRELOAD_INTERVAL_MS) || 240000,
    // Timeout máximo para esperar pre-carga en SSE: 3s dev, 2s prod
    ssePreloadWait: parseInt(process.env.SPACES_SSE_PRELOAD_WAIT_MS) || (isDev ? 3000 : 2000),
    // Timeout para esperar pre-carga en API REST: 2s (nunca bloquear más)
    apiPreloadWait: parseInt(process.env.SPACES_API_PRELOAD_WAIT_MS) || 2000,
    // Intervalo de heartbeat SSE: 25 segundos
    heartbeatInterval: parseInt(process.env.SPACES_HEARTBEAT_MS) || 25000,
    // Timeout máximo para carga directa desde Spaces: 15s
    directLoadTimeout: parseInt(process.env.SPACES_DIRECT_LOAD_TIMEOUT_MS) || 15000,
};

// Estados del cache claramente definidos
const CACHE_STATE = {
    EMPTY: 'empty',       // Sin datos, primera vez
    LOADING: 'loading',   // Carga en progreso
    READY: 'ready',       // Datos válidos disponibles
    STALE: 'stale',       // Datos expirados pero usables
    ERROR: 'error'        // Error en última carga
};

// Hacer enum inmutable para evitar sobrescrituras accidentales
Object.freeze(CACHE_STATE);

/**
 * Normaliza un estado dado (string) a uno de los valores de `CACHE_STATE`.
 * Evita problemas por typos como 'redy' y hace las comparaciones más robustas.
 * @param {string} s
 * @returns {string|null}
 */
const normalizeCacheState = (s) => {
    if (!s || typeof s !== 'string') return null;
    const key = s.trim().toUpperCase();
    // Buscar por key o por value
    if (CACHE_STATE[key]) return CACHE_STATE[key];
    // Buscar por value (case-insensitive)
    const lower = s.trim().toLowerCase();
    for (const val of Object.values(CACHE_STATE)) {
        if (val === lower) return val;
    }
    return null;
};

// ✅ Timeout para limpiar clientes SSE zombie (15 minutos)
const SSE_CLIENT_TIMEOUT = 15 * 60 * 1000;

// Cache mejorado con estados claros
let spacesCache = {
    data: null,
    timestamp: null,
    ttl: CACHE_CONFIG.ttl,
    lastPreloadDuration: null,    // Tiempo que tardó la última pre-carga
    preloadCount: 0,               // Contador de pre-cargas exitosas
    hitCount: 0,                   // Hits del cache
    missCount: 0,                  // Misses del cache
    lastError: null,               // Último error de carga
    errorTimestamp: null           // Cuándo ocurrió el último error
};

// ============================================
// CACHE DE CONTEOS DE CAPÍTULOS (DE SPACES)
// Se actualiza junto con preloadCache
// NUNCA EXPIRA - los capítulos solo están en Spaces, esta es la única fuente de verdad
// Se mantiene en memoria incluso cuando spacesCache expira
// ============================================
let chapterCountsCache = {
    counts: new Map(),        // Map<slug, number> - conteo de capítulos por serie
    timestamp: null,          // Última actualización
};

/**
 * Extrae solo los conteos de capítulos de la estructura de Spaces
 * @param {Map} seriesMap - Map de series parseado de Spaces
 * @returns {Map<string, number>} Map slug -> chapterCount
 */
const extractChapterCounts = (seriesMap) => {
    const counts = new Map();
    for (const [slug, series] of seriesMap) {
        counts.set(slug, series.chapters.size);
    }
    return counts;
};

/**
 * Actualiza el cache de conteos de capítulos
 * @param {Map} seriesMap - Map de series parseado de Spaces
 */
const updateChapterCountsCache = (seriesMap) => {
    chapterCountsCache.counts = extractChapterCounts(seriesMap);
    chapterCountsCache.timestamp = Date.now();
    logger.debug(`📊 Cache de conteos actualizado: ${chapterCountsCache.counts.size} series`);
};

/**
 * Obtiene el conteo de capítulos para un slug desde el cache
 * @param {string} slug
 * @returns {number} chapterCount (0 si no existe)
 */
const getChapterCount = (slug) => {
    return chapterCountsCache.counts.get(slug) || 0;
};

/**
 * Verifica si el cache de conteos tiene datos (nunca expira, solo importa si tiene datos)
 * @returns {boolean}
 */
const isChapterCountsCacheValid = () => {
    return chapterCountsCache.counts.size > 0;
};

// Promise de pre-carga en progreso (con estado mejorado)
let preloadState = {
    promise: null,
    startTime: null,
    inProgress: false
};

/**
 * Obtiene el estado actual del cache
 * @returns {string} Estado del cache (EMPTY, LOADING, READY, STALE, ERROR)
 */
const getCacheState = () => {
    if (preloadState.inProgress) return CACHE_STATE.LOADING;
    if (!spacesCache.data) return CACHE_STATE.EMPTY;

    const age = Date.now() - spacesCache.timestamp;
    if (age < spacesCache.ttl) return CACHE_STATE.READY;
    if (age < CACHE_CONFIG.staleTtl) return CACHE_STATE.STALE;

    return CACHE_STATE.EMPTY; // Datos demasiado viejos
};

/**
 * Obtiene datos del cache de forma no-bloqueante
 * NUNCA espera a que termine una pre-carga - devuelve stale data si está disponible
 * @param {boolean} allowStale - Permitir datos stale (expirados pero usables)
 * @returns {Object|null} Datos del cache o null si no hay datos disponibles
 */
const getCacheNonBlocking = (allowStale = true) => {
    if (!spacesCache.data) return null;

    const age = Date.now() - spacesCache.timestamp;

    // Cache válido (fresco)
    if (age < spacesCache.ttl) {
        spacesCache.hitCount++;
        return { data: spacesCache.data, source: 'cache', age };
    }

    // Cache stale (expirado pero usable)
    if (allowStale && age < CACHE_CONFIG.staleTtl) {
        spacesCache.hitCount++;
        return { data: spacesCache.data, source: 'cache-stale', age };
    }

    return null;
};

/**
 * Helper: Obtiene series desde la BD (para fallback cuando Spaces cache no está listo)
 * chapterCount SIEMPRE viene del cache de conteos de Spaces (nunca de la BD)
 */
const getSeriesFromDatabase = async () => {
    try {
        const result = await query(`
            SELECT s.id, s.slug, s.title, s.cover_url, s.status, s.updated_at
            FROM series s
            WHERE s.deleted_at IS NULL
            ORDER BY s.updated_at DESC
        `);

        const series = result.rows.map(row => ({
            slug: row.slug,
            title: row.title,
            cover: row.cover_url,
            coverUrl: row.cover_url,
            status: row.status || 'ongoing',
            chapterCount: getChapterCount(row.slug),
            chapters: [],
            updatedAt: row.updated_at,
            lastUpdated: row.updated_at
        }));

        return { series, total: series.length };
    } catch (error) {
        logger.error('❌ Error obteniendo series de BD:', error.message);
        return { series: [], total: 0 };
    }
};

/**
 * Lista todos los manhwas - HÍBRIDO: Spaces cache + BD fallback
 * GET /api/spaces/manhwas
 *
 * Prioridad:
 * 1. Cache de Spaces (tiene capítulos desde DigitalOcean Spaces)
 * 2. Fallback a BD (rápido pero sin capítulos si no están sincronizados)
 */
const listManhwasFromDatabase = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const forceRefresh = req.query.refresh === 'true';

        // PASO 1: Intentar cache de Spaces (tiene capítulos)
        if (!forceRefresh) {
            const cached = getCacheNonBlocking(true);
            if (cached && cached.data?.series?.length > 0) {
                const loadTime = Date.now() - startTime;
                logger.debug(`📦 Manhwas desde cache Spaces (${cached.source}, ${loadTime}ms, ${cached.data.series.length} series)`);

                res.set({
                    'Cache-Control': 'public, s-maxage=120, max-age=60',
                    'Vary': 'Accept-Encoding'
                });

                return res.json({
                    success: true,
                    source: cached.source,
                    cached: true,
                    loadTime,
                    data: cached.data
                });
            }
        }

        // PASO 2: Iniciar precarga de Spaces en background si no hay cache
        if (!preloadState.inProgress) {
            preloadCache().catch(err => logger.error('Error en preload background:', err));
        }

        // PASO 3: Si hay precarga en progreso, esperar máximo apiPreloadWait (2s) antes de caer al fallback de BD.
        // La BD responde rápido y tiene todos los datos esenciales; Spaces enriquece en background.
        if (preloadState.inProgress && preloadState.promise) {
            const timeout = new Promise(resolve => setTimeout(() => resolve(null), CACHE_CONFIG.apiPreloadWait));
            const result = await Promise.race([preloadState.promise, timeout]);

            if (result && spacesCache.data?.series?.length > 0) {
                const loadTime = Date.now() - startTime;
                logger.debug(`✅ Precarga completó a tiempo (${loadTime}ms)`);

                res.set({
                    'Cache-Control': 'public, s-maxage=120, max-age=60',
                    'Vary': 'Accept-Encoding'
                });

                return res.json({
                    success: true,
                    source: 'spaces-preload',
                    cached: true,
                    loadTime,
                    data: spacesCache.data
                });
            }
        }

        // PASO 4: Fallback a BD (metadata) + chapterCounts de Spaces cache o BD
        const result = await query(`
            SELECT s.id, s.slug, s.title, s.cover_url, s.cover_url_web, s.status, s.content_type, s.is_adult, s.language, s.updated_at
            FROM series s
            WHERE s.deleted_at IS NULL
            ORDER BY s.updated_at DESC
        `);

        const series = result.rows.map(row => ({
            slug: row.slug,
            title: row.title,
            cover: row.cover_url,
            coverUrl: row.cover_url,
            coverUrlWeb: row.cover_url_web || null,
            status: row.status || 'ongoing',
            contentType: row.content_type || 'manhwa',
            isAdult: row.is_adult || false,
            language: row.language || null,
            chapterCount: getChapterCount(row.slug),
            chapters: [],
            updatedAt: row.updated_at,
            lastUpdated: row.updated_at
        }));

        const loadTime = Date.now() - startTime;
        logger.debug(`📊 BD fallback: ${series.length} manhwas en ${loadTime}ms`);

        res.set({
            'Cache-Control': 'public, s-maxage=30, max-age=10',
            'Vary': 'Accept-Encoding'
        });

        res.json({
            success: true,
            source: 'database',
            loadTime,
            data: { series, total: series.length }
        });
    } catch (error) {
        logger.error('❌ Error listando manhwas:', error.message);
        next(error);
    }
};

/**
 * LEGACY: Obtiene todos los manhwas desde Spaces (LENTO - solo para sincronización)
 * GET /api/spaces/manhwas
 * OPTIMIZADO V2: Nunca bloquea, siempre responde rápido
 */
const listManhwasFromSpaces = async (req, res, next) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const startTime = Date.now();

        // PASO 0: Configurar headers de cache HTTP
        // s-maxage para CDN (Cloudflare), max-age para navegador
        // stale-while-revalidate permite servir stale mientras se revalida en background
        if (!forceRefresh) {
            const cacheTimestamp = spacesCache.timestamp || 0;
            res.set({
                'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=300',
                'ETag': `W/"spaces-${cacheTimestamp}"`,
                'Vary': 'Accept-Encoding'
            });
        } else {
            res.set({
                'Cache-Control': 'no-cache, must-revalidate'
            });
        }

        // PASO 1: Intentar cache no-bloqueante (siempre primero)
        if (!forceRefresh) {
            const cached = getCacheNonBlocking(true); // Permitir stale
            if (cached) {
                logger.debug(`📦 API: Cache hit (${cached.source}, age: ${cached.age}ms)`);
                return res.json({
                    success: true,
                    cached: true,
                    cacheAge: cached.age,
                    source: cached.source,
                    data: cached.data
                });
            }
        }

        spacesCache.missCount++;

        // PASO 2: Si hay pre-carga en progreso, esperar
        if (preloadState.inProgress && preloadState.promise) {
            // Si no hay cache previo (primera carga), esperar más tiempo
            // porque el fallback a BD no tiene capítulos y no sirve
            const hasAnyCachedData = spacesCache.data && spacesCache.data.series?.length > 0;
            const waitTime = hasAnyCachedData
                ? CACHE_CONFIG.apiPreloadWait  // 2s si hay cache stale disponible
                : CACHE_CONFIG.directLoadTimeout; // 15s si es primera carga (no hay alternativa útil)

            logger.debug(`📦 API: Pre-carga en progreso, esperando ${waitTime}ms (${hasAnyCachedData ? 'tiene cache previo' : 'primera carga'})...`);

            const timeout = new Promise(resolve =>
                setTimeout(() => resolve(null), waitTime)
            );
            const result = await Promise.race([preloadState.promise, timeout]);

            if (result && spacesCache.data) {
                logger.debug(`✅ API: Pre-carga completó a tiempo (${Date.now() - startTime}ms)`);
                return res.json({
                    success: true,
                    cached: true,
                    fromPreload: true,
                    loadTime: Date.now() - startTime,
                    data: spacesCache.data
                });
            }

            // Timeout: verificar si hay datos stale disponibles
            const staleData = getCacheNonBlocking(true);
            if (staleData) {
                logger.debug(`📦 API: Timeout en pre-carga, usando cache stale`);
                return res.json({
                    success: true,
                    cached: true,
                    source: 'cache-stale-fallback',
                    cacheAge: staleData.age,
                    data: staleData.data
                });
            }

            logger.debug(`⏰ API: Timeout en pre-carga, devolviendo datos de BD como fallback...`);
            // Fallback a BD mientras el preload continúa en background
            const dbFallback = await getSeriesFromDatabase();
            return res.json({
                success: true,
                source: 'database-fallback',
                loading: true,
                data: dbFallback
            });
        }

        // PASO 3: Sin cache disponible - cargar desde Spaces
        if (!forceRefresh) {
            logger.debug('⏭️ API: Sin cache disponible, iniciando preload y esperando...');
            // Iniciar preload y esperar con timeout razonable (primera carga real)
            if (!preloadState.inProgress) {
                preloadCache().catch(err => logger.error('Error en preload:', err));
            }
            // Esperar a que termine la pre-carga (hasta 15s)
            if (preloadState.promise) {
                const timeout = new Promise(resolve =>
                    setTimeout(() => resolve(null), CACHE_CONFIG.directLoadTimeout)
                );
                const result = await Promise.race([preloadState.promise, timeout]);
                if (result && spacesCache.data) {
                    logger.debug(`✅ API: Preload completó (${Date.now() - startTime}ms)`);
                    return res.json({
                        success: true,
                        cached: true,
                        fromPreload: true,
                        loadTime: Date.now() - startTime,
                        data: spacesCache.data
                    });
                }
            }
            // Si aún no terminó, fallback a BD
            logger.debug('⏰ API: Timeout esperando Spaces, fallback a BD...');
            const dbFallback = await getSeriesFromDatabase();
            return res.json({
                success: true,
                source: 'database-fallback',
                loading: true,
                data: dbFallback
            });
        }

        logger.info('🔄 API: Cargando datos desde Spaces (refresh forzado)...');
        const objects = await listAllObjects();
        const seriesMap = parseSpacesStructure(objects);
        const series = await seriesToArray(seriesMap);

        const loadDuration = Date.now() - startTime;

        // Actualizar cache
        spacesCache = {
            ...spacesCache,
            data: { series, total: series.length },
            timestamp: Date.now(),
            ttl: forceRefresh ? CACHE_CONFIG.freshTtl : CACHE_CONFIG.ttl,
            lastPreloadDuration: loadDuration,
            lastError: null,
            errorTimestamp: null
        };

        logger.info(`✅ API: Cargado en ${loadDuration}ms (${series.length} series)`);

        res.json({
            success: true,
            cached: false,
            loadTime: loadDuration,
            data: spacesCache.data
        });
    } catch (error) {
        logger.error('❌ Error listando manhwas desde Spaces:', error.message);

        // Guardar error para diagnóstico
        spacesCache.lastError = error.message;
        spacesCache.errorTimestamp = Date.now();

        // Intentar devolver datos stale si hay
        const staleData = getCacheNonBlocking(true);
        if (staleData) {
            logger.debug('📦 API: Error, devolviendo cache stale como fallback');
            return res.json({
                success: true,
                cached: true,
                source: 'cache-error-fallback',
                cacheAge: staleData.age,
                data: staleData.data,
                warning: 'Datos pueden estar desactualizados'
            });
        }

        // Último recurso: devolver datos de BD
        logger.debug('📦 API: Error total, devolviendo BD como último recurso');
        const dbFallback = await getSeriesFromDatabase();
        if (dbFallback.series.length > 0) {
            return res.json({
                success: true,
                source: 'database-error-fallback',
                data: dbFallback,
                warning: 'Datos desde base de datos (sin capítulos de Spaces)'
            });
        }

        next(error);
    }
};

/**
 * Obtiene detalles de una serie desde Spaces
 * GET /api/spaces/manhwas/:slug
 * MEJORADO: Consulta la BD para obtener cover_url actualizado
 */
const getManhwaFromSpaces = async (req, res, next) => {
    try {
        const { slug } = req.params;

        // Cache headers: CDN cachea 60s, navegador 30s, stale OK por 5 min
        res.set({
            'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=300',
            'Vary': 'Accept-Encoding'
        });

        // Listar objetos del prefix de la serie
        const objects = await listAllObjects(slug + '/');

        if (objects.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada en Spaces'
            });
        }

        // Parsear
        const seriesMap = parseSpacesStructure(objects);
        const series = seriesMap.get(slug);

        if (!series) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        // 🔧 CORRECIÓN: Consultar BD para obtener cover_url, autor y géneros actualizados
        let coverUrl = series.cover;
        let dbMetadata = {};
        try {
            // Consulta unificada: serie + autor + géneros en una sola query
            const dbResult = await query(
                `SELECT s.id, s.cover_url, s.title, s.original_title, s.synopsis, s.status,
                        s.rating_average, s.rating_count, s.release_year, s.view_count,
                        s.is_adult,
                        a.name as author_name,
                        COALESCE(g_agg.genres, ARRAY[]::text[]) as genres
                 FROM series s
                 LEFT JOIN authors a ON s.author_id = a.id
                 LEFT JOIN LATERAL (
                     SELECT array_agg(g.name ORDER BY g.name) as genres
                     FROM series_genres sg
                     JOIN genres g ON sg.genre_id = g.id
                     WHERE sg.series_id = s.id
                 ) g_agg ON true
                 WHERE s.slug = $1 AND s.deleted_at IS NULL`,
                [slug]
            );

            if (dbResult.rows.length > 0) {
                const dbSeries = dbResult.rows[0];
                if (dbSeries.cover_url) {
                    coverUrl = dbSeries.cover_url;
                }
                if (dbSeries.title)          dbMetadata.title         = dbSeries.title;
                if (dbSeries.original_title) dbMetadata.originalTitle = dbSeries.original_title;
                if (dbSeries.synopsis)       dbMetadata.synopsis      = dbSeries.synopsis;
                if (dbSeries.status)         dbMetadata.status        = dbSeries.status;
                if (dbSeries.author_name)    dbMetadata.author        = dbSeries.author_name;
                if (dbSeries.rating_average) dbMetadata.rating        = parseFloat(dbSeries.rating_average);
                if (dbSeries.rating_count)   dbMetadata.ratingCount   = parseInt(dbSeries.rating_count, 10);
                if (dbSeries.release_year)   dbMetadata.releaseYear   = dbSeries.release_year;
                if (dbSeries.view_count)     dbMetadata.views         = dbSeries.view_count;
                if (dbSeries.genres?.length) dbMetadata.genres        = dbSeries.genres;
                dbMetadata.isAdult = dbSeries.is_adult || false;
            }
        } catch (dbError) {
            // No fallar si la consulta a BD falla, solo loguear
            logger.warn(`⚠️ No se pudo consultar BD para ${slug}:`, dbError.message);
        }

        // Convertir capítulos a array completo (no solo los primeros 5)
        const chapters = Array.from(series.chapters.values())
            .sort((a, b) => b.number - a.number)
            .map(ch => ({
                number: ch.number,
                slug: ch.slug,
                pageCount: ch.pageCount,
                time: getRelativeTime(ch.lastModified),
                lastModified: ch.lastModified
            }));

        res.json({
            success: true,
            data: {
                slug: series.slug,
                title: dbMetadata.title || series.title,
                originalTitle: dbMetadata.originalTitle || null,
                coverUrl: coverUrl,
                cover: coverUrl, // Mantener ambos por compatibilidad
                synopsis: dbMetadata.synopsis || null,
                status: dbMetadata.status || 'ongoing',
                author: dbMetadata.author || null,
                genres: dbMetadata.genres || [],
                rating: dbMetadata.rating || 0,
                ratingCount: dbMetadata.ratingCount || 0,
                releaseYear: dbMetadata.releaseYear || null,
                views: dbMetadata.views || 0,
                isAdult: dbMetadata.isAdult || false,
                chapterCount: chapters.length,
                chapters,
                lastUpdated: series.lastModified
            }
        });
    } catch (error) {
        console.error('Error obteniendo manhwa desde Spaces:', error);
        next(error);
    }
};

/**
 * Obtiene las páginas de un capítulo desde Spaces
 * GET /api/spaces/manhwas/:slug/capitulo/:chapterNum/pages
 */
const getChapterPagesFromSpaces = async (req, res, next) => {
    try {
        const { slug, chapterNum } = req.params;
        const chapterNumber = parseInt(chapterNum);

        // Cache: chapter pages rarely change once uploaded
        res.set({
            'Cache-Control': 'public, s-maxage=3600, max-age=300, stale-while-revalidate=86400',
            'Vary': 'Accept-Encoding'
        });

        // Construir prefix del capítulo
        const prefix = `${slug}/cap-${String(chapterNumber).padStart(4, '0')}/`;

        // Listar objetos
        const objects = await listAllObjects(prefix);

        if (objects.length === 0) {
            // Intentar sin padding
            const altPrefix = `${slug}/cap-${chapterNumber}/`;
            const altObjects = await listAllObjects(altPrefix);

            if (altObjects.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Capítulo no encontrado'
                });
            }

            objects.push(...altObjects);
        }

        // Filtrar y ordenar páginas
        const pages = objects
            .filter(obj => obj.Key.match(/\.(jpg|jpeg|png|webp|gif)$/i))
            .map(obj => {
                const fileName = obj.Key.split('/').pop();
                const pageMatch = fileName.match(/^(\d+)/);
                return {
                    number: pageMatch ? parseInt(pageMatch[1]) : 0,
                    url: buildPublicUrl(obj.Key)
                };
            })
            .sort((a, b) => a.number - b.number);

        res.json({
            success: true,
            data: {
                seriesSlug: slug,
                chapterNumber,
                pages,
                totalPages: pages.length
            }
        });
    } catch (error) {
        console.error('Error obteniendo páginas desde Spaces:', error);
        next(error);
    }
};

/**
 * SSE Stream para actualizaciones en tiempo real
 * GET /api/spaces/stream
 * OPTIMIZADO V2: Envío INMEDIATO garantizado, nunca bloquea, mejor UX
 */
const streamUpdates = async (req, res) => {
    const clientId = Date.now() + Math.random();
    const clientIdStr = clientId.toFixed(0);
    logger.debug(`🔌 SSE Cliente conectando: ${clientIdStr}`);

    // Headers SSE optimizados
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Para nginx

    // Flag para detectar si el cliente se desconectó
    let isClientConnected = true;

    // Función helper para enviar eventos SSE de forma segura
    const sendEvent = (eventName, data) => {
        if (!isClientConnected) return false;
        try {
            res.write(`event: ${eventName}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            return true;
        } catch (e) {
            console.warn(`⚠️ SSE [${clientIdStr}]: Error enviando evento ${eventName}:`, e.message);
            isClientConnected = false;
            return false;
        }
    };

    // ============================================
    // PASO 1: Enviar evento de conexión INMEDIATAMENTE
    // ============================================
    sendEvent('connected', {
        message: 'Conectado al stream de Spaces',
        clientId: clientIdStr,
        timestamp: Date.now()
    });

    // ============================================
    // PASO 2: ESTRATEGIA DE CARGA INICIAL NO-BLOQUEANTE
    // Prioridad: 1) Cache (fresh o stale), 2) Espera corta de pre-carga, 3) Carga directa
    // ============================================

    const sendInitialData = async () => {
        const startTime = Date.now();

        try {
            logger.debug(`🎬 SSE [${clientIdStr}]: Iniciando sendInitialData...`);
            let dataToSend = null;
            let source = 'unknown';

            // ESTRATEGIA 1: Cache disponible (fresh o stale) - RESPUESTA INMEDIATA
            const cached = getCacheNonBlocking(true); // Permitir stale para respuesta rápida
            if (cached) {
                dataToSend = cached.data;
                source = cached.source;
                logger.debug(`📦 SSE [${clientIdStr}]: Usando ${source} (age: ${cached.age}ms)`);
            }
            // ESTRATEGIA 2: Pre-carga en progreso - esperar con timeout MUY CORTO
            else if (preloadState.inProgress && preloadState.promise) {
                logger.debug(`⏳ SSE [${clientIdStr}]: Pre-carga en progreso, esperando brevemente...`);

                // Notificar al frontend que estamos cargando
                sendEvent('loading', {
                    message: 'Cargando manhwas...',
                    estimatedTime: spacesCache.lastPreloadDuration || 3000
                });

                // Esperar con timeout CORTO (2-3 segundos máximo)
                const timeout = new Promise(resolve =>
                    setTimeout(() => resolve(null), CACHE_CONFIG.ssePreloadWait)
                );
                const result = await Promise.race([preloadState.promise, timeout]);

                if (result) {
                    dataToSend = result;
                    source = 'preload-wait';
                    logger.debug(`✅ SSE [${clientIdStr}]: Pre-carga completó a tiempo (${Date.now() - startTime}ms)`);
                } else {
                    // Timeout: verificar si el cache se actualizó mientras esperábamos
                    const staleCheck = getCacheNonBlocking(true);
                    if (staleCheck) {
                        dataToSend = staleCheck.data;
                        source = 'cache-stale-after-wait';
                        logger.debug(`📦 SSE [${clientIdStr}]: Usando cache stale después de esperar`);
                    } else {
                        logger.debug(`⏰ SSE [${clientIdStr}]: Timeout en pre-carga, cargando directamente...`);
                    }
                }
            }

            // ESTRATEGIA 3: Sin cache ni pre-carga - cargar directamente con timeout
            if (!dataToSend) {
                logger.info(`🔄 SSE [${clientIdStr}]: Cargando datos desde Spaces...`);

                // Notificar al frontend
                sendEvent('loading', {
                    message: 'Cargando desde almacenamiento...',
                    estimatedTime: 5000
                });

                try {
                    // Cargar con timeout para evitar bloqueos indefinidos
                    const loadPromise = (async () => {
                        const objects = await listAllObjects();
                        logger.debug(`📦 SSE [${clientIdStr}]: Recibidos ${objects.length} objetos`);

                        const seriesMap = parseSpacesStructure(objects);
                        logger.debug(`📚 SSE [${clientIdStr}]: ${seriesMap.size} series encontradas`);

                        const series = await seriesToArray(seriesMap);
                        return { series, total: series.length };
                    })();

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout cargando desde Spaces')), CACHE_CONFIG.directLoadTimeout)
                    );

                    dataToSend = await Promise.race([loadPromise, timeoutPromise]);
                    source = 'direct-load';

                    const loadDuration = Date.now() - startTime;

                    // Actualizar cache
                    spacesCache = {
                        ...spacesCache,
                        data: dataToSend,
                        timestamp: Date.now(),
                        ttl: CACHE_CONFIG.ttl,
                        lastPreloadDuration: loadDuration,
                        lastError: null,
                        errorTimestamp: null
                    };

                    logger.info(`✅ SSE [${clientIdStr}]: Cargado en ${loadDuration}ms`);
                } catch (loadError) {
                    console.error(`❌ SSE [${clientIdStr}]: Error en carga directa:`, loadError.message);

                    // Último intento: usar cualquier dato que tengamos
                    if (spacesCache.data) {
                        dataToSend = spacesCache.data;
                        source = 'cache-emergency';
                        logger.warn(`🆘 SSE [${clientIdStr}]: Usando cache de emergencia`);
                    } else {
                        // No hay absolutamente nada, enviar error
                        sendEvent('error', {
                            message: 'No se pudieron cargar los manhwas',
                            error: loadError.message,
                            canRetry: true,
                            useApiFallback: true
                        });
                        return;
                    }
                }
            }

            // ============================================
            // PASO 3: ENVIAR DATOS INICIALES (GARANTIZADO)
            // ============================================
            if (dataToSend) {
                logger.debug(`📤 SSE [${clientIdStr}]: Enviando 'initial' con ${dataToSend.series?.length || 0} series (${source})...`);
                const eventSent = sendEvent('initial', {
                    ...dataToSend,
                    source,
                    timestamp: Date.now(),
                    loadTime: Date.now() - startTime
                });
                logger.debug(`${eventSent ? '✅' : '❌'} SSE [${clientIdStr}]: Evento 'initial' ${eventSent ? 'enviado' : 'FALLÓ'}`);
            }

        } catch (error) {
            console.error(`❌ SSE [${clientIdStr}] Error en sendInitialData:`, error.message);
            sendEvent('error', {
                message: 'Error cargando datos iniciales',
                error: error.message,
                canRetry: true,
                useApiFallback: true
            });
        }
    };

    // Ejecutar carga inicial (async, no bloquea la respuesta SSE)
    logger.debug(`🚀 SSE [${clientIdStr}]: Llamando sendInitialData()...`);
    sendInitialData().then(() => {
        logger.debug(`🏁 SSE [${clientIdStr}]: sendInitialData() completado`);
    }).catch(err => {
        console.error(`❌ SSE [${clientIdStr}]: sendInitialData() error:`, err.message);
    });

    // ============================================
    // PASO 4: Registrar cliente y configurar heartbeat
    // ✅ MEMORY LEAK FIX: Timeout automático y lastActivity tracking
    // ============================================
    const client = {
        id: clientId,
        res,
        type: 'spaces',
        connectedAt: Date.now(),
        lastActivity: Date.now()  // ✅ Track última actividad
    };

    if (!req.app.locals.spacesClients) {
        req.app.locals.spacesClients = [];
    }
    req.app.locals.spacesClients.push(client);
    logger.debug(`👥 SSE Clientes conectados: ${req.app.locals.spacesClients.length}`);

    // ✅ Función centralizada de limpieza
    const cleanupClient = () => {
        if (!isClientConnected) return; // Ya limpiado
        isClientConnected = false;
        clearInterval(heartbeat);
        clearTimeout(cleanupTimeout);

        if (req.app.locals.spacesClients) {
            req.app.locals.spacesClients = req.app.locals.spacesClients.filter(c => c.id !== clientId);
            logger.debug(`🔌 SSE Cliente desconectado: ${clientIdStr} (quedan: ${req.app.locals.spacesClients.length})`);
        }
    };

    // ✅ Timeout de seguridad: limpiar clientes zombie
    const cleanupTimeout = setTimeout(() => {
        if (isClientConnected) {
            console.warn(`🧹 SSE [${clientIdStr}]: Timeout de ${SSE_CLIENT_TIMEOUT / 1000}s alcanzado, limpiando cliente zombie`);
            cleanupClient();
        }
    }, SSE_CLIENT_TIMEOUT);

    // Heartbeat con actualización de lastActivity
    const heartbeat = setInterval(() => {
        if (!sendEvent('heartbeat', { timestamp: Date.now() })) {
            cleanupClient();
        } else {
            // ✅ Actualizar lastActivity en cada heartbeat exitoso
            client.lastActivity = Date.now();
        }
    }, CACHE_CONFIG.heartbeatInterval);

    // Limpiar al cerrar conexión
    req.on('close', cleanupClient);
    req.on('error', cleanupClient);
};

/**
 * Webhook para notificar nuevos contenidos
 * POST /api/spaces/webhook/sync
 * Llamado por el scraper cuando sube nuevo contenido
 */
const syncWebhook = async (req, res, next) => {
    try {
        const { series: seriesSlug, chapter: chapterNumber, action = 'new_chapter' } = req.body;

        // Invalidar cache
        spacesCache.data = null;
        spacesCache.timestamp = null;

        // Recargar datos
        const objects = await listAllObjects();
        const seriesMap = parseSpacesStructure(objects);
        const series = await seriesToArray(seriesMap);

        // Actualizar cache
        spacesCache = {
            data: { series, total: series.length },
            timestamp: Date.now(),
            ttl: 60000
        };

        // Notificar a clientes SSE
        const payload = {
            action,
            series: seriesSlug,
            chapter: chapterNumber,
            timestamp: Date.now(),
            data: spacesCache.data
        };

        const clients = req.app.locals.spacesClients || [];
        clients.forEach(client => {
            try {
                client.res.write(`event: ${action}\n`);
                client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
            } catch (e) {
                // Cliente desconectado
            }
        });

        res.json({
            success: true,
            message: 'Sincronización completada',
            clientsNotified: clients.length
        });
    } catch (error) {
        console.error('Error en webhook de sync:', error);
        next(error);
    }
};

/**
 * Sincroniza los datos de Spaces con la base de datos
 * POST /api/spaces/sync-db
 * Crea/actualiza series y capítulos en la BD desde lo que hay en Spaces
 */
const syncToDatabase = async (req, res, next) => {
    try {
        const objects = await listAllObjects();
        const seriesMap = parseSpacesStructure(objects);

        let created = 0;
        let updated = 0;

        for (const [slug, series] of seriesMap) {
            // Verificar si la serie existe
            const existing = await query(
                'SELECT id FROM series WHERE slug = $1',
                [slug]
            );

            let seriesId;

            if (existing.rows.length === 0) {
                // Crear serie
                const result = await query(
                    `INSERT INTO series (title, slug, cover_url, status, content_type, created_at, updated_at)
                     VALUES ($1, $2, $3, 'ongoing', 'manhwa', NOW(), NOW())
                     RETURNING id`,
                    [series.title, slug, series.cover]
                );
                seriesId = result.rows[0].id;
                created++;
            } else {
                seriesId = existing.rows[0].id;

                // Actualizar cover si no tiene
                await query(
                    `UPDATE series SET cover_url = COALESCE(cover_url, $1), updated_at = NOW() WHERE id = $2`,
                    [series.cover, seriesId]
                );
                updated++;
            }

            // Sincronizar capítulos
            for (const [chapterNum, chapter] of series.chapters) {
                const chapterSlug = `capitulo-${chapterNum}`;

                const existingChapter = await query(
                    'SELECT id FROM chapters WHERE series_id = $1 AND number = $2',
                    [seriesId, chapterNum]
                );

                if (existingChapter.rows.length === 0) {
                    // Crear capítulo
                    const chapterResult = await query(
                        `INSERT INTO chapters (series_id, number, title, slug, page_count, is_published, published_at, created_at)
                         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
                         RETURNING id`,
                        [seriesId, chapterNum, `Capítulo ${chapterNum}`, chapterSlug, chapter.pages.length]
                    );

                    const chapterId = chapterResult.rows[0].id;

                    // Insertar páginas
                    for (const page of chapter.pages) {
                        await query(
                            `INSERT INTO chapter_pages (chapter_id, page_number, image_url, created_at)
                             VALUES ($1, $2, $3, NOW())
                             ON CONFLICT DO NOTHING`,
                            [chapterId, page.number, page.url]
                        );
                    }
                }
            }

            // Actualizar conteo de capítulos
            await query(
                `UPDATE series SET chapter_count = (
                    SELECT COUNT(*) FROM chapters WHERE series_id = $1 AND is_published = true
                ), last_chapter_at = NOW() WHERE id = $1`,
                [seriesId]
            );
        }

        res.json({
            success: true,
            message: 'Sincronización con BD completada',
            stats: { created, updated, total: seriesMap.size }
        });
    } catch (error) {
        console.error('Error sincronizando con BD:', error);
        next(error);
    }
};

/**
 * Pre-carga el cache de Spaces
 * OPTIMIZADO: Mejor manejo de estado, métricas, y prevención de duplicados
 */
const preloadCache = async () => {
    // Fast-path: si ya existe una promesa, retornarla (asignada de forma atómica)
    if (preloadState.promise) {
        const elapsed = preloadState.startTime ? Date.now() - preloadState.startTime : 0;
        logger.debug(`⏳ Pre-carga ya en progreso (${elapsed}ms transcurridos), esperando...`);
        return preloadState.promise;
    }

    // Crear y asignar la promesa inmediatamente para evitar race conditions
    const startTime = Date.now();
    const p = (async () => {
        try {
            preloadState.inProgress = true;
            preloadState.startTime = startTime;

            logger.debug('🔄 Pre-cargando cache de Spaces...');

            // Ejecutar listado de Spaces y consulta BD en PARALELO
            // La BD no depende de Spaces, así ahorramos tiempo
            const dbQueryPromise = query(
                `SELECT s.slug, s.cover_url, s.cover_url_web, s.title, s.original_title, s.status,
                        s.content_type, s.is_adult, s.language,
                        s.view_count, s.rating_average, s.created_at, s.updated_at,
                        a.name as author_name,
                        COALESCE(
                            (SELECT array_agg(g.name ORDER BY g.name)
                             FROM series_genres sg
                             JOIN genres g ON sg.genre_id = g.id
                             WHERE sg.series_id = s.id),
                            ARRAY[]::text[]
                        ) as genres
                 FROM series s
                 LEFT JOIN authors a ON s.author_id = a.id
                 WHERE s.deleted_at IS NULL`

            ).catch(err => {
                logger.warn('⚠️ Error pre-consultando BD:', err.message);
                return { rows: [] };
            });

            const t0 = Date.now();
            const objects = await listAllObjects();
            logger.debug(`  📦 Objetos obtenidos: ${objects.length} (${Date.now() - t0}ms)`);

            const seriesMap = parseSpacesStructure(objects);

            // ✅ Actualizar cache de conteos de capítulos (usado por fallback a BD)
            updateChapterCountsCache(seriesMap);

            // Esperar BD (probablemente ya terminó mientras cargaba Spaces)
            const t1 = Date.now();
            const dbResult = await dbQueryPromise;
            const dbSeriesMap = new Map();
            for (const row of dbResult.rows) {
                dbSeriesMap.set(row.slug, row);
            }
            logger.debug(`  📊 BD lista: ${dbResult.rows.length} series (${Date.now() - t1}ms espera)`);

            const series = await seriesToArrayWithDb(seriesMap, dbSeriesMap);

            const data = { series, total: series.length };
            const duration = Date.now() - startTime;

            // Actualizar cache con todos los metadatos
            spacesCache = {
                ...spacesCache,
                data,
                timestamp: Date.now(),
                ttl: CACHE_CONFIG.ttl,
                lastPreloadDuration: duration,
                preloadCount: spacesCache.preloadCount + 1,
                lastError: null,
                errorTimestamp: null
            };

            logger.info(`✅ Cache pre-cargado: ${series.length} series en ${duration}ms (pre-carga #${spacesCache.preloadCount})`);

            return data;
        } catch (error) {
            console.error('❌ Error pre-cargando cache:', error.message);
            // Registrar error en el cache para diagnóstico
            spacesCache.lastError = error.message;
            spacesCache.errorTimestamp = Date.now();
            return null;
        } finally {
            // Limpiar estado de pre-carga después de un breve delay para dar tiempo
            // a otros procesos que podrían esperar la promesa asignada.
            setTimeout(() => {
                preloadState.inProgress = false;
                preloadState.promise = null;
                preloadState.startTime = null;
            }, 2000);
        }
    })();

    // Asignación atómica visible para otros llamadores
    preloadState.promise = p;

    return p;
};

// Variable para el intervalo de pre-carga
let preloadInterval = null;

/**
 * Inicia la pre-carga automática del cache
 * OPTIMIZADO: Intervalo configurable, mejor logging
 */
const startAutoPreload = () => {
    if (preloadInterval) {
        logger.debug('⚠️ Pre-carga automática ya está activa');
        return;
    }

    const intervalMinutes = CACHE_CONFIG.preloadInterval / 60000;

    // Pre-cargar cache cada N minutos (antes de que expire)
    preloadInterval = setInterval(() => {
        // Solo pre-cargar si el cache está a punto de expirar (50% del TTL)
        const cacheAge = spacesCache.timestamp ? Date.now() - spacesCache.timestamp : Infinity;
        const shouldPreload = cacheAge > (CACHE_CONFIG.ttl * 0.5);

        if (shouldPreload) {
            logger.debug('🔄 Pre-carga automática iniciada...');
            preloadCache().catch(err =>
                console.error('❌ Error en pre-carga automática:', err.message)
            );
        } else {
            logger.debug(`⏭️ Pre-carga automática omitida (cache válido: ${Math.round((CACHE_CONFIG.ttl - cacheAge) / 1000)}s restantes)`);
        }
    }, CACHE_CONFIG.preloadInterval);

    logger.info(`⏰ Pre-carga automática configurada (cada ${intervalMinutes} minutos)`);
};

/**
 * Detiene la pre-carga automática (útil para testing)
 */
const stopAutoPreload = () => {
    if (preloadInterval) {
        clearInterval(preloadInterval);
        preloadInterval = null;
        logger.debug('🛑 Pre-carga automática detenida');
    }
};

/**
 * Obtiene estadísticas del cache (útil para monitoreo)
 * OPTIMIZADO V2: Incluye estado del cache y más métricas
 */
const getCacheStats = () => ({
    // Estado general
    state: getCacheState(),
    hasData: !!spacesCache.data,

    // Timestamps y edad
    timestamp: spacesCache.timestamp,
    age: spacesCache.timestamp ? Date.now() - spacesCache.timestamp : null,
    ageFormatted: spacesCache.timestamp
        ? `${Math.round((Date.now() - spacesCache.timestamp) / 1000)}s`
        : 'N/A',

    // TTLs
    ttl: spacesCache.ttl,
    staleTtl: CACHE_CONFIG.staleTtl,
    isValid: spacesCache.data && (Date.now() - spacesCache.timestamp) < spacesCache.ttl,
    isStale: spacesCache.data && (Date.now() - spacesCache.timestamp) >= spacesCache.ttl
        && (Date.now() - spacesCache.timestamp) < CACHE_CONFIG.staleTtl,

    // Datos
    seriesCount: spacesCache.data?.total || 0,

    // Pre-carga
    lastPreloadDuration: spacesCache.lastPreloadDuration,
    preloadCount: spacesCache.preloadCount,
    preloadInProgress: preloadState.inProgress,
    preloadElapsed: preloadState.inProgress && preloadState.startTime
        ? Date.now() - preloadState.startTime
        : null,

    // Métricas de uso
    hitCount: spacesCache.hitCount,
    missCount: spacesCache.missCount,
    hitRate: spacesCache.hitCount + spacesCache.missCount > 0
        ? (spacesCache.hitCount / (spacesCache.hitCount + spacesCache.missCount) * 100).toFixed(1) + '%'
        : 'N/A',

    // Errores
    lastError: spacesCache.lastError,
    errorTimestamp: spacesCache.errorTimestamp,

    // Configuración (útil para debugging)
    config: {
        ttl: CACHE_CONFIG.ttl,
        staleTtl: CACHE_CONFIG.staleTtl,
        ssePreloadWait: CACHE_CONFIG.ssePreloadWait,
        apiPreloadWait: CACHE_CONFIG.apiPreloadWait,
        preloadInterval: CACHE_CONFIG.preloadInterval
    }
});

// ============================================
// CLIENTES SSE PARA ACTUALIZACIONES
// ============================================
const updateClients = new Map();

/**
 * SSE Stream SOLO para actualizaciones en tiempo real
 * GET /api/spaces/updates
 * 
 * ARQUITECTURA HÍBRIDA - FASE 2
 * ==============================
 * - NO envía datos iniciales (usar GET /api/spaces/manhwas para eso)
 * - Solo notifica cuando hay CAMBIOS reales
 * - Ligero, eficiente, no bloquea
 * - Si el cliente no se conecta, la app funciona igual
 */
const streamUpdatesOnly = (req, res) => {
    const clientId = Date.now() + Math.random();
    const clientIdStr = clientId.toFixed(0);
    logger.debug(`🔌 SSE Updates: Cliente conectando: ${clientIdStr}`);

    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Flag de conexión
    let isConnected = true;

    // Helper para enviar eventos
    const sendEvent = (eventName, data) => {
        if (!isConnected) return false;
        try {
            res.write(`event: ${eventName}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            return true;
        } catch {
            isConnected = false;
            return false;
        }
    };

    // Enviar confirmación de conexión (sin datos)
    sendEvent('connected', {
        message: 'Conectado al stream de actualizaciones',
        clientId: clientIdStr,
        timestamp: Date.now()
    });

    // ✅ Registrar cliente con lastActivity tracking
    const client = {
        id: clientId,
        res,
        sendEvent,
        connectedAt: Date.now(),
        lastActivity: Date.now()  // ✅ Track actividad
    };
    updateClients.set(clientId, client);
    logger.debug(`👥 SSE Updates: ${updateClients.size} clientes conectados`);

    // ✅ Función centralizada de limpieza
    const cleanupClient = () => {
        if (!isConnected) return; // Ya limpiado
        isConnected = false;
        clearInterval(heartbeat);
        clearTimeout(cleanupTimeout);
        updateClients.delete(clientId);
        logger.debug(`🔌 SSE Updates: Cliente desconectado: ${clientIdStr} (quedan: ${updateClients.size})`);
    };

    // ✅ Timeout de seguridad
    const cleanupTimeout = setTimeout(() => {
        if (isConnected) {
            console.warn(`🧹 SSE Updates [${clientIdStr}]: Timeout alcanzado, limpiando`);
            cleanupClient();
        }
    }, SSE_CLIENT_TIMEOUT);

    // Heartbeat con actualización de lastActivity
    const heartbeat = setInterval(() => {
        if (!sendEvent('heartbeat', { timestamp: Date.now() })) {
            cleanupClient();
        } else {
            // ✅ Actualizar lastActivity
            client.lastActivity = Date.now();
        }
    }, 30000);

    // Limpiar al desconectar
    req.on('close', cleanupClient);
    req.on('error', cleanupClient);
};

/**
 * SSE Stream PROGRESIVO para carga ultra-rápida
 * GET /api/spaces/stream-progressive
 * 
 * ARQUITECTURA HÍBRIDA - 3 CAPAS
 * ==============================
 * CAPA 1 (Frontend): Skeletons inmediatos (0ms)
 * CAPA 2 (Este endpoint): Metadata via SSE streaming (200-800ms)
 * CAPA 3 (Frontend): Lazy loading de imágenes (1-5s)
 * 
 * Eventos emitidos:
 * - connected: Confirmación + total estimado
 * - manhwa: Un manhwa individual (streaming progresivo)
 * - manhwa-batch: Lote de manhwas (optimización)
 * - progress: Mensaje de progreso
 * - complete: Streaming finalizado
 * - initial: Fallback - todos los datos de golpe (si hay cache)
 */
const streamProgressiveManhwas = async (req, res) => {
    const clientId = Date.now() + Math.random();
    const clientIdStr = clientId.toFixed(0);
    const startTime = Date.now();
    logger.debug(`🚀 SSE Progressive: Cliente conectando: ${clientIdStr}`);

    // Headers SSE optimizados
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let isConnected = true;

    // Helper para enviar eventos SSE
    const sendEvent = (eventName, data) => {
        if (!isConnected) return false;
        try {
            res.write(`event: ${eventName}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            return true;
        } catch {
            isConnected = false;
            return false;
        }
    };

    // PASO 1: Si hay cache, enviar inmediatamente como 'initial' (FAST PATH)
    const cached = getCacheNonBlocking(true);
    if (cached && cached.data?.series?.length > 0) {
        logger.debug(`📦 SSE Progressive [${clientIdStr}]: Cache hit (${cached.source}), enviando initial...`);

        sendEvent('connected', {
            message: 'Conectado - datos desde cache',
            clientId: clientIdStr,
            total: cached.data.series.length,
            source: cached.source
        });

        sendEvent('initial', {
            series: cached.data.series,
            total: cached.data.series.length,
            source: cached.source,
            loadTime: Date.now() - startTime
        });

        sendEvent('complete', {
            total: cached.data.series.length,
            loadTime: Date.now() - startTime,
            source: cached.source
        });

        res.end();
        return;
    }

    // PASO 2: Sin cache - streaming progresivo real
    logger.info(`🔄 SSE Progressive [${clientIdStr}]: Sin cache, iniciando streaming...`);

    sendEvent('connected', {
        message: 'Conectado - cargando manhwas...',
        clientId: clientIdStr,
        total: 0 // Se actualizará cuando sepamos
    });

    sendEvent('progress', {
        message: 'Obteniendo lista de manhwas...',
        loaded: 0,
        total: 0
    });

    try {
        // Obtener objetos de Spaces
        const objects = await listAllObjects();
        logger.debug(`📦 SSE Progressive [${clientIdStr}]: ${objects.length} objetos encontrados`);

        // Parsear estructura (esto es rápido)
        const seriesMap = parseSpacesStructure(objects);
        const totalSeries = seriesMap.size;

        logger.info(`📚 SSE Progressive [${clientIdStr}]: ${totalSeries} series encontradas, iniciando streaming...`);

        sendEvent('progress', {
            message: `Encontradas ${totalSeries} series, cargando...`,
            loaded: 0,
            total: totalSeries
        });

        // Convertir a array para procesar
        const seriesArray = [];
        let processed = 0;
        const BATCH_SIZE = 3; // Enviar en lotes de 3 para eficiencia
        let batch = [];

        for (const series of seriesMap.values()) {
            if (!isConnected) break;

            const chapters = Array.from(series.chapters.values())
                .sort((a, b) => b.number - a.number);

            const manhwaData = {
                slug: series.slug,
                title: series.title,
                cover: series.cover || (chapters.length > 0 && chapters[0].pages.length > 0
                    ? chapters[0].pages[0].url
                    : null),
                status: 'ongoing',
                contentType: 'manhwa',
                chapterCount: chapters.length,
                chapters: chapters.slice(0, 5).map(ch => ({
                    number: ch.number,
                    slug: ch.slug,
                    pageCount: ch.pageCount,
                    time: getRelativeTime(ch.lastModified)
                })),
                lastUpdated: series.lastModified,
                viewCount: 0
            };

            seriesArray.push(manhwaData);
            batch.push(manhwaData);
            processed++;

            // Enviar en lotes para mejor eficiencia de red
            if (batch.length >= BATCH_SIZE || processed === totalSeries) {
                if (batch.length === 1) {
                    // Un solo manhwa, enviar individualmente
                    sendEvent('manhwa', batch[0]);
                } else {
                    // Múltiples, enviar como batch
                    sendEvent('manhwa-batch', { manhwas: batch });
                }

                // Actualizar progreso cada 5 series
                if (processed % 5 === 0 || processed === totalSeries) {
                    sendEvent('progress', {
                        message: `Cargando... ${processed}/${totalSeries}`,
                        loaded: processed,
                        total: totalSeries
                    });
                }

                batch = [];

                // Pequeña pausa para dar tiempo al frontend de procesar
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Ordenar por última actualización
        seriesArray.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

        // Actualizar cache
        const loadTime = Date.now() - startTime;
        spacesCache = {
            ...spacesCache,
            data: { series: seriesArray, total: seriesArray.length },
            timestamp: Date.now(),
            ttl: CACHE_CONFIG.ttl,
            lastPreloadDuration: loadTime
        };

        // Enviar evento de completado
        sendEvent('complete', {
            total: seriesArray.length,
            loadTime,
            message: 'Carga completada'
        });

        logger.info(`✅ SSE Progressive [${clientIdStr}]: Completado en ${loadTime}ms (${seriesArray.length} series)`);

    } catch (error) {
        console.error(`❌ SSE Progressive [${clientIdStr}]: Error:`, error.message);

        sendEvent('error', {
            message: 'Error cargando manhwas',
            error: error.message,
            canRetry: true,
            useApiFallback: true
        });
    }

    // Cleanup
    req.on('close', () => {
        isConnected = false;
        logger.debug(`🔌 SSE Progressive [${clientIdStr}]: Desconectado`);
    });

    res.end();
};

/**
 * Notificar a todos los clientes SSE sobre un nuevo capítulo
 * Llamar desde syncWebhook cuando hay nuevo contenido
 */
const notifyNewChapter = (seriesSlug, chapterNumber, seriesTitle = null) => {
    const payload = {
        type: 'new_chapter',
        seriesSlug,
        chapterNumber,
        seriesTitle: seriesTitle || slugToTitle(seriesSlug),
        timestamp: Date.now(),
        series: spacesCache.data?.series || null
    };

    let sent = 0;
    updateClients.forEach(client => {
        if (client.sendEvent('new_chapter', payload)) {
            sent++;
        }
    });

    logger.info(`📢 Notificación new_chapter enviada a ${sent}/${updateClients.size} clientes`);
    return sent;
};

/**
 * Notificar a todos los clientes SSE sobre una nueva serie
 */
const notifyNewSeries = (seriesSlug, title = null) => {
    const payload = {
        type: 'new_series',
        seriesSlug,
        title: title || slugToTitle(seriesSlug),
        timestamp: Date.now(),
        series: spacesCache.data?.series || null
    };

    let sent = 0;
    updateClients.forEach(client => {
        if (client.sendEvent('new_series', payload)) {
            sent++;
        }
    });

    logger.info(`📢 Notificación new_series enviada a ${sent}/${updateClients.size} clientes`);
    return sent;
};

/**
 * Notificar actualización genérica
 */
const notifyUpdate = (type, data = {}) => {
    const payload = {
        type,
        ...data,
        timestamp: Date.now(),
        series: spacesCache.data?.series || null
    };

    let sent = 0;
    updateClients.forEach(client => {
        if (client.sendEvent('update', payload)) {
            sent++;
        }
    });

    return sent;
};

/**
 * Obtener número de clientes SSE conectados
 */
const getUpdateClientsCount = () => updateClients.size;

/**
 * ✅ Obtener Map de updateClients para limpieza periódica (usado por server.js)
 */
const getUpdateClientsMap = () => updateClients;

module.exports = {
    listManhwasFromDatabase,  // ✅ NUEVO: Lectura rápida desde BD
    listManhwasFromSpaces,    // LEGACY: Solo para sincronización
    getManhwaFromSpaces,
    getChapterPagesFromSpaces,
    streamUpdates,
    streamUpdatesOnly,
    streamProgressiveManhwas,
    syncWebhook,
    syncToDatabase,
    preloadCache,
    startAutoPreload,
    stopAutoPreload,
    getCacheStats,
    getCacheState,
    // Funciones de notificación SSE
    notifyNewChapter,
    notifyNewSeries,
    notifyUpdate,
    getUpdateClientsCount,
    getUpdateClientsMap,  // ✅ Export para limpieza periódica
    CACHE_CONFIG,
    CACHE_STATE
};
