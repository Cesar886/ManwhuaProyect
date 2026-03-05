const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');
const { LRUCache } = require('lru-cache');
const { initDB, dbAvailable, healthCheck: dbHealthCheck, setLogger: setDbLogger, getSeriesEmbeddingCount, cleanQueryCache } = require('./db');
const { buildEmbeddingText, getQueryEmbedding, getEmbeddings, upsertSeriesEmbedding, vectorSearch, getCachedQueryEmbedding, cacheQueryEmbedding, syncEmbeddings, setLogger: setEmbeddingsLogger } = require('./embeddings');

const app = express();
let server;
let fuse; // Declarar variable global faltante

// Mapa de peticiones a la IA que están actualmente en proceso (Promise Coalescing)
const inFlightRequests = new Map();

// Archivo donde guardaremos la "memoria"
const CACHE_FILE_PATH = path.join(__dirname, 'ai_search_cache.json');

// Archivo donde guardaremos el historial de consultas (persiste hasta borrado manual)
const QUERY_HISTORY_FILE = path.join(__dirname, 'query_history.json');
let queryHistory = [];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

app.set('trust proxy', 1);
// Añadir compresión para ahorrar ancho de banda
app.use(compression());
// Helmet más estricto: CSP básico y HSTS para producción
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
// ===== CORRECCIÓN 1: Aplicar CORS =====
// --- CORS (orígenes permitidos configurable) ---
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    optionsSuccessStatus: 200
};
// Aplicar CORS con las opciones configuradas
app.use(cors(corsOptions));

app.use(express.json({ limit: '10kb' }));

// --- UTILIDADES BÁSICAS ---
const cleanText = (text) => {
    return (text || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
};
// Alias con nombre explícito para normalizar consultas (compatibilidad con la especificación)
const normalizeQuery = cleanText;

// Logger estructurado: intenta usar `pino` si está instalado, sino fallback no bloqueante.
let logger;
try {
    const pino = require('pino');
    const pinoLogger = pino({ level: process.env.LOG_LEVEL || 'info', timestamp: pino.stdTimeFunctions.isoTime });
    logger = {
        info: (msg, data) => pinoLogger.info(data || {}, msg),
        warn: (msg, data) => pinoLogger.warn(data || {}, msg),
        error: (msg, err) => pinoLogger.error({ error: err && (err.message || err) }, msg),
        perf: (label, start) => pinoLogger.info({ duration_ms: Date.now() - start }, label)
    };
} catch (e) {
    // Fallback: usar console directamente para errores (síncrono) para no perder logs al cerrar
    logger = {
        info: (msg, data) => console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg, data: data || null })),
        warn: (msg, data) => console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg, data: data || null })),
        error: (msg, err) => console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg, error: err && (err.message || err), stack: err && err.stack })),
        perf: (label, start) => console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'perf', msg: label, duration_ms: Date.now() - start }))
    };
}

// Validar API key ahora que logger ya está definido
if (!OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY no está configurada');
    process.exit(1);
}

// --- MANEJADORES GLOBALES DE ERRORES NO CAPTURADOS ---
process.on('uncaughtException', (err) => {
    logger.error('uncaughtException — error no capturado', err);
    // No salir: mantener el servidor vivo para el resto de usuarios
});
process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection — promesa rechazada sin capturar', reason instanceof Error ? reason : new Error(String(reason)));
});

// --- DETECTOR DE CONSULTAS SIMPLES (VERSIÓN EXPANDIDA) ---
// Raíces de palabras que OBLIGAN a usar la IA (se buscan como subcadena)
const TRIGGER_ROOTS = [
    // 1. INTENCIÓN Y PREGUNTAS (El usuario le habla al buscador)
    'trata', 'donde', 'busca', 'recomend', 'dame', 'similar', 'parecid',
    'mejor', 'top', 'sugier', 'dime', 'cual', 'quiero', 'necesit', 'lista',
    'leer', 'busco', 'algun', 'enseñ', 'gust', 'encant', 'tipo', 'vibr', 'estilo',

    // 2. TÉRMINOS DEL MEDIO Y DEMOGRAFÍA
    'manhwa', 'webtoon', 'manga', 'manhua', 'comic', 'histori',
    'shonen', 'shounen', 'seinen', 'shoujo', 'josei', 'genero',

    // 3. GÉNEROS PRINCIPALES
    'accion', 'aventur', 'comedi', 'fantasi', 'romanc', 'terror', 'misteri',
    'escolar', 'ciencia', 'ficcion', 'harem', 'murim', 'drama', 'suspens',
    'psicologic', 'vida', 'slice',

    // 4. ARQUETIPOS DE PERSONAJES (Protas, villanos, clases)
    'prota', 'heroe', 'villan', 'antihero', 'asesin', 'nigromant', 'necromanc',
    'invocad', 'demoni', 'vampir', 'zombie', 'no-muert', 'druida', 'cazador',
    'hunter', 'jugador', 'player', 'dios', 'constelac', 'besti', 'dragon',
    'duqu', 'emper', 'tiran', 'princes', 'rey', 'realez', 'noble', 'ceo', 'jef',

    // 5. TROPOS DE ACCIÓN / SISTEMAS / MURIM
    'sistem', 'nivel', 'artes marcial', 'cultiv', 'tower', 'torre', 'dungeon',
    'mazmorra', 'portal', 'gremi', 'rango', 'rank', 'apocalip', 'superviv',
    'espad', 'magi', 'pelea', 'golpe', 'sangr', 'gore', 'matar', 'muert',

    // 6. TROPOS DE ROMANCE Y OTOME ISEKAI
    'amor', 'contrat', 'matrimon', 'casamient', 'divorci', 'infidel', 'engañ',
    'gemel', 'fals', 'celos', 'oficin', 'espos', 'marid', 'embaraz',

    // 7. DESARROLLO DE TRAMA (Regresión, Venganza, etc.)
    'reencarn', 'reencar', 'regres', 'volver', 'pasado', 'venganz', 'traicion',
    'abandon', 'isekai', 'reencarnac', 'reencarnad',

    // 8. ADJETIVOS Y MODIFICADORES DE ESTADO (Vibes)
    'poder', 'fuerte', 'debil', 'op', 'chetad', 'rot', 'invencibl', 'badass',
    'despiadad', 'fri', 'calculad', 'inteligent', 'tont', 'inutil', 'basur',
    'epico', 'llorar', 'trist', 'feliz', 'gracios', 'divertid', 'adult', 'madur',
    'lento', 'rapido', 'desarrollo'
];

function isSimpleQuery(msg) {
    if (!msg || typeof msg !== 'string') return false;

    const lowerMsg = normalizeQuery(msg);

    // Solo las raíces de INTENCIÓN directa (preguntas al buscador) activan la IA
    const intentRoots = ['trata', 'donde', 'busca', 'recomend', 'dame', 'similar', 'parecid', 'mejor', 'top', 'sugier', 'dime', 'cual', 'quiero', 'necesit', 'busco', 'enseñ'];

    // Si tiene una raíz de intención directa, sí o sí va a la IA
    if (intentRoots.some(root => lowerMsg.includes(root))) return false;

    // ELIMINADA: La regla de "if (words.length > 4) return false;" para no romper títulos largos.

    return true;
}

// --- DETECTOR DE NEGACIONES MÁS ROBUSTO ---
function detectNegative(msg) {
    if (!msg || typeof msg !== 'string') return false;
    const lowerMsg = normalizeQuery(msg);
    const patterns = [
        /\b(no|sin|menos|excepto|evitar|diferente|distinto|nada)\b/i,
        /que\s+(no|nunca)\s+/i, // 'que no sean'
        /nada\s+de\b/i,         // 'nada de romance'
        /diferente(s)?\s+(a|de)\b/i
    ];
    return patterns.some(p => p.test(lowerMsg));
}

// --- MAPEO DE SEGURIDAD PARA GÉNEROS (claves en español normalizado) ---
const genreMapping = {
    'accion': 'Acción', 'aventura': 'Aventura', 'comedia': 'Comedia',
    'fantasia': 'Fantasía', 'romance': 'Romance', 'terror': 'Terror',
    'misterio': 'Misterio', 'escolar': 'Escolar', 'ciencia ficcion': 'Ciencia Ficción',
    'harem': 'Harem', 'murim': 'Murim'
};

// --- CACHÉ ---
let seriesCache = [];
let lastFetchTime = 0;
// Promesa en vuelo para evitar llamadas concurrentes a refreshCache
let refreshCachePromise = null;

// --- CACHÉ DE BÚSQUEDAS FRECUENTES (LRU real) ---
const searchCache = new LRUCache({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minutos por defecto
    allowStale: false,
    updateAgeOnGet: true
});

// Índice invertido para géneros: soporte doble (original y normalizado)
let genreIndex = {};
let genreIndexNormalized = {};
// Índice de títulos exactos para lookup O(1)
let exactTitleIndex = new Map();

function buildGenreIndex() {
    genreIndex = {};
    genreIndexNormalized = {};
    exactTitleIndex.clear();

    seriesCache.forEach(s => {
        try {
            const rawLabels = (s.genres || []).map(g => (g && (g.name || g)) || '').filter(Boolean);
            const normalizedLabels = s._searchGenres || rawLabels.map(r => cleanText(r));

            rawLabels.forEach(original => {
                if (!genreIndex[original]) genreIndex[original] = [];
                genreIndex[original].push(s);
            });

            normalizedLabels.forEach(n => {
                if (!genreIndexNormalized[n]) genreIndexNormalized[n] = [];
                genreIndexNormalized[n].push(s);
            });

            // Índices exactos O(1) para títulos
            if (s._searchTitle) exactTitleIndex.set(s._searchTitle, s);

            if (s.alternativeTitles) {
                s.alternativeTitles.forEach(alt => {
                    const cleanAlt = cleanText(alt);
                    if (cleanAlt) exactTitleIndex.set(cleanAlt, s);
                });
            }

            if (s.originalTitle) {
                exactTitleIndex.set(cleanText(s.originalTitle), s);
            }
        } catch (err) {
            logger.warn('Error indexando géneros', { series: s && (s.title || s.id) || '<unknown>', error: err && err.message });
        }
    });
    logger.info('Índices construidos', { genres_original: Object.keys(genreIndex).length, genres_normalized: Object.keys(genreIndexNormalized).length, exact_titles: exactTitleIndex.size });
}

// --- ÍNDICE INVERTIDO DE KEYWORDS (O(1) lookup para palabras sueltas) ---
let keywordIndex = {};
function buildKeywordIndex() {
    keywordIndex = {};
    seriesCache.forEach(s => {
        // Indexar palabras del título principal
        const titleWords = (s._searchTitle || '').split(/\s+/);
        titleWords.forEach(word => {
            if (word.length > 3) {
                if (!keywordIndex[word]) keywordIndex[word] = [];
                keywordIndex[word].push(s);
            }
        });

        // Indexar palabras de títulos alternativos
        (s.alternativeTitles || []).forEach(alt => {
            cleanText(alt).split(/\s+/).forEach(word => {
                if (word.length > 3) {
                    if (!keywordIndex[word]) keywordIndex[word] = [];
                    keywordIndex[word].push(s);
                }
            });
        });

        // Indexar palabras del título original
        if (s.originalTitle) {
            cleanText(s.originalTitle).split(/\s+/).forEach(word => {
                if (word.length > 3) {
                    if (!keywordIndex[word]) keywordIndex[word] = [];
                    keywordIndex[word].push(s);
                }
            });
        }
    });
    logger.info('Índice de keywords construido', { keywords: Object.keys(keywordIndex).length });
}

// Pool global de tokens para reducir duplicación de strings en memoria
const tokenIndex = new Map(); // token -> id (number)
let nextTokenId = 1;
function getTokenId(token) {
    const t = token || '';
    const existing = tokenIndex.get(t);
    if (existing) return existing;
    const id = nextTokenId++;
    tokenIndex.set(t, id);
    return id;
}

// --- SANITIZAR SERIES PARA RESPUESTA AL FRONTEND ---
// Elimina campos internos de búsqueda y normaliza nombres de campos
function sanitizeSeriesForResponse(seriesArray) {
    if (!Array.isArray(seriesArray)) return [];
    return seriesArray.map(s => ({
        id: s.id,
        title: s.title,
        slug: s.slug,
        cover: s.coverUrl || s.cover_url || s.cover || null,
        coverUrl: s.coverUrl || s.cover_url || s.cover || null,
        synopsis: s.synopsis || null,
        status: s.status || 'ongoing',
        contentType: s.contentType || null,
        rating: s._rating || parseFloat(s.rating) || 0,
        views: s._views || parseInt(s.views) || 0,
        chapterCount: s._chapterCount || parseInt(s.chapterCount) || 0,
        releaseYear: s._year || parseInt(s.releaseYear) || 0,
        genres: (s.genres || []).map(g => (g && (g.name || g)) || '').filter(Boolean),
        themes: s.themes || [],
        protagonistType: s.protagonistType || null,
        tone: s.tone || null,
        originalTitle: s.originalTitle || null,
    }));
}

// Métricas de rendimiento
const metrics = {
    totalSearches: 0,
    aiCalls: 0,
    fallbackSearches: 0,
    cacheHits: 0,
    vectorSearches: 0,
    avgResponseTime: 0,
    // responseTimes kept as a bounded sample buffer; use rolling sum/count to compute avg efficiently
    responseTimes: [],
    responseTimesSum: 0,
    responseTimesCount: 0
};
const SEARCH_CACHE_TTL = 1000 * 60 * 5; // 5 minutos

function getCachedSearch(key) {
    const entry = searchCache.get(key);
    if (!entry) return null;

    // LRUCache ya maneja el reordenamiento con updateAgeOnGet: true

    // entry.data.series puede contener IDs (viejo formato) o objetos completos.
    const seriesField = entry.data.series || [];
    const fullSeries = seriesField.length > 0 && (typeof seriesField[0] === 'object')
        ? seriesField
        : seriesField.map(id => seriesCache.find(s => s.id === id)).filter(Boolean);

    return { ...entry.data, series: fullSeries };
}

function setCachedSearch(key, data, ttl = SEARCH_CACHE_TTL, persist = true) {
    const seriesFull = (data.series || []).map(s => typeof s === 'object' ? s : (seriesCache.find(x => x.id === s) || null)).filter(Boolean);
    const cachedData = { ...data, series: seriesFull };

    // LRUCache maneja evicción automáticamente; usar TTL personalizado si se provee
    searchCache.set(key, { data: cachedData, timestamp: Date.now(), ttl, persist }, { ttl });
}

// Estadísticas de uso para queries populares
const searchStats = new Map();

// --- CACHE PREWARM (consultas populares) ---
const POPULAR_QUERIES = [
    'romance escolar',
    'accion aventura',
    'murim',
    'reencarnacion',
    'venganza',
    'sistema niveles',
    'fantasia',
    'los mejores'
];

async function prewarmCache() {
    logger.info('Iniciando precalentamiento progresivo de caché...');

    // Procesar uno por uno con pausa para no saturar
    for (const query of POPULAR_QUERIES) {
        try {
            const result = await callAI(query);
            if (result) {
                const key = cleanText(query);
                const payload = {
                    success: true,
                    explanation: result.reason || ('Prewarm: ' + query),
                    series: [],
                    appliedFilter: result
                };
                setCachedSearch(key, payload, 1000 * 60 * 30);
            }
        } catch (e) {
            logger.warn('Error en prewarm', { query, error: e?.message });
        }
        // 3 segundos entre cada query para no saturar OpenAI
        await new Promise(r => setTimeout(r, 3000));
    }

    logger.info('Precalentamiento finalizado', {
        cached: searchCache.size,
        popular: POPULAR_QUERIES.length
    });
}

// --- RATE LIMITER ESPECÍFICO PARA LLAMADAS A IA ---
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // máximo 10 llamadas por minuto
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muchas búsquedas IA, espera 1 min' }
});
// ⚡ Rate limiter global para prevenir DoS en todas las rutas /api/*
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.GLOBAL_RATE_MAX, 10) || 100, // 100 requests por IP por defecto
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones, intenta en 15 minutos' }
});

// Aplicar limitador global a todas las rutas /api/
app.use('/api/', globalLimiter);

function normalizeData(data) {
    return data.map(s => {
        const _searchTitle = cleanText(s.title);

        // Helper para asegurar que campos que deben ser arrays lo sean realmente
        const ensureArray = (val) => Array.isArray(val) ? val : [];

        // Extraer y asegurar tipos correctos
        const genres = ensureArray(s.genres);
        const alternativeTitles = ensureArray(s.alternativeTitles);
        const themes = ensureArray(s.themes);
        const narrativeTropes = ensureArray(s.narrativeTropes);
        const officialHashtags = ensureArray(s.officialHashtags);

        // Manejo robusto de géneros para el índice
        const _searchGenres = genres.map(g => cleanText(g && (g.name || g))).filter(Boolean);
        const _genreSet = new Set(_searchGenres);

        const _titleWords = _searchTitle.split(/\s+/).filter(w => w.length > 0);

        // Concatenamos TODOS los campos útiles de forma segura
        const _fullText = cleanText(`
      ${s.title || ''} 
      ${s.originalTitle || ''} 
      ${alternativeTitles.join(' ')} 
      ${s.synopsis || ''} 
      ${genres.map(g => (g && (g.name || g)) || '').join(' ')} 
      ${themes.join(' ')} 
      ${narrativeTropes.join(' ')} 
      ${s.tone || ''} 
      ${s.protagonistType || ''} 
      ${s.powerSystem || ''} 
      ${s.artStyle || ''} 
      ${s.targetDemographic || ''} 
      ${s.romanceLevel || ''}
      ${officialHashtags.join(' ')}
    `);

        // Convertimos todo ese texto gigante en IDs de tokens para búsqueda rápida
        const tokenIds = Array.from(new Set(
            _fullText.split(/\s+/)
                .filter(w => w.length > 2)
                .map(t => getTokenId(t))
        )).sort((a, b) => a - b);

        return {
            ...s,
            // Sobrescribimos campos originales con versiones seguras (Arrays)
            genres,
            alternativeTitles,
            themes,
            narrativeTropes,
            officialHashtags,
            // Campos de búsqueda internos
            _searchTitle,
            _searchGenres,
            _genreSet,
            _titleWords,
            _searchSynopsis: cleanText(s.synopsis),
            _fullText,
            _fullTextTokenIds: tokenIds,
            _chapterCount: parseInt(s.chapterCount) || 0,
            _rating: parseFloat(s.rating) || 0,
            _views: parseInt(s.views) || 0,
            _weeklyViews: parseInt(s.weeklyViews) || 0,
            _monthlyViews: parseInt(s.monthlyViews) || 0,
            _year: parseInt(s.releaseYear) || 0
        };
    });
}

async function refreshCache() {
    // Si ya hay una actualización en curso, reutilizarla
    if (refreshCachePromise) return refreshCachePromise;
    refreshCachePromise = (async () => {
        try {
            const API_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmNjc0Y2UzOS1hZDYxLTRhMGMtODBjNi04NjIxNGJjMDlmNWMiLCJpYXQiOjE3NzE3MzkzOTgsImV4cCI6MjA4NzMxNTM5OH0.SAqwnrGRPZ0HfQKaxFNu9VhrOhudGYcgsttt9sKdxXk';
            const rawList = [];
            let page = 1;
            while (true) {
                const fetchController = new AbortController();
                const fetchTimeout = setTimeout(() => fetchController.abort(), 30000);
                let seriesRes;
                try {
                    seriesRes = await fetch(`https://manhwaimperial.site/api/series?limit=100&page=${page}`, {
                        headers: {
                            'Origin': 'https://manhwaimperial.site',
                            'Authorization': API_TOKEN
                        },
                        signal: fetchController.signal
                    });
                } finally {
                    clearTimeout(fetchTimeout);
                }
                if (!seriesRes.ok) {
                    logger.warn('refreshCache: respuesta no-ok del backend', { status: seriesRes.status, page });
                    break;
                }
                const seriesData = await seriesRes.json().catch(() => ({}));
                const batch = seriesData.data?.series || [];
                if (batch.length === 0) break;
                rawList.push(...batch);
                logger.info('Descargando series...', { page, batch: batch.length, total: rawList.length });
                page++;
            }
            // ⚠️ Evitar fuga de memoria: limpiar el pool de tokens y reiniciar IDs
            tokenIndex.clear();
            nextTokenId = 1;
            seriesCache = normalizeData(rawList);
            buildGenreIndex(); // Construir índice invertido tras normalizar datos
            buildKeywordIndex(); // Índice O(1) para palabras sueltas

            // Sincronizar embeddings de series nuevas en background
            if (dbAvailable()) {
                syncEmbeddings(seriesCache).catch(err => logger.warn('Embedding sync failed', { error: err.message }));
            }

            // Inicializar Fuse.js con los datos actualizados
            const fuseOptions = {
                keys: [
                    { name: 'title', weight: 3 },
                    { name: '_searchTitle', weight: 2.5 },
                    { name: 'originalTitle', weight: 2 },
                    { name: 'alternativeTitles', weight: 2 },
                    { name: '_searchSynopsis', weight: 0.5 }
                ],
                threshold: 0.45,        // Más tolerante a typos (0 = exacto, 1 = todo)
                distance: 200,          // Buscar en strings largos
                minMatchCharLength: 2,  // Mínimo 2 caracteres para considerar match
                ignoreLocation: true,   // No penalizar por posición del match
                includeScore: true       // Incluir score para poder filtrar
            };
            fuse = new Fuse(seriesCache, fuseOptions);

            lastFetchTime = Date.now();
            logger.info('Cache actualizado', { count: seriesCache.length });
            return true;
        } catch (err) {
            logger.error('Error en refreshCache', err);
            return false;
        } finally {
            // permitir nuevas actualizaciones tras completar
            refreshCachePromise = null;
        }
    })();
    return refreshCachePromise;
}

// --- BÚSQUEDA INTELIGENTE: subcadena + fuzzy ---
function performFallbackSearch(userMsg) {
    const query = cleanText(userMsg);
    if (!query || query.length < 2) return [];

    const queryWords = query.split(/\s+/).filter(w => w.length >= 2);
    const seen = new Set();
    const results = [];

    // Paso 1: Título contiene la query completa como subcadena
    // "solo lev" -> "Solo Leveling" ✓
    for (const s of seriesCache) {
        if (s._searchTitle && s._searchTitle.includes(query)) {
            seen.add(s.id);
            // Score basado en qué tan exacto es el match (título corto = más relevante)
            const titleLen = s._searchTitle.length;
            const queryLen = query.length;
            const score = 1 - (queryLen / titleLen); // 0 = match perfecto, ~1 = match parcial
            results.push({ item: s, score: score * 0.1, source: 'exact' });
        }
    }

    // Paso 2: Títulos alternativos / título original contiene la query
    for (const s of seriesCache) {
        if (seen.has(s.id)) continue;
        const altMatch = (s.alternativeTitles || []).some(alt => cleanText(alt).includes(query));
        const origMatch = s.originalTitle && cleanText(s.originalTitle).includes(query);
        if (altMatch || origMatch) {
            seen.add(s.id);
            results.push({ item: s, score: 0.15, source: 'alt_title' });
        }
    }

    // Paso 3: Todas las palabras del query aparecen en el título (orden libre)
    // "leveling solo" -> "Solo Leveling" ✓
    if (queryWords.length > 1) {
        for (const s of seriesCache) {
            if (seen.has(s.id)) continue;
            const title = s._searchTitle || '';
            const allMatch = queryWords.every(w => title.includes(w));
            if (allMatch) {
                seen.add(s.id);
                results.push({ item: s, score: 0.2, source: 'all_words' });
            }
        }
    }

    // Paso 3.5: Keyword Index O(1) — búsqueda instantánea por palabras clave
    // "sistema" -> todas las series con "sistema" en el título
    if (results.length < 40) {
        for (const word of queryWords) {
            const indexed = keywordIndex[word];
            if (indexed) {
                for (const s of indexed) {
                    if (seen.has(s.id)) continue;
                    seen.add(s.id);
                    results.push({ item: s, score: 0.22, source: 'keyword_index' });
                    if (results.length >= 50) break;
                }
            }
            if (results.length >= 50) break;
        }
    }

    // Paso 4: Fuse.js fuzzy (typos, mala ortografía)
    // "sollo levelig" -> "Solo Leveling" ✓
    if (results.length < 40 && fuse) {
        try {
            const fuseResults = fuse.search(userMsg, { limit: 30 });
            for (const r of fuseResults) {
                if (!r || !r.item || seen.has(r.item.id)) continue;
                if (r.score <= 0.45) {
                    seen.add(r.item.id);
                    results.push({ item: r.item, score: 0.3 + r.score, source: 'fuzzy' });
                }
            }
        } catch (fuseErr) {
            logger.warn('Fuse.js falló en búsqueda', { error: fuseErr.message });
        }
    }

    // Paso 5: Búsqueda en texto completo (sinopsis, géneros, temas) — complementar resultados
    // "protagonista op" busca en sinopsis y metadata
    if (results.length < 30 && queryWords.length > 0) {
        for (const s of seriesCache) {
            if (seen.has(s.id)) continue;
            const text = s._fullText || '';
            const matchCount = queryWords.filter(w => text.includes(w)).length;
            // Requiere que al menos 60% de las palabras matcheen
            if (matchCount >= Math.ceil(queryWords.length * 0.6)) {
                seen.add(s.id);
                const relevance = matchCount / queryWords.length;
                results.push({ item: s, score: 0.5 + (1 - relevance) * 0.3, source: 'fulltext' });
                if (results.length >= 50) break;
            }
        }
    }

    // Ordenar por relevancia (menor score = mejor)
    results.sort((a, b) => a.score - b.score);

    logger.info('Búsqueda inteligente', {
        query: userMsg,
        results: results.length,
        sources: results.slice(0, 5).map(r => `${r.source}(${r.score.toFixed(2)})`)
    });
    // Devolver objetos con score para que el endpoint pueda evaluar calidad
    return results; // [{ item, score, source }, ...]
}

// --- BÚSQUEDA VECTORIAL CON EMBEDDINGS ---

/**
 * Calcula el threshold dinámico de similitud según la query.
 * Queries cortas (2-3 palabras) → threshold alto (0.40) porque son ambiguas.
 * Queries largas (4+ palabras) → threshold bajo (0.25) porque son más específicas.
 */
function getDynamicThreshold(queryText) {
    const words = queryText.trim().split(/\s+/).length;
    if (words <= 2) return 0.42;
    if (words <= 3) return 0.38;
    if (words <= 5) return 0.32;
    return 0.25; // Queries muy descriptivas: threshold bajo
}

/**
 * Re-ranking híbrido: combina similitud vectorial con señales de metadata local.
 * Boost si la serie tiene keywords de la query en sus géneros, temas o tropos.
 */
function hybridRerank(results, userMsg) {
    const queryClean = cleanText(userMsg);
    const queryWords = queryClean.split(/\s+/).filter(w => w.length > 2);

    if (queryWords.length === 0) return results;

    return results.map(r => {
        let boost = 0;
        const series = r.item;

        // Boost por match en géneros (+0.08 por cada género que coincide)
        const seriesGenres = series._searchGenres || [];
        for (const word of queryWords) {
            if (seriesGenres.some(g => g.includes(word))) {
                boost += 0.08;
            }
        }

        // Boost por match en temas/tropos (+0.06 por cada match)
        const themes = (series.themes || []).map(t => cleanText(t));
        const tropes = (series.narrativeTropes || []).map(t => cleanText(t));
        const allMeta = [...themes, ...tropes];
        for (const word of queryWords) {
            if (allMeta.some(m => m.includes(word))) {
                boost += 0.06;
            }
        }

        // Boost por match en protagonistType o powerSystem (+0.05)
        const prota = cleanText(series.protagonistType || '');
        const power = cleanText(series.powerSystem || '');
        const tone = cleanText(series.tone || '');
        for (const word of queryWords) {
            if (prota.includes(word) || power.includes(word) || tone.includes(word)) {
                boost += 0.05;
            }
        }

        // Boost por match en sinopsis (+0.03 por palabra encontrada)
        const synopsis = series._searchSynopsis || '';
        for (const word of queryWords) {
            if (synopsis.includes(word)) {
                boost += 0.03;
            }
        }

        // Pequeño boost por popularidad (views/rating) para desempatar
        if (series._rating >= 4.5) boost += 0.02;
        if (series._weeklyViews > 10000) boost += 0.01;

        const finalSimilarity = Math.min(r.similarity + boost, 1.0);

        return {
            ...r,
            similarity: finalSimilarity,
            score: 1 - finalSimilarity,
            vectorSimilarity: r.similarity, // Preservar la original
            metadataBoost: boost
        };
    }).sort((a, b) => b.similarity - a.similarity); // Re-ordenar por similitud ajustada
}

async function performVectorSearch(userMsg) {
    if (!dbAvailable()) return null;

    try {
        const queryKey = cleanText(userMsg);

        // Threshold dinámico según longitud de la query
        const minSimilarity = getDynamicThreshold(userMsg);

        // Buscar embedding cacheado de la query
        let queryEmbedding = await getCachedQueryEmbedding(queryKey);

        // Si no existe, generar y cachear (query expansion ocurre dentro de getQueryEmbedding)
        if (!queryEmbedding) {
            queryEmbedding = await getQueryEmbedding(userMsg);
            // Cachear en background (no bloquear)
            cacheQueryEmbedding(queryKey, queryEmbedding).catch(err =>
                logger.warn('Error cacheando query embedding', { error: err.message })
            );
        }

        // Ejecutar búsqueda vectorial con threshold dinámico
        // Pedir más resultados (50) para tener margen de re-ranking y devolver 40+
        const vectorResults = await vectorSearch(queryEmbedding, 50, minSimilarity);

        if (!vectorResults || vectorResults.length === 0) return null;

        // Mapear resultados a objetos de seriesCache por ID
        const rawResults = [];
        for (const vr of vectorResults) {
            const series = seriesCache.find(s => s.id === vr.id);
            if (series) {
                rawResults.push({
                    item: series,
                    score: 1 - vr.similarity,
                    similarity: vr.similarity,
                    source: 'vector'
                });
            }
        }

        if (rawResults.length === 0) return null;

        // Re-ranking híbrido: combinar similitud vectorial con metadata local
        const results = hybridRerank(rawResults, userMsg);

        metrics.vectorSearches++;
        logger.info('Vector search completado', {
            query: userMsg,
            threshold: minSimilarity,
            rawResults: rawResults.length,
            results: results.length,
            topSimilarity: results[0]?.similarity?.toFixed(3),
            topBoost: results[0]?.metadataBoost?.toFixed(3),
            topTitle: results[0]?.item?.title
        });

        return results;
    } catch (err) {
        logger.warn('Vector search falló, usando fallback', { error: err.message });
        return null;
    }
}

// --- INTERCEPTOR DE TÍTULOS EXACTOS (O(1) via Map) ---
function findExactTitleMatch(query) {
    const q = cleanText(query);
    if (q.length < 2) return null;
    return exactTitleIndex.get(q) || null;
}

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        cache: {
            series_count: seriesCache.length,
            last_refresh: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
            age_minutes: lastFetchTime ? Math.floor((Date.now() - lastFetchTime) / 60000) : null
        },
        search_cache: {
            size: searchCache.size,
            max: 1000
        },
        vector_search: {
            enabled: dbAvailable(),
            status: dbAvailable() ? 'connected' : 'disconnected'
        }
    };
    res.json(status);
});

// --- DEBUG: Test directo de OpenAI desde el servidor ---
app.get('/api/test-ai', async (req, res) => {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        logger.info('TEST-AI: Iniciando fetch a OpenAI...');

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [{ role: 'user', content: 'responde solo: ok' }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed = Date.now() - start;
        logger.info('TEST-AI: Respuesta recibida', { status: response.status, elapsed });

        const data = await response.json();
        res.json({
            ok: true,
            elapsed_ms: elapsed,
            status: response.status,
            model: AI_MODEL,
            key_preview: OPENAI_API_KEY.substring(0, 15) + '...',
            content: data.choices?.[0]?.message?.content,
            tokens: data.usage,
            error: data.error
        });
    } catch (e) {
        const elapsed = Date.now() - start;
        logger.error('TEST-AI: Error', { error: e.message, elapsed });
        res.json({ ok: false, elapsed_ms: elapsed, error: e.message });
    }
});

// Actualización del endpoint /metrics para incluir métricas mejoradas
app.get('/metrics', (req, res) => {
    const cacheEfficiency = metrics.totalSearches > 0
        ? ((metrics.cacheHits / metrics.totalSearches) * 100).toFixed(2)
        : 0;

    res.json({
        ...metrics,
        cacheEfficiency: `${cacheEfficiency}%`,
        cacheSize: searchCache.size,
        mostPopularQueries: Array.from(searchStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([q, stats]) => ({ query: q, hits: stats.count }))
    });
});

// --- ENDPOINTS DE ADMIN PARA CACHE (protegidos por ADMIN_KEY) ---
function requireAdmin(req, res) {
    const adminKey = process.env.ADMIN_KEY || '';
    const provided = req.get('x-admin-key') || req.get('authorization') || '';
    if (!adminKey) return { ok: false, msg: 'ADMIN_KEY no configurada en servidor' };
    if (!provided) return { ok: false, msg: 'Falta cabecera x-admin-key' };
    // permitir tanto 'Bearer KEY' como la clave directa
    const token = provided.replace(/^Bearer\s+/i, '');
    if (token !== adminKey) return { ok: false, msg: 'Clave admin inválida' };
    return { ok: true };
}

app.get('/api/cache/list', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });

    const list = Array.from(searchCache.entries()).map(([key, val]) => ({
        key,
        timestamp: val.timestamp,
        ttl: val.ttl,
        persist: !!val.persist,
        seriesCount: (val.data && val.data.series) ? val.data.series.length : 0
    }));
    res.json({ success: true, entries: list });
});

app.get('/api/cache/get', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });
    const key = req.query.key;
    if (!key) return res.status(400).json({ success: false, error: 'se requiere query param key' });
    const entry = searchCache.get(key);
    if (!entry) return res.status(404).json({ success: false, error: 'no encontrado' });
    res.json({ success: true, key, entry });
});

app.delete('/api/cache', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });
    const key = req.query.key;
    if (!key) return res.status(400).json({ success: false, error: 'se requiere query param key' });
    const ok = searchCache.delete(key);
    // Persistir cambio inmediatamente
    try { saveCacheSync(); } catch (e) { logger.warn('No se pudo guardar cache tras delete', e); }
    res.json({ success: true, deleted: ok });
});

app.post('/api/cache/clear', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });
    searchCache.clear();
    try { saveCacheSync(); } catch (e) { logger.warn('No se pudo guardar cache tras clear', e); }
    res.json({ success: true, cleared: true });
});

// --- ENDPOINT PÚBLICO: top consultas populares (sin auth) ---
app.get('/api/popular', (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    // Ordenar bajo demanda (no en cada request de búsqueda)
    const result = [...queryHistory]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((q, i) => ({
            rank: i + 1,
            query: q.query,
            count: q.count
        }));
    res.json({ success: true, queries: result });
});

// --- ENDPOINT PÚBLICO: top consultas "similar a..." rankeadas por popularidad ---
app.get('/api/popular-similar', (req, res) => {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const similarRegex = /similar\s*(a\b|al\b)/i;
    const result = [...queryHistory]
        .filter(q => similarRegex.test(q.query))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((q, i) => ({
            rank: i + 1,
            query: q.query,
            count: q.count
        }));
    res.json({ success: true, queries: result });
});

// --- ENDPOINTS DE HISTORIAL DE CONSULTAS ---

// Listar todas las consultas guardadas, ordenadas por popularidad (rank 1 = más popular)
app.get('/api/queries', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    // Ordenar bajo demanda y paginar
    const sorted = [...queryHistory].sort((a, b) => b.count - a.count);
    const slice = sorted.slice(offset, offset + limit).map((q, i) => ({
        rank: offset + i + 1,
        ...q
    }));

    res.json({
        success: true,
        total: queryHistory.length,
        maxCapacity: MAX_QUERY_HISTORY,
        page,
        limit,
        queries: slice
    });
});

// Eliminar una consulta específica por ID
app.delete('/api/queries/:id', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });

    const { id } = req.params;
    const before = queryHistory.length;
    queryHistory = queryHistory.filter(q => q.id !== id);
    const deleted = before - queryHistory.length;

    if (deleted === 0) return res.status(404).json({ success: false, error: 'Consulta no encontrada' });

    saveQueryHistoryAsync().catch(err => logger.warn('Error guardando historial tras delete', { error: err && err.message }));
    logger.info('🗑️ Consulta eliminada del historial', { id });
    res.json({ success: true, deleted: true, id });
});

// Limpiar todo el historial de consultas
app.post('/api/queries/clear', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });

    const count = queryHistory.length;
    queryHistory = [];
    saveQueryHistoryAsync().catch(err => logger.warn('Error guardando historial tras clear', { error: err && err.message }));
    logger.info('🗑️ Historial de consultas limpiado', { deleted: count });
    res.json({ success: true, deleted: count });
});

// --- CONFIGURACIÓN OPTIMIZADA ---
const AI_MODEL = process.env.AI_MODEL || 'gpt-5-nano-2025-08-07';
const AI_RETRIES = parseInt(process.env.AI_RETRIES, 10) || 2;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

// URL de la API de OpenAI
const SYSTEM_PROMPT = `Role: DB Search Optimizer. Output: ONLY valid JSON.
Task: Analyze user query and extract search parameters for a Manhwa DB.
DB Context: Consider concepts related to title, synopsis, genres, themes, tone, narrativeTropes, protagonistType, powerSystem, artStyle, targetDemographic, romanceLevel, status, isAdult, isNew.

Rules:
1. search_semantic: Condense the query into highly relevant Spanish keywords targeting plot, tropes, protagonist traits, or power systems (e.g., "venganza sistema regreso op debil").
2. genres: Array of recognized genres in the query.
3. exclude_terms: Array of concepts to exclude based on negations ("sin", "no", "excepto", "cero").
4. sort: Map purely to "views", "rating", or "year" if requested. Else empty.
5. "Similar to [Title]": Do NOT search the title. Instead, extract its core tropes/themes into search_semantic.
6. Flags: If user asks for "nuevos" add "nuevo" to search_semantic. If they ask for "+18", add "adulto".

7. reason: Write a SHORT friendly explanation (1 sentence, in Spanish) telling the user WHY these results were chosen. Example: "Busqué manhwas de acción donde el protagonista busca venganza y empieza siendo débil." Do NOT be technical, write as if talking to a friend.

Schema:
{"filter":{"genres":[],"search_semantic":"string","exclude_terms":[]},"sort":"string","reason":"string"}`;
// --- TIJERAS PARA LIMPIAR LA RESPUESTA DE LA IA ---
function extractJSON(text) {
    if (!text) return null;

    // 1) Extraer contenido de bloques de código si existen (```json, ``` js, etc.)
    let cleaned = text;
    const fenceRe = /```(?:json|js|text)?\s*\n?([\s\S]*?)```/i;
    const fenceMatch = fenceRe.exec(text);
    if (fenceMatch && fenceMatch[1]) {
        cleaned = fenceMatch[1];
    }

    // 2) Eliminar posibles prefijos/sufijos comunes
    cleaned = cleaned.replace(/^\s*Respuesta[:\-\s]*/i, '').trim();

    // 3) Encontrar primer carácter JSON válido ({ o [])
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    let firstOpen = -1;
    let openChar = '';
    let closeChar = '';
    if (firstObj === -1 && firstArr === -1) return null;
    if (firstObj === -1) { firstOpen = firstArr; openChar = '['; closeChar = ']'; }
    else if (firstArr === -1) { firstOpen = firstObj; openChar = '{'; closeChar = '}'; }
    else {
        if (firstObj < firstArr) { firstOpen = firstObj; openChar = '{'; closeChar = '}'; }
        else { firstOpen = firstArr; openChar = '['; closeChar = ']'; }
    }

    // 4) Encontrar la posición de cierre correspondiente respetando strings y escapes
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let escaped = false;
    let endPos = -1;
    for (let i = firstOpen; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (inString) {
            if (escaped) { escaped = false; }
            else if (ch === '\\') { escaped = true; }
            else if (ch === stringChar) { inString = false; }
            continue;
        } else {
            if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
            if (ch === openChar) { depth++; }
            else if (ch === closeChar) { depth--; if (depth === 0) { endPos = i; break; } }
        }
    }

    if (endPos === -1) return null;

    let candidate = cleaned.substring(firstOpen, endPos + 1).trim();

    // 5) Normalizar comillas tipográficas y comillas simples a dobles (suave)
    candidate = candidate.replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');

    // 6) Intentar eliminar comas finales antes de '}' o ']' que suelen romper JSON
    candidate = candidate.replace(/,\s*(}|\])/g, '$1');

    // 7) Intentar parsear; si falla, tratar de reemplazar comillas simples por dobles
    try {
        JSON.parse(candidate);
        return candidate;
    } catch (e) {
        // Reemplazar comillas simples por dobles solo si parece ser un objeto legible
        const alt = candidate.replace(/([:\[,\{\s])'([^']*)'(?=\s*[:,\]}])/g, '$1"$2"');
        try {
            JSON.parse(alt);
            return alt;
        } catch (e2) {
            // Si sigue fallando, devolver null para manejo arriba
            return null;
        }
    }
}

// Timeout máximo para llamadas IA
const AI_CALL_TIMEOUT = 30000; // 30 segundos

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Llamada directa a OpenAI con fetch (sin SDK)
 * Incluye reintentos para errores 429
 */
async function generateWithRetry(prompt, maxRetries = AI_RETRIES, externalSignal = null) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Si el cliente ya cerró la conexión, no gastar tokens
            if (externalSignal && externalSignal.aborted) {
                logger.info('Petición cancelada por el cliente antes de intentar IA');
                return null;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), AI_CALL_TIMEOUT);

            // Si el cliente cierra la conexión, abortar también este fetch
            const onExternalAbort = () => controller.abort();
            if (externalSignal) externalSignal.addEventListener('abort', onExternalAbort, { once: true });

            const res = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    response_format: { type: 'json_object' },
                    messages: [{ role: 'user', content: prompt }]
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);

            if (res.status === 429) {
                const retryAfter = res.headers.get('retry-after');
                const waitTime = retryAfter ? (parseInt(retryAfter) * 1000 + 1000) : (Math.pow(2, attempt + 1) * 1000);
                logger.warn('Rate limit 429', { waitTime: `${waitTime / 1000}s`, attempt: `${attempt + 1}/${maxRetries}` });
                await sleep(waitTime);
                continue;
            }

            if (!res.ok) {
                const errorBody = await res.text().catch(() => '');
                logger.error('Error OpenAI', { status: res.status, body: errorBody.substring(0, 200) });
                return null;
            }

            const data = await res.json();
            return data.choices?.[0]?.message?.content || null;

        } catch (error) {
            if (error.name === 'AbortError') {
                // Distinguir timeout interno vs cancelación del cliente
                if (externalSignal && externalSignal.aborted) {
                    logger.info('Llamada IA cancelada: el cliente cerró la conexión');
                    return null; // No reintentar si el cliente se fue
                }
                logger.warn('Timeout en llamada OpenAI', { attempt: `${attempt + 1}/${maxRetries}` });
            } else {
                logger.error('Error de red OpenAI', { error: error.message });
            }
            if (attempt < maxRetries - 1) {
                await sleep(Math.pow(2, attempt + 1) * 1000);
            }
        }
    }
    return null;
}

async function callAIWorker(userMsg, retries = AI_RETRIES, externalSignal = null) {
    try {
        const prompt = `${SYSTEM_PROMPT}\n\nUser query: ${userMsg}`;
        const rawText = await generateWithRetry(prompt, retries, externalSignal);

        if (!rawText) return null;

        // Con response_format: json_object, la respuesta ya es JSON válido
        // Pero añadimos try-catch defensivo por si OpenAI devuelve texto inesperado
        try {
            return JSON.parse(rawText);
        } catch (parseErr) {
            logger.warn('callAIWorker: JSON.parse falló, intentando extractJSON', { preview: rawText.substring(0, 100) });
            const extracted = extractJSON(rawText);
            if (extracted) {
                try { return JSON.parse(extracted); } catch { /* nada */ }
            }
            return null;
        }
    } catch (err) {
        logger.error('callAIWorker falló', err);
        return null;
    }
}

// Llamada directa a la IA con timeout — sin cola, cada usuario va directo
async function callAI(userMsg, retries = AI_RETRIES, externalSignal = null) {
    return Promise.race([
        callAIWorker(userMsg, retries, externalSignal),
        new Promise((resolve) => setTimeout(() => {
            logger.warn('Timeout en llamada IA', { query: userMsg });
            resolve(null);
        }, AI_CALL_TIMEOUT))
    ]);
}

const PORT = process.env.PORT || 3003;

// --- GESTIÓN UNIFICADA DE PERSISTENCIA ---

// Carga síncrona (Solo para el inicio del servidor)
function loadCacheSync() {
    try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
            const data = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
            const rawEntries = JSON.parse(data);

            const now = Date.now();
            let loaded = 0;
            rawEntries.forEach(([key, val]) => {
                if (val && val.persist) {
                    searchCache.set(key, val, { ttl: 0 }); // sin expiración para persistentes
                    loaded++;
                    return;
                }

                const hardCutoff = 1000 * 60 * 60 * 24; // 24h
                if (now - (val.timestamp || 0) < hardCutoff) {
                    const remainingTtl = Math.max(0, (val.ttl || SEARCH_CACHE_TTL) - (now - (val.timestamp || 0)));
                    searchCache.set(key, val, { ttl: remainingTtl || SEARCH_CACHE_TTL });
                    loaded++;
                }
            });

            logger.info('📂 Caché cargada desde disco (Sync)', { loaded });
        }
    } catch (err) {
        logger.error('Error cargando caché desde disco', err);
    }
}

// Guardado asíncrono (Para el intervalo periódico)
async function saveCacheAsync() {
    try {
        const data = JSON.stringify(Array.from(searchCache.entries()).map(([k, v]) => [k, v]));
        await fs.promises.writeFile(CACHE_FILE_PATH, data);
        logger.info('💾 Caché guardada (Async)', { entries: searchCache.size });
    } catch (e) {
        logger.error('Error en guardado periódico', e);
    }
}

// Guardado síncrono (Solo para emergencias/apagado)
function saveCacheSync() {
    try {
        const data = JSON.stringify(Array.from(searchCache.entries()).map(([k, v]) => [k, v]));
        fs.writeFileSync(CACHE_FILE_PATH, data);
        logger.info('💾 Caché guardada (Sync - Shutdown)', { entries: searchCache.size });
    } catch (e) {
        logger.error('Error guardando caché al cerrar', e);
    }
}

// --- HISTORIAL DE CONSULTAS PERSISTENTE ---
function generateQueryId() {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function loadQueryHistory() {
    try {
        if (fs.existsSync(QUERY_HISTORY_FILE)) {
            const data = fs.readFileSync(QUERY_HISTORY_FILE, 'utf8');
            queryHistory = JSON.parse(data);
            logger.info('📂 Historial de consultas cargado', { count: queryHistory.length });
        }
    } catch (err) {
        logger.error('Error cargando historial de consultas', err);
        queryHistory = [];
    }
}

async function saveQueryHistoryAsync() {
    try {
        await fs.promises.writeFile(QUERY_HISTORY_FILE, JSON.stringify(queryHistory, null, 2));
    } catch (err) {
        logger.error('Error guardando historial de consultas', err);
    }
}

// --- GUARDADO SEGURO CON DEBOUNCE ---
let historySaveTimeout = null;
function scheduleHistorySave() {
    if (historySaveTimeout) clearTimeout(historySaveTimeout);
    historySaveTimeout = setTimeout(async () => {
        try {
            await fs.promises.writeFile(QUERY_HISTORY_FILE, JSON.stringify(queryHistory, null, 2));
            logger.info('💾 Historial guardado (debounce)');
        } catch (e) {
            logger.error('Error IO guardando historial', e);
        } finally {
            historySaveTimeout = null;
        }
    }, 5000);
}

function saveQueryHistorySync() {
    // Cancelar debounce pendiente al hacer guardado síncrono (shutdown)
    if (historySaveTimeout) { clearTimeout(historySaveTimeout); historySaveTimeout = null; }
    try {
        fs.writeFileSync(QUERY_HISTORY_FILE, JSON.stringify(queryHistory, null, 2));
    } catch (err) {
        logger.error('Error guardando historial (sync)', err);
    }
}

// 1. Cargar caché de disco ANTES de iniciar nada
loadCacheSync();
loadQueryHistory();

// Máximo de consultas únicas en el historial
const MAX_QUERY_HISTORY = 2000;

// --- UTILIDAD: Calcular similitud entre dos textos (0.0 a 1.0) ---
function getSimilarityScore(s1, s2) {
    if (s1 === s2) return 1.0;

    // Si uno está completamente contenido dentro del otro (ej. "ranker" en "ranker dormido")
    if (s1.includes(s2) || s2.includes(s1)) return 0.85;

    // Distancia de Levenshtein rápida
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;

    const costs = [];
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) costs[j] = j;
            else if (j > 0) {
                let newValue = costs[j - 1];
                if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    return (longer.length - costs[shorter.length]) / parseFloat(longer.length);
}

// --- Registro de consultas: ranking, deduplicación y persistencia ---
function recordQuery(rawQuery, key, payload, req) {
    try {
        const qKey = key || cleanText(rawQuery || '');
        const resultCount = (payload && payload.series) ? payload.series.length : 0;
        const source = (payload && payload.source) || 'unknown';
        const ts = new Date().toISOString();
        const resultTitles = (payload && payload.series || []).slice(0, 5).map(s => s.title || s.id);

        // Asegurar que la entrada se persista en searchCache
        try {
            setCachedSearch(qKey, payload, undefined, true);
        } catch (e) {
            logger.warn('setCachedSearch falló en recordQuery', { error: e && e.message });
        }

        // Agrupamiento Fuzzy: buscar consulta similar (similitud > 0.8)
        // Limitar a los primeros 500 para evitar bloqueo en historial muy grande
        let bestMatchIdx = -1;
        let highestSim = 0;
        const historySlice = queryHistory.length > 500 ? queryHistory.slice(0, 500) : queryHistory;

        for (let i = 0; i < historySlice.length; i++) {
            if (!historySlice[i] || !historySlice[i].key) continue;
            const sim = getSimilarityScore(historySlice[i].key, qKey);
            if (sim > highestSim) {
                highestSim = sim;
                bestMatchIdx = i;
            }
        }

        if (highestSim > 0.8 && bestMatchIdx !== -1) {
            // --- CONSULTA SIMILAR ENCONTRADA: agrupar ---
            const existing = queryHistory[bestMatchIdx];

            // Mantener la llave más descriptiva/larga (ej. "ranker dormido" en vez de "ranker")
            if (qKey.length > existing.key.length) {
                existing.key = qKey;
                existing.query = rawQuery;
            }

            existing.count += 1;
            existing.lastSeen = ts;
            existing.lastResultCount = resultCount;
            existing.lastSource = source;
            existing.resultTitles = resultTitles;
            existing.explanation = (payload && payload.explanation) || existing.explanation;

            // El sort se hace bajo demanda en /api/popular y /api/queries, no aquí

            logger.info('🔍 Consulta agrupada (fuzzy)', {
                id: existing.id,
                query: rawQuery,
                matchedKey: existing.key,
                similarity: highestSim.toFixed(2),
                count: existing.count,
                source,
                resultCount,
                top5: resultTitles
            });
        } else {
            // --- CONSULTA NUEVA ---
            // Si ya alcanzamos el límite, eliminar la menos popular (última del array)
            let evicted = null;
            if (queryHistory.length >= MAX_QUERY_HISTORY) {
                evicted = queryHistory.pop(); // elimina la última (menos popular)
                logger.info('🗑️ Consulta menos popular eliminada por límite', {
                    id: evicted.id,
                    query: evicted.query,
                    count: evicted.count
                });
            }

            const newEntry = {
                id: generateQueryId(),
                query: rawQuery,
                key: qKey,
                count: 1,
                source,
                lastSource: source,
                lastResultCount: resultCount,
                explanation: (payload && payload.explanation) || '',
                resultTitles,
                firstSeen: ts,
                lastSeen: ts
            };

            // Insertar al inicio → rank 1 (las repetidas subirán por count)
            queryHistory.unshift(newEntry);

            logger.info('🔍 Nueva consulta registrada', {
                id: newEntry.id,
                query: rawQuery,
                rank: 1,
                total: queryHistory.length,
                source,
                resultCount,
                top5: resultTitles,
                evicted: evicted ? evicted.query : null
            });
        }

        // Persistir historial con debounce (agrupa escrituras concurrentes)
        scheduleHistorySave();
        saveCacheAsync().catch(err => logger.warn('saveCacheAsync falló tras recordQuery', { error: err && err.message }));
    } catch (err) {
        logger.error('recordQuery error', err && (err.message || err));
    }
}

// 2. Iniciar servidor con función startServer()
async function startServer() {
    // Pasar logger a módulos de DB y embeddings
    setDbLogger(logger);
    setEmbeddingsLogger(logger);

    // Inicializar PostgreSQL (no-crítico, solo log si falla)
    await initDB();

    // Descargar series (crítico, exit si falla)
    const cacheOk = await refreshCache();
    if (!cacheOk || !seriesCache || seriesCache.length === 0) {
        logger.error('CRITICO: No se pudieron descargar las series. Abortando.');
        process.exit(1);
    }

    server = app.listen(PORT, () => {
        logger.info('AI Middleware LISTO', {
            port: PORT,
            series: seriesCache.length,
            searchCache: searchCache.size,
            vectorSearch: dbAvailable() ? 'enabled' : 'disabled'
        });
    });

    // Si DB disponible y tabla vacía → sincronizar embeddings en background
    if (dbAvailable()) {
        const embeddingCount = await getSeriesEmbeddingCount();
        if (embeddingCount === 0) {
            logger.info('Tabla de embeddings vacia, iniciando sync en background...');
            syncEmbeddings(seriesCache).catch(err =>
                logger.warn('Embedding sync inicial fallo', { error: err.message })
            );
        } else {
            logger.info('Embeddings existentes en DB', { count: embeddingCount });
            // Sync incremental de series nuevas en background
            syncEmbeddings(seriesCache).catch(err =>
                logger.warn('Embedding sync incremental fallo', { error: err.message })
            );
        }
    }

    // Intervalos periódicos
    setInterval(() => { saveCacheAsync(); }, 10 * 60 * 1000); // Cache cada 10 min

    if (dbAvailable()) {
        setInterval(() => { dbHealthCheck(); }, 60 * 1000); // Health check DB cada 1 min
        setInterval(() => { cleanQueryCache(7); }, 24 * 60 * 60 * 1000); // Limpiar query cache cada 24h
    }
}

startServer().catch(err => {
    logger.error('Error fatal en inicializacion', err);
    process.exit(1);
});

// --- MANEJO DE CIERRE (GRACEFUL SHUTDOWN) ---
async function gracefulShutdown(signal) {
    logger.info(`${signal} recibido, cerrando servidor...`);
    saveCacheSync();
    saveQueryHistorySync();

    if (server) {
        server.close(() => {
            logger.info('Servidor cerrado correctamente');
            process.exit(0);
        });
        setTimeout(() => {
            logger.warn('Forzando cierre tras espera');
            process.exit(1);
        }, 5000);
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- NUEVA FUNCIÓN: getCachedSearchSmart ---
function getCachedSearchSmart(key) {
    const entry = searchCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const hardTTL = 1000 * 60 * 60 * 24; // 24 horas (Datos muy viejos, no usar)
    const softTTL = entry.ttl || SEARCH_CACHE_TTL; // Tiempo ideal (ej. 30 min)

    // Caso 1: Datos frescos -> Retornar
    if (now - entry.timestamp < softTTL) {
        return { data: entry.data, status: 'fresh' };
    }

    // Caso 2: Datos "rancios" pero usables -> Retornar y recargar en background
    if (now - entry.timestamp < hardTTL) {
        return { data: entry.data, status: 'stale' }; // El código principal debe detectar 'stale'
    }

    // Caso 3: Datos podridos -> Borrar
    return null;
}

const SYNONYMS = {
    // --- Diccionario de Sinónimos Ampliado ---
    'profesores': 'escolar',
    'estudiantes': 'escolar',
    'hechiceria': 'fantasia magia',
    'superpoderes': 'fantasia poder',
    'familia': 'drama',
    'amistad': 'drama',
    'viajes en el tiempo': 'regresion',
    'robots': 'ciencia ficcion',
    'ciencia ficcion': 'ciencia ficcion',
    'horror': 'terror',
    'batallas': 'accion pelea',
    'aventuras': 'aventura',
    'volver al pasado': 'regresion',
    'regreso': 'regresion',
    'magia': 'fantasia',
    'colegio': 'escolar',
    'escuela': 'escolar',
    'novios': 'romance',
    'amor': 'romance',
    'sustos': 'terror',
    'miedo': 'terror',
    'golpes': 'accion',
    'peleas': 'accion',
    // Fantasy sub-genres / clases de personaje
    'nigromante': 'necromancia nigromante muertos invocador oscuro no-muertos skeleton undead dark',
    'necromancia': 'nigromante necromancia muertos invocador oscuro no-muertos undead dark',
    'necromancer': 'nigromante necromancia muertos invocador oscuro undead dark',
    'invocador': 'invocacion nigromante necromancia',
    'druida': 'naturaleza magia fantasia',
    'asesino': 'asesino sombras sigilo oscuro',
    'vampiro': 'vampiro sangre oscuro terror no-muertos',
    'zombie': 'zombie no-muertos terror apocalipsis',
    'demonio': 'demonio oscuro infierno diablo',
    'cazador': 'hunter cazador dungeon mazmorra',
    'dungeon': 'mazmorra dungeon tower',
    'mazmorra': 'mazmorra dungeon tower',
    'torre': 'tower torre escalada',
    'cultivacion': 'cultivation murim artes marciales qi',
    'op': 'overpowered fuerte poderoso op protagonista fuerte',
    'overpowered': 'op fuerte poderoso overpowered',
    'isekai': 'reencarnacion otro mundo transmigration isekai',
    'transmigrar': 'reencarnacion transmigration isekai otro mundo',
    'guild': 'gremio guild aventurero',
    'gremio': 'guild gremio aventurero'
};

function enrichQuery(text) {
    let enriched = text;
    Object.keys(SYNONYMS).forEach(key => {
        if (text.includes(key)) {
            enriched += ' ' + SYNONYMS[key];
        }
    });
    return enriched;
}

// Nuevo: Función para limpiar el texto de entrada eliminando palabras irrelevantes (stopwords)
// Stopwords MUY conservadoras: solo palabras que NUNCA aportan contexto de búsqueda
const STOP_WORDS_ES = new Set([
    'hola', 'hey', 'buenas', 'oye', 'porfa', 'porfavor', 'por', 'favor',
    'bro', 'amigo', 'mano', 'wey', 'compa',
    'recomendacion', 'recomendame', 'recomiendame',
    'dame', 'dime', 'necesito', 'quiero', 'busco',
    'puedes', 'podrias', 'seria', 'gracias', 'thanks',
    'los', 'las', 'unos', 'unas', 'del', 'al'
]);

function cleanInputForAI(text) {
    // Preservar palabras con contexto semántico (que, es, un, con, de, etc.)
    // Solo eliminar saludos/cortesías puras y palabras de 1 carácter
    return text.toLowerCase()
        .split(/\s+/)
        .filter(word => !STOP_WORDS_ES.has(word) && word.length > 1)
        .join(' ');
}

// Ejemplo de uso:
// const cleanMsg = cleanInputForAI(userMsg);
// Input original: "Hola bro busco un manhwa de accion por favor"
// Input a la IA: "manhwa accion"

// --- GENERADOR DE EXPLICACIONES PARA VECTOR SEARCH ---
function buildVectorExplanation(userMsg, topResults) {
    const parts = [];

    // Detectar qué aspectos de la query matchearon con los resultados
    const queryClean = cleanText(userMsg);
    const queryWords = queryClean.split(/\s+/).filter(w => w.length > 2);

    // Recolectar géneros, temas y tropos que aparecen en los top resultados
    const matchedGenres = new Set();
    const matchedThemes = new Set();
    const matchedTropes = new Set();
    const matchedProta = new Set();

    for (const r of topResults) {
        const s = r.item;

        // Géneros que coinciden con la query
        (s._searchGenres || []).forEach(g => {
            if (queryWords.some(w => g.includes(w))) matchedGenres.add(g);
        });

        // Temas
        (s.themes || []).forEach(t => {
            const tc = cleanText(t);
            if (queryWords.some(w => tc.includes(w))) matchedThemes.add(t);
        });

        // Tropos
        (s.narrativeTropes || []).forEach(t => {
            const tc = cleanText(t);
            if (queryWords.some(w => tc.includes(w))) matchedTropes.add(t);
        });

        // Tipo de protagonista
        if (s.protagonistType) {
            const pc = cleanText(s.protagonistType);
            if (queryWords.some(w => pc.includes(w))) matchedProta.add(s.protagonistType);
        }
    }

    // Construir explicación
    if (matchedGenres.size > 0) {
        parts.push(`Géneros: ${[...matchedGenres].slice(0, 3).join(', ')}`);
    }
    if (matchedThemes.size > 0) {
        parts.push(`Temas: ${[...matchedThemes].slice(0, 3).join(', ')}`);
    }
    if (matchedTropes.size > 0) {
        parts.push(`Tropos: ${[...matchedTropes].slice(0, 3).join(', ')}`);
    }
    if (matchedProta.size > 0) {
        parts.push(`Protagonista: ${[...matchedProta].slice(0, 2).join(', ')}`);
    }

    if (parts.length > 0) {
        return `Búsqueda semántica para "${userMsg}". Coincidencias: ${parts.join(' | ')}`;
    }

    return `Búsqueda semántica para "${userMsg}". Resultados basados en similitud de sinopsis, temas y metadata.`;
}

// --- ENDPOINT PRINCIPAL: /api/read ---
app.post('/api/read', aiLimiter, async (req, res) => {
    const startTime = Date.now();
    metrics.totalSearches++;

    // Helper para responder una sola vez (evita double-send)
    let responded = false;
    const safeJson = (status, body) => {
        if (responded || res.headersSent) return;
        responded = true;
        res.status(status).json(body);
    };

    // Crear un controlador de aborto asociado a ESTA petición del usuario
    const userRequestController = new AbortController();

    // Si el usuario cierra la pestaña o cancela, abortamos la llamada a la IA
    req.on('close', () => {
        if (!res.writableEnded) {
            logger.info('Cliente cerró la conexión prematuramente');
            userRequestController.abort();
        }
    });

    try {
        // Validar Content-Type
        const ct = req.headers['content-type'] || '';
        if (!ct.includes('application/json')) {
            return safeJson(415, { success: false, error: 'Content-Type debe ser application/json' });
        }

        // Validar que el servidor tenga datos antes de atender búsquedas
        if (!seriesCache || seriesCache.length === 0) {
            return safeJson(503, { success: false, error: 'El catálogo aún no está disponible. Intenta en unos segundos.' });
        }

        const messages = req.body?.messages;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return safeJson(400, { success: false, error: 'Se requiere el campo messages' });
        }

        const userMsg = messages[messages.length - 1]?.content;
        if (!userMsg || typeof userMsg !== 'string' || userMsg.trim().length === 0) {
            return safeJson(400, { success: false, error: 'Mensaje vacío' });
        }

        const cleanMsg = cleanText(userMsg);
        // Si el cliente envía este header, no registrar en historial ni caché de queries
        const skipHistory = req.headers['x-skip-history'] === 'true';

        // 0. Detectar saludos y mensajes sin contenido de búsqueda
        const greetings = /^(hola+|hey+|buenas?|hi+|hello+|que tal|saludos?|ey+|holaa*|oye+|wena+s?|sup|yo+|buenos? dias?|buenas? tardes?|buenas? noches?|que puedes hacer|que haces|que sabes hacer|para que sirves|que ofreces|como te uso|como funciona(s|esto)?|ayuda|help|como busco|que es esto|quien eres|que eres|como va|que onda|que hay|holi+|holis|jelou+|helo+|alo+|namaste|ohayo+|konichiwa)\s*[.!?,]*$/i;
        if (greetings.test(cleanMsg)) {
            return safeJson(200, {
                success: true,
                explanation: '¡Hola! Soy el asistente de búsqueda de Manhwa Imperial. Puedes preguntarme cosas como:\n• "Manhwas de acción con protagonista OP"\n• "Solo Leveling"\n• "Recomendaciones de romance escolar"\n• "Manhwas similares a Tower of God"',
                series: [],
                source: 'greeting'
            });
        }

        // 1. Revisar caché
        const cached = getCachedSearchSmart(cleanMsg);
        if (cached && cached.status === 'fresh') {
            metrics.cacheHits++;
            // cached.data.series puede ser ya objetos completos o IDs (compatibilidad)
            const seriesField = cached.data.series || [];
            const fullSeries = seriesField.length > 0 && (typeof seriesField[0] === 'object')
                ? seriesField
                : seriesField.map(id => seriesCache.find(s => s.id === id)).filter(Boolean);

            logger.info('Cache HIT (fresh)', { query: cleanMsg });
            const payload = { ...cached.data, series: sanitizeSeriesForResponse(fullSeries) };
            // Registrar la consulta y su resultado
            if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
            return safeJson(200, payload);
        }

        // 2. BÚSQUEDA LOCAL: solo para matches de título exacto/subcadena
        const localResults = performFallbackSearch(userMsg);

        // Solo retornar local si es un match de título exacto (source 'exact' o 'alt_title')
        // Esto cubre búsquedas como "Solo Leveling", "Omniscient Reader" etc.
        if (localResults.length > 0 && localResults[0].score <= 0.15
            && (localResults[0].source === 'exact' || localResults[0].source === 'alt_title')) {
            metrics.fallbackSearches++;
            const seriesItems = localResults.slice(0, 40).map(r => r.item);
            const payload = {
                success: true,
                explanation: `Resultados directos para "${userMsg}"`,
                series: sanitizeSeriesForResponse(seriesItems),
                source: 'local_db_priority'
            };
            setCachedSearch(cleanMsg, payload);
            if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
            logger.info('Match de titulo exacto', { query: userMsg, results: seriesItems.length, bestScore: localResults[0].score.toFixed(3) });
            return safeJson(200, payload);
        }

        // 3. Si hay negación → ruta directa a Chat Completions AI
        const hasNegationEarly = detectNegative(userMsg);

        // 4. VECTOR SEARCH: método primario para queries semánticas
        if (!hasNegationEarly && dbAvailable()) {
            const vectorResults = await performVectorSearch(userMsg);
            if (vectorResults && vectorResults.length > 0) {
                const seriesItems = vectorResults.slice(0, 40).map(r => r.item);
                const payload = {
                    success: true,
                    explanation: `Resultados semánticos para "${userMsg}"`,
                    series: sanitizeSeriesForResponse(seriesItems),
                    source: 'vector',
                    topSimilarity: vectorResults[0]?.similarity?.toFixed(3)
                };
                setCachedSearch(cleanMsg, payload);
                if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
                logger.info('Vector search exitoso', {
                    query: userMsg,
                    results: seriesItems.length,
                    topSimilarity: vectorResults[0]?.similarity?.toFixed(3)
                });
                return safeJson(200, payload);
            }
        }

        // 5. FALLBACK: LLAMAR A LA IA (negaciones, vector no disponible, o sin resultados)
        metrics.aiCalls++;
        const cleanedInput = cleanInputForAI(userMsg);
        const enrichedInput = enrichQuery(cleanedInput);

        // Deduplicación de peticiones concurrentes (Promise Coalescing)
        let aiResult;
        if (inFlightRequests.has(enrichedInput)) {
            logger.info('Petición en vuelo detectada, esperando resultado compartido', { query: enrichedInput });
            aiResult = await inFlightRequests.get(enrichedInput);
        } else {
            const aiPromise = callAI(enrichedInput, AI_RETRIES, userRequestController.signal);
            inFlightRequests.set(enrichedInput, aiPromise);
            try {
                aiResult = await aiPromise;
            } finally {
                inFlightRequests.delete(enrichedInput);
            }
        }

        if (!aiResult || !aiResult.filter) {
            // Fallback: búsqueda con query enriquecido (sinónimos aplicados)
            let fallbackRaw = performFallbackSearch(enrichedInput).slice(0, 40);
            // Si el enriquecido no dio resultados, intentar con el original
            if (fallbackRaw.length === 0) {
                fallbackRaw = performFallbackSearch(userMsg).slice(0, 40);
            }
            const fallback = fallbackRaw.map(r => r.item);
            metrics.fallbackSearches++;
            const payload = {
                success: true,
                explanation: fallback.length > 0
                    ? `Encontré estos resultados para "${userMsg}"`
                    : `No encontré resultados para "${userMsg}". Intenta describir lo que buscas de otra forma.`,
                series: sanitizeSeriesForResponse(fallback),
                source: 'fallback'
            };
            // Registrar consulta y resultado (fallback)
            if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
            return safeJson(200, payload);
        }

        // 4. Filtrar series según la respuesta de la IA
        let filtered = [...seriesCache];
        const filter = aiResult.filter;
        const hasNegation = detectNegative(userMsg);

        // Filtrar por géneros
        if (filter.genres && filter.genres.length > 0) {
            const requestedGenres = filter.genres.map(g => cleanText(g));

            if (hasNegation && filter.exclude_terms && filter.exclude_terms.length > 0) {
                const excludeGenres = filter.exclude_terms.map(g => cleanText(g));
                filtered = filtered.filter(s => {
                    const seriesGenres = s._searchGenres || [];
                    const hasWanted = requestedGenres.some(rg => seriesGenres.some(sg => sg.includes(rg)));
                    const hasExcluded = excludeGenres.some(eg => seriesGenres.some(sg => sg.includes(eg)));
                    return hasWanted && !hasExcluded;
                });
            } else {
                filtered = filtered.filter(s => {
                    const seriesGenres = s._searchGenres || [];
                    return requestedGenres.some(rg => seriesGenres.some(sg => sg.includes(rg)));
                });
            }
        }

        // Búsqueda semántica en texto completo
        if (filter.search_semantic && filter.search_semantic !== 'keywords' && filter.search_semantic !== 'palabras clave') {
            const keywords = cleanText(filter.search_semantic).split(/\s+/).filter(w => w.length > 2);
            if (keywords.length > 0) {
                // Si ya filtramos por género, usar semántica como boost (no filtro estricto)
                if (filter.genres && filter.genres.length > 0) {
                    // Ordenar por relevancia semántica en vez de filtrar
                    filtered.sort((a, b) => {
                        const textA = a._fullText || '';
                        const textB = b._fullText || '';
                        const matchA = keywords.filter(kw => textA.includes(kw)).length;
                        const matchB = keywords.filter(kw => textB.includes(kw)).length;
                        return matchB - matchA;
                    });
                } else {
                    // Sin filtro de género, usar semántica como filtro
                    filtered = filtered.filter(s => {
                        const text = s._fullText || '';
                        return keywords.some(kw => text.includes(kw));
                    });
                }
            }
        }

        // Excluir términos (siempre aplicar si hay exclude_terms)
        if (filter.exclude_terms && filter.exclude_terms.length > 0) {
            const excludeTerms = filter.exclude_terms.map(t => cleanText(t));
            filtered = filtered.filter(s => {
                const seriesGenres = s._searchGenres || [];
                // Excluir si el género coincide
                const genreExcluded = excludeTerms.some(et => seriesGenres.some(sg => sg.includes(et)));
                return !genreExcluded;
            });
        }

        // Ordenar por relevancia: primero calcular score de coincidencia con la query
        const queryKeywords = cleanText(userMsg).split(/\s+/).filter(w => w.length > 2);
        const allFilterKeywords = [
            ...(filter.genres || []).map(g => cleanText(g)),
            ...(filter.search_semantic ? cleanText(filter.search_semantic).split(/\s+/).filter(w => w.length > 2) : []),
        ];
        const scoringKeywords = [...new Set([...queryKeywords, ...allFilterKeywords])];

        if (scoringKeywords.length > 0) {
            filtered = filtered.map(s => {
                let relevanceScore = 0;
                const fullText = s._fullText || '';
                const genres = s._searchGenres || [];
                const title = s._searchTitle || '';

                // Mayor peso: coincidencia en título
                const titleMatches = scoringKeywords.filter(kw => title.includes(kw)).length;
                relevanceScore += titleMatches * 3;

                // Peso medio: coincidencia en géneros
                const genreMatches = scoringKeywords.filter(kw => genres.some(g => g.includes(kw))).length;
                relevanceScore += genreMatches * 2;

                // Peso base: coincidencia en texto completo (sinopsis, temas, tropos)
                const textMatches = scoringKeywords.filter(kw => fullText.includes(kw)).length;
                relevanceScore += textMatches;

                // Bonus por popularidad para desempatar
                if (s._rating >= 4.5) relevanceScore += 0.5;
                if (s._weeklyViews > 10000) relevanceScore += 0.3;

                s._relevanceScore = relevanceScore;
                return s;
            });

            // Ordenar por relevancia descendente (más relevante primero)
            filtered.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));
        }

        // Ordenamiento secundario si la IA lo pide (se aplica como desempate dentro de misma relevancia)
        if (aiResult.sort) {
            const sortField = cleanText(aiResult.sort);
            // Agrupar por relevancia similar (mismo entero) y dentro del grupo ordenar por el criterio IA
            filtered.sort((a, b) => {
                const relA = Math.floor(a._relevanceScore || 0);
                const relB = Math.floor(b._relevanceScore || 0);
                if (relB !== relA) return relB - relA; // Primero por relevancia
                if (sortField.includes('rating')) return (b._rating || 0) - (a._rating || 0);
                if (sortField.includes('view')) return (b._views || 0) - (a._views || 0);
                if (sortField.includes('year') || sortField.includes('reciente') || sortField.includes('nuevo')) return (b._year || 0) - (a._year || 0);
                return 0;
            });
        }

        // Limitar resultados
        const results = filtered.slice(0, 40);

        // Si no hay resultados filtrados, fallback
        if (results.length === 0) {
            const fallback = performFallbackSearch(userMsg).slice(0, 40).map(r => r.item);
            const payload = {
                success: true,
                explanation: aiResult.reason || `Resultados para "${userMsg}"`,
                series: sanitizeSeriesForResponse(fallback),
                appliedFilter: aiResult,
                source: 'fallback_after_filter'
            };
            // Registrar consulta y resultado (fallback después del filtro IA)
            if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
            return safeJson(200, payload);
        }

        const payload = {
            success: true,
            explanation: aiResult.reason || `Resultados para "${userMsg}"`,
            series: sanitizeSeriesForResponse(results),
            appliedFilter: aiResult,
            source: 'ai'
        };

        // Guardar en caché
        setCachedSearch(cleanMsg, payload);

        // Estadísticas
        const count = searchStats.get(cleanMsg) || { count: 0 };
        searchStats.set(cleanMsg, { count: count.count + 1, lastUsed: Date.now() });

        // Métricas de tiempo
        const elapsed = Date.now() - startTime;
        metrics.responseTimesSum += elapsed;
        metrics.responseTimesCount++;
        metrics.avgResponseTime = Math.round(metrics.responseTimesSum / metrics.responseTimesCount);

        logger.info('Búsqueda IA completada', { query: userMsg, results: results.length, elapsed, aiFilter: JSON.stringify(aiResult) });

        // Si había caché stale, refrescar en background
        if (cached && cached.status === 'stale') {
            // Ya se está devolviendo resultado fresco de IA, no hace falta nada más
        }

        // Registrar consulta y resultado (IA)
        if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
        return safeJson(200, payload);

    } catch (err) {
        logger.error('Error en /api/read', err);
        safeJson(500, { success: false, error: 'Error interno del servidor' });
    }
});
