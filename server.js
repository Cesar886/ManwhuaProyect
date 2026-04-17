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
const { Server } = require("socket.io");
const http = require('http');
const { initDB, dbAvailable, healthCheck: dbHealthCheck, setLogger: setDbLogger, getSeriesEmbeddingCount, cleanQueryCache } = require('./db');
const { buildEmbeddingText, getQueryEmbedding, getEmbeddings, upsertSeriesEmbedding, vectorSearch, getCachedQueryEmbedding, cacheQueryEmbedding, syncEmbeddings, setLogger: setEmbeddingsLogger } = require('./embeddings');

const app = express();
const server = http.createServer(app);
// Socket.IO disponible para futuro uso (requiere config Nginx WebSocket)
// const io = new Server(server, { ... });
let fuse; // Declarar variable global faltante

// Mapa de peticiones a la IA que están actualmente en proceso (Promise Coalescing)
const inFlightRequests = new Map();

// Archivos donde guardaremos la "memoria" de payloads IA, SEPARADOS POR IDIOMA.
// Cada entrada se guarda en el archivo cuyo prefijo coincide con la clave
// (cacheKey(lang, key) → "es:..." o "en:..."). Así un payload ES nunca se
// mezcla con uno EN, ni siquiera en disco.
const CACHE_FILE_PATH_LEGACY = path.join(__dirname, 'ai_search_cache.json'); // legacy (pre-split)
const CACHE_FILES = {
    es: path.join(__dirname, 'ai_search_cache_es.json'),
    en: path.join(__dirname, 'ai_search_cache_en.json'),
};

// Archivos donde guardaremos el historial de consultas, SEPARADO POR IDIOMA.
// Las queries hechas desde /en se guardan en un archivo distinto al de /es
// para que nunca se mezclen en suggestions, populares, tendencias, related,
// after-search, etc.
const QUERY_HISTORY_FILE_LEGACY = path.join(__dirname, 'query_history.json'); // legacy (pre-i18n)
const QUERY_HISTORY_FILES = {
    es: path.join(__dirname, 'query_history_es.json'),
    en: path.join(__dirname, 'query_history_en.json'),
};
const SUPPORTED_LANGS = Object.freeze(['es', 'en']);
const DEFAULT_LANG = 'es';
const queryHistoryByLang = { es: [], en: [] };

// Normaliza el idioma. Solo acepta valores de SUPPORTED_LANGS; cualquier otra cosa → default.
// Tolera prefijos tipo "en-US", "es_MX", "es-419", espacios y mayúsculas.
function normalizeLang(value) {
    if (value == null) return DEFAULT_LANG;
    let raw;
    try { raw = String(value).toLowerCase().trim(); }
    catch { return DEFAULT_LANG; }
    if (!raw) return DEFAULT_LANG;
    // Tomar solo la porción primaria del tag (es, en) ignorando región
    const primary = raw.split(/[-_;,\s]/)[0];
    return SUPPORTED_LANGS.includes(primary) ? primary : DEFAULT_LANG;
}

// Heurística ligera para detectar idioma por contenido. Devuelve 'es', 'en' o null si no es claro.
// Solo para detectar señales MUY obvias (palabras funcionales exclusivas de un idioma).
const EN_SIGNAL_RE = /\b(the|with|about|looking|recommend|where|similar to|reincarnat|revenge|system|hunter|tower|dungeon|female|male lead|want|need|please|find me|isekai)\b/i;
const ES_SIGNAL_RE = /\b(el|la|los|las|con|sobre|buscando|recomienda|donde|similar a|reencarna|venganza|sistema|cazador|torre|mazmorra|chica|protagonista|quiero|necesito|por favor|busca|enseñ|parecid)\b/i;
function inferLangFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.toLowerCase();
    const en = EN_SIGNAL_RE.test(t);
    const es = ES_SIGNAL_RE.test(t);
    if (en && !es) return 'en';
    if (es && !en) return 'es';
    return null;
}

// Extrae el idioma del request con múltiples fallbacks:
//   1) ?lang=en|es (explícito)
//   2) header X-Lang / X-Language (explícito del frontend)
//   3) body.lang (POST JSON)
//   4) Referer: si el path empieza con /en o /en/… → en
//   5) Accept-Language (primera preferencia del navegador)
//   6) Default ('es')
function getRequestLang(req) {
    if (!req) return DEFAULT_LANG;

    try {
        const q = req.query && req.query.lang;
        if (q) return normalizeLang(q);

        const h = req.headers || {};
        const hdrLang = h['x-lang'] || h['x-language'];
        if (hdrLang) return normalizeLang(hdrLang);

        const bodyLang = req.body && req.body.lang;
        if (bodyLang) return normalizeLang(bodyLang);

        // Referer: detectar /en o /es como primer segmento de la URL
        const referer = h.referer || h.referrer;
        if (referer) {
            try {
                const u = new URL(referer);
                const seg = (u.pathname || '/').split('/').filter(Boolean)[0] || '';
                if (seg === 'en') return 'en';
                if (seg === 'es') return 'es';
            } catch { /* referer malformado: ignorar */ }
        }

        // Accept-Language: "en-US,en;q=0.9,es;q=0.8" → primera preferencia
        const al = h['accept-language'];
        if (al && typeof al === 'string') {
            const first = al.split(',')[0];
            if (first) {
                const norm = normalizeLang(first);
                if (norm) return norm;
            }
        }
    } catch (err) {
        // Cualquier error en la detección no debe tirar el request
        if (typeof logger !== 'undefined' && logger) {
            logger.warn('getRequestLang falló, usando default', { error: err && err.message });
        }
    }

    return DEFAULT_LANG;
}

// Accesores por idioma (siempre normalizan)
function H(lang) {
    const L = normalizeLang(lang);
    if (!Array.isArray(queryHistoryByLang[L])) queryHistoryByLang[L] = [];
    return queryHistoryByLang[L];
}
function setH(lang, arr) {
    const L = normalizeLang(lang);
    queryHistoryByLang[L] = Array.isArray(arr) ? arr : [];
}

// Clave de caché scoping por idioma: evita que el payload IA generado para /es
// (con explanation en español) se sirva a un usuario de /en y viceversa.
function cacheKey(lang, key) {
    return `${normalizeLang(lang)}:${key}`;
}

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Skip-History', 'X-Search-Context', 'X-Device-Id', 'X-Lang', 'X-Language'],
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

// --- DETECTOR DE CONSULTAS SIMPLES (VERSIÓN EXPANDIDA, POR IDIOMA) ---
// Raíces de palabras que OBLIGAN a usar la IA (se buscan como subcadena).
// Las listas ES siguen intactas y se añade su contraparte EN.
const TRIGGER_ROOTS_BY_LANG = {
    es: [
        // 1. INTENCIÓN Y PREGUNTAS
        'trata', 'donde', 'busca', 'recomend', 'dame', 'similar', 'parecid',
        'mejor', 'top', 'sugier', 'dime', 'cual', 'quiero', 'necesit', 'lista',
        'leer', 'busco', 'algun', 'enseñ', 'gust', 'encant', 'tipo', 'vibr', 'estilo',
        // 2. TÉRMINOS DEL MEDIO
        'manhwa', 'webtoon', 'manga', 'manhua', 'comic', 'histori',
        'shonen', 'shounen', 'seinen', 'shoujo', 'josei', 'genero',
        // 3. GÉNEROS
        'accion', 'aventur', 'comedi', 'fantasi', 'romanc', 'terror', 'misteri',
        'escolar', 'ciencia', 'ficcion', 'harem', 'murim', 'drama', 'suspens',
        'psicologic', 'vida', 'slice',
        // 4. ARQUETIPOS
        'prota', 'heroe', 'villan', 'antihero', 'asesin', 'nigromant', 'necromanc',
        'invocad', 'demoni', 'vampir', 'zombie', 'no-muert', 'druida', 'cazador',
        'hunter', 'jugador', 'player', 'dios', 'constelac', 'besti', 'dragon',
        'duqu', 'emper', 'tiran', 'princes', 'rey', 'realez', 'noble', 'ceo', 'jef',
        // 5. TROPOS ACCIÓN
        'sistem', 'nivel', 'artes marcial', 'cultiv', 'tower', 'torre', 'dungeon',
        'mazmorra', 'portal', 'gremi', 'rango', 'rank', 'apocalip', 'superviv',
        'espad', 'magi', 'pelea', 'golpe', 'sangr', 'gore', 'matar', 'muert',
        // 6. TROPOS ROMANCE
        'amor', 'contrat', 'matrimon', 'casamient', 'divorci', 'infidel', 'engañ',
        'gemel', 'fals', 'celos', 'oficin', 'espos', 'marid', 'embaraz',
        // 7. DESARROLLO
        'reencarn', 'reencar', 'regres', 'volver', 'pasado', 'venganz', 'traicion',
        'abandon', 'isekai', 'reencarnac', 'reencarnad',
        // 8. ADJETIVOS / VIBES
        'poder', 'fuerte', 'debil', 'op', 'chetad', 'rot', 'invencibl', 'badass',
        'despiadad', 'fri', 'calculad', 'inteligent', 'tont', 'inutil', 'basur',
        'epico', 'llorar', 'trist', 'feliz', 'gracios', 'divertid', 'adult', 'madur',
        'lento', 'rapido', 'desarrollo'
    ],
    en: [
        // Intent / questions
        'about', 'where', 'search', 'recommend', 'give me', 'similar', 'like',
        'best', 'top', 'suggest', 'tell me', 'which', 'want', 'need', 'list',
        'read', 'looking', 'any', 'show', 'love', 'enjoy', 'kind of', 'vibe', 'style', 'find',
        // Medium
        'manhwa', 'webtoon', 'manga', 'manhua', 'comic', 'story',
        'shonen', 'shounen', 'seinen', 'shoujo', 'josei', 'genre',
        // Genres
        'action', 'adventur', 'comed', 'fantas', 'romanc', 'horror', 'myster',
        'school', 'sci-fi', 'science fiction', 'harem', 'murim', 'drama', 'suspens',
        'psycholog', 'slice of life',
        // Archetypes
        'protagonist', 'hero', 'villain', 'antihero', 'assassin', 'necromanc',
        'summoner', 'demon', 'vampir', 'zombie', 'undead', 'druid', 'hunter',
        'player', 'god', 'constellation', 'beast', 'dragon',
        'duke', 'emperor', 'tyrant', 'princess', 'king', 'royal', 'noble', 'ceo', 'boss',
        // Action tropes
        'system', 'level', 'martial art', 'cultivat', 'tower', 'dungeon',
        'portal', 'guild', 'rank', 'apocalyps', 'survival',
        'sword', 'magic', 'fight', 'gore', 'kill', 'death',
        // Romance tropes
        'love', 'contract', 'marriage', 'wedding', 'divorce', 'cheat',
        'twin', 'fake', 'jealous', 'office', 'wife', 'husband', 'pregnan',
        // Plot
        'reincarnat', 'regress', 'return', 'past', 'revenge', 'betray',
        'abandon', 'isekai',
        // Adjectives
        'power', 'strong', 'weak', 'op', 'overpowered', 'broken', 'invincibl', 'badass',
        'ruthless', 'cold', 'calculat', 'smart', 'dumb', 'useless', 'trash',
        'epic', 'cry', 'sad', 'happy', 'funny', 'adult', 'mature',
        'slow', 'fast', 'development'
    ]
};
const INTENT_ROOTS_BY_LANG = {
    es: ['trata', 'donde', 'busca', 'recomend', 'dame', 'similar', 'parecid', 'mejor', 'top', 'sugier', 'dime', 'cual', 'quiero', 'necesit', 'busco', 'enseñ'],
    en: ['about', 'where', 'search', 'recommend', 'give me', 'similar', 'like', 'best', 'top', 'suggest', 'tell me', 'which', 'want', 'need', 'looking', 'show', 'find']
};
// Retrocompatibilidad: export del array ES por si algo externo lo importa
const TRIGGER_ROOTS = TRIGGER_ROOTS_BY_LANG.es;

function isSimpleQuery(msg, lang = DEFAULT_LANG) {
    if (!msg || typeof msg !== 'string') return false;
    const lowerMsg = normalizeQuery(msg);
    const L = normalizeLang(lang);

    // Chequear primero la lista del idioma del request, pero también la del otro
    // idioma como red de seguridad (un usuario en /en puede escribir en ES y viceversa).
    const primary = INTENT_ROOTS_BY_LANG[L] || INTENT_ROOTS_BY_LANG[DEFAULT_LANG];
    const secondary = L === 'en' ? INTENT_ROOTS_BY_LANG.es : INTENT_ROOTS_BY_LANG.en;
    if (primary.some(root => lowerMsg.includes(root))) return false;
    if (secondary.some(root => lowerMsg.includes(root))) return false;

    return true;
}

// --- DETECTOR DE NEGACIONES POR IDIOMA ---
const NEGATION_PATTERNS_BY_LANG = {
    es: [
        /\b(no|sin|menos|excepto|evitar|diferente|distinto|nada)\b/i,
        /que\s+(no|nunca)\s+/i,
        /nada\s+de\b/i,
        /diferente(s)?\s+(a|de)\b/i
    ],
    en: [
        /\b(no|not|without|except|avoid|exclude|don't|dont|doesn't|doesnt|none|never|anything but)\b/i,
        /\b(other than|different from|apart from|aside from)\b/i,
        /\bnothing\s+(like|with|about)\b/i
    ]
};
function detectNegative(msg, lang = DEFAULT_LANG) {
    if (!msg || typeof msg !== 'string') return false;
    const lowerMsg = normalizeQuery(msg);
    const L = normalizeLang(lang);
    // Siempre chequear ambos sets: negación en el idioma "incorrecto" también cuenta
    const patterns = [
        ...(NEGATION_PATTERNS_BY_LANG[L] || []),
        ...(NEGATION_PATTERNS_BY_LANG[L === 'en' ? 'es' : 'en'] || [])
    ];
    return patterns.some(p => p.test(lowerMsg));
}

// --- DETECCIÓN NSFW (module scope, asume texto normalizado por cleanText) ---
// Mezcla bilingüe ES+EN, ampliada con jerga común EN y variantes de hentai.
const NSFW_SERVER_PATTERNS = [
    // Hentai / doujin / adult comic variants
    /\b(hentai|h-?entai|hntai|ecchi|pornhwa|pornhua|smut|lewd|doujin(shi)?|r-?18|r18)\b/,
    // Erotic
    /\b(erotic[oa]?s?|erotico|erotica)\b/,
    // Sex acts (ES)
    /\b(sexo|sexuales?|follar|coj[eio](r|n|ndo)?|cojiend[oa]|fornicar|culiar|tirar)\b/,
    // Sex acts (EN)
    /\b(fuck(ing|ed)?|fucks?|sex|sexual|banging|screwing|hookup|horny|aroused)\b/,
    // Body parts (ES)
    /\b(tetas|pechos?|senos|nalgas|trasero|vagina|pene|polla|verga|pija|coño|concha)\b/,
    // Body parts (EN)
    /\b(tits|titties|boobs?|breasts?|ass(hole)?|butt|pussy|cock|dick|penis|vulva)\b/,
    // Nudity
    /\b(desnud[oa]s?|nudes?|naked|xxx|nsfw|lewd)\b/,
    // Group sex
    /\b(orgias?|orgy|orgies|trio\s+sexual|threesome|foursome|gangbang|bukak+e)\b/,
    // Masturbation / oral
    /\b(masturb\w*|pajea\w*|jerk(ing)?\s*off|handjob|hand-job|blowjob|blow-job|mamada|felacion|fellatio|cunnilingus|rimjob)\b/,
    // Non-consensual
    /\b(violacion(es)?|violar|rape|rap(ing|ed)|non-?con|dubcon)\b/,
    // NTR / cuckold
    /\b(ntr|netorare|netori|cuckold|cuck)\b/,
    // BDSM
    /\b(bondage|bdsm|sado(maso)?|sadism|masochis[tm])\b/,
    // Problematic
    /\b(incest[uo]\w*|incest|milf|dilf|gilf|loli(con)?|shota(con)?|pedo)\b/,
    // Futa / trans erotic
    /\b(futanari|futa)\b/,
    // Fluids
    /\b(creampie|cumshot|semen|cum(ming)?|eyacul\w*|ejacul\w*)\b/,
    // Porn
    /\b(porno?|pornography|porno?graphic)\b/,
    // ES phrases
    /\bescenas?\s+(?:de\s+)?(sexo|sexuales?|cama|calientes?|explicitas?)\b/,
    /\bsubid[oa]s?\s+de\s+tono\b/,
    /\bcontenido\s+adulto\b/,
    /\bpara\s+adultos\b/,
    // EN phrases
    /\bsex\s+scenes?\b/,
    /\bexplicit\s+(content|scenes?)\b/,
    /\badult\s+content\b/,
    /\bmature\s+content\b/,
    /\bfor\s+adults\b/,
    // +18 markers
    /\+\s*18\b|\b18\s*\+/,
];
const NSFW_REDIRECT_BY_LANG = {
    es: 'Este tipo de búsqueda pertenece a la sección +18. Usa el buscador en /nsfw para encontrar contenido adulto.',
    en: 'This type of search belongs to the +18 section. Use the /nsfw search to find adult content.'
};
function getNsfwRedirectResponse(lang) {
    const L = normalizeLang(lang);
    return {
        success: true,
        explanation: NSFW_REDIRECT_BY_LANG[L] || NSFW_REDIRECT_BY_LANG[DEFAULT_LANG],
        series: [],
        source: 'nsfw_redirect',
        lang: L
    };
}
// Retrocompat por si algo externo referencia el objeto
const NSFW_REDIRECT_RESPONSE = getNsfwRedirectResponse(DEFAULT_LANG);

// --- GREETINGS POR IDIOMA ---
// Se evalúa contra cleanText(msg): lowercase, sin diacríticos.
const GREETING_REGEX_BY_LANG = {
    es: /^(hola+|hey+|buenas?|buenos\s+dias|buenas\s+tardes|buenas\s+noches|oye+|porfa|porfavor|por\s+favor|bro|amigo|mano|wey|compa|recomendacion|recomendame|recomiendame|dame|dime|necesito|quiero|busco|puedes|podrias|seria|gracias|los|las|unos|unas|del|al)\b/i,
    en: /^(hi+|hello+|hey+|yo+|sup|howdy|good\s+(morning|afternoon|evening|night)|please|pls|plz|bro|dude|mate|thanks|thank\s+you|ty|thx|recommendation|recommend\s+me|give\s+me|tell\s+me|i\s+(want|need|am\s+looking)|can\s+you|could\s+you|would\s+you)\b/i
};
const GREETING_EXPLANATION_BY_LANG = {
    es: '¡Hola! Soy el asistente de búsqueda de Manhwa Imperial. Puedes preguntarme cosas como:\n• "Manhwas de acción con protagonista OP"\n• "Solo Leveling"\n• "Recomendaciones de romance escolar"\n• "Manhwas similares a Tower of God"',
    en: 'Hi! I\'m the Manhwa Imperial search assistant. You can ask me things like:\n• "Action manhwas with an OP protagonist"\n• "Solo Leveling"\n• "School romance recommendations"\n• "Manhwas similar to Tower of God"'
};
function isGreeting(cleanMsg, lang = DEFAULT_LANG) {
    const L = normalizeLang(lang);
    const primary = GREETING_REGEX_BY_LANG[L];
    if (primary && primary.test(cleanMsg)) return true;
    // Red de seguridad: también detectar saludo en el otro idioma
    const other = GREETING_REGEX_BY_LANG[L === 'en' ? 'es' : 'en'];
    return !!(other && other.test(cleanMsg));
}
function getGreetingExplanation(lang) {
    const L = normalizeLang(lang);
    return GREETING_EXPLANATION_BY_LANG[L] || GREETING_EXPLANATION_BY_LANG[DEFAULT_LANG];
}

// --- MENSAJES DE SISTEMA AL USUARIO POR IDIOMA ---
const USER_MESSAGES_BY_LANG = {
    es: {
        directResults: ({ q }) => `Resultados directos para "${q}"`,
        semanticResults: ({ q }) => `Resultados semánticos para "${q}"`,
        foundResults: ({ q }) => `Encontré estos resultados para "${q}"`,
        noResults: ({ q }) => `No encontré resultados para "${q}". Intenta describir lo que buscas de otra forma.`,
        resultsFor: ({ q }) => `Resultados para "${q}"`,
    },
    en: {
        directResults: ({ q }) => `Direct results for "${q}"`,
        semanticResults: ({ q }) => `Semantic results for "${q}"`,
        foundResults: ({ q }) => `Here's what I found for "${q}"`,
        noResults: ({ q }) => `No results for "${q}". Try describing what you're looking for differently.`,
        resultsFor: ({ q }) => `Results for "${q}"`,
    }
};
function t(lang, key, vars = {}) {
    const L = normalizeLang(lang);
    const bundle = USER_MESSAGES_BY_LANG[L] || USER_MESSAGES_BY_LANG[DEFAULT_LANG];
    const fn = bundle[key] || USER_MESSAGES_BY_LANG[DEFAULT_LANG][key];
    return typeof fn === 'function' ? fn(vars) : (fn || '');
}

/**
 * Normaliza texto contra evasión NSFW (leetspeak, spacing, repetición).
 * Asume que el input ya viene de cleanText() (lowercase, sin diacríticos).
 */
function normalizeForNsfw(text) {
    let s = text;
    // Proteger secuencias numéricas de 2+ dígitos ("+18", "18+", "100") antes del leetspeak
    const numericTokens = [];
    s = s.replace(/\+?\d{2,}\+?/g, (match) => {
        numericTokens.push(match);
        return `__NUM${numericTokens.length - 1}__`;
    });
    // Leetspeak → letras reales
    s = s.replace(/3/g, 'e').replace(/0/g, 'o').replace(/1/g, 'i')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a');
    // Restaurar tokens numéricos
    s = s.replace(/__NUM(\d+)__/g, (_, idx) => numericTokens[parseInt(idx)] || '');
    // Colapsar letras repetidas (3+) → 1
    s = s.replace(/(.)\1{2,}/g, '$1');
    // Colapsar dobles letras → 1 excepto ll, rr (español)
    s = s.replace(/([a-z])\1/g, (match, ch) => (ch === 'l' || ch === 'r') ? match : ch);
    // Colapsar letras con espacios intercalados ("h e n t a i" → "hentai")
    s = s.replace(/\b((?:[a-z]\s){3,}[a-z])\b/g, (match) => match.replace(/\s/g, ''));
    // Limpiar espacios múltiples
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

function isNsfwContent(text) {
    try {
        if (!text || typeof text !== 'string') return false;
        const normalized = normalizeForNsfw(text);
        for (let i = 0; i < NSFW_SERVER_PATTERNS.length; i++) {
            if (NSFW_SERVER_PATTERNS[i].test(normalized)) return true;
        }
        return false;
    } catch {
        return false; // nunca bloquear por error interno
    }
}

// --- MAPEO DE SEGURIDAD PARA GÉNEROS (claves en español normalizado) ---
// El catálogo indexa géneros en ES (genreIndexNormalized); para queries EN
// traducimos el término al alias ES antes de consultar el índice.
const genreMapping = {
    'accion': 'Acción', 'aventura': 'Aventura', 'comedia': 'Comedia',
    'fantasia': 'Fantasía', 'romance': 'Romance', 'terror': 'Terror',
    'misterio': 'Misterio', 'escolar': 'Escolar', 'ciencia ficcion': 'Ciencia Ficción',
    'harem': 'Harem', 'murim': 'Murim'
};

// Alias EN→ES para géneros (aplicado antes de buscar en genreIndexNormalized)
const GENRE_ALIASES_EN_TO_ES = {
    'action': 'accion',
    'adventure': 'aventura',
    'comedy': 'comedia',
    'fantasy': 'fantasia',
    'romance': 'romance',
    'horror': 'terror',
    'terror': 'terror',
    'mystery': 'misterio',
    'school': 'escolar',
    'school life': 'escolar',
    'sci-fi': 'ciencia ficcion',
    'scifi': 'ciencia ficcion',
    'science fiction': 'ciencia ficcion',
    'harem': 'harem',
    'murim': 'murim',
    'martial arts': 'murim',
    'drama': 'drama',
    'thriller': 'suspenso',
    'psychological': 'psicologico',
    'tragedy': 'tragedia',
    'supernatural': 'sobrenatural',
    'slice of life': 'slice of life'
};

function translateGenreToEs(token) {
    if (!token) return token;
    const k = String(token).toLowerCase().trim();
    return GENRE_ALIASES_EN_TO_ES[k] || k;
}

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
        language: s.language || s.lang || s.idioma || null,
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

// --- CACHE PREWARM (consultas populares, por idioma) ---
const POPULAR_QUERIES_BY_LANG = {
    es: [
        'romance escolar',
        'accion aventura',
        'murim',
        'reencarnacion',
        'venganza',
        'sistema niveles',
        'fantasia',
        'los mejores'
    ],
    en: [
        'school romance',
        'action adventure',
        'murim',
        'reincarnation',
        'revenge',
        'system leveling',
        'fantasy',
        'top rated'
    ]
};
const POPULAR_QUERIES = POPULAR_QUERIES_BY_LANG.es; // retrocompat si algo externo lo lee

async function prewarmCache() {
    logger.info('Iniciando precalentamiento progresivo de caché...');

    // Prewarm por idioma para que ambos buckets tengan caché caliente
    for (const lang of SUPPORTED_LANGS) {
        const queries = POPULAR_QUERIES_BY_LANG[lang] || [];
        for (const query of queries) {
            try {
                const result = await callAI(query, AI_RETRIES, null, lang);
                if (result) {
                    // Clave diferenciada por idioma para evitar colisiones entre ES y EN
                    const key = `${lang}:${cleanText(query)}`;
                    const payload = {
                        success: true,
                        explanation: result.reason || ('Prewarm: ' + query),
                        series: [],
                        appliedFilter: result,
                        lang
                    };
                    setCachedSearch(key, payload, 1000 * 60 * 30);
                }
            } catch (e) {
                logger.warn('Error en prewarm', { lang, query, error: e?.message });
            }
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    logger.info('Precalentamiento finalizado', {
        cached: searchCache.size,
        popular: POPULAR_QUERIES_BY_LANG.es.length + POPULAR_QUERIES_BY_LANG.en.length
    });
}

// --- RATE LIMITER ESPECÍFICO PARA LLAMADAS A IA ---
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: parseInt(process.env.AI_RATE_MAX, 10) || 60, // máximo 60 llamadas por minuto por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muchas búsquedas IA, espera 1 min' }
});
// ⚡ Rate limiter global para prevenir DoS en todas las rutas /api/*
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.GLOBAL_RATE_MAX, 10) || 500, // 500 requests por IP por defecto
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
    for (const word of queryWords) {
        const indexed = keywordIndex[word];
        if (indexed) {
            for (const s of indexed) {
                if (seen.has(s.id)) continue;
                seen.add(s.id);
                results.push({ item: s, score: 0.22, source: 'keyword_index' });
            }
        }
    }

    // Paso 4: Fuse.js fuzzy (typos, mala ortografía)
    // "sollo levelig" -> "Solo Leveling" ✓
    if (fuse) {
        try {
            const fuseResults = fuse.search(userMsg);
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
    if (queryWords.length > 0) {
        for (const s of seriesCache) {
            if (seen.has(s.id)) continue;
            const text = s._fullText || '';
            const matchCount = queryWords.filter(w => text.includes(w)).length;
            // Requiere que al menos 60% de las palabras matcheen
            if (matchCount >= Math.ceil(queryWords.length * 0.6)) {
                seen.add(s.id);
                const relevance = matchCount / queryWords.length;
                results.push({ item: s, score: 0.5 + (1 - relevance) * 0.3, source: 'fulltext' });
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

// --- SSE: clientes conectados por idioma ---
const sseClientsByLang = { es: new Set(), en: new Set() };
const SSE_KEEPALIVE_MS = 25000; // ping cada 25s para atravesar proxies (timeout típico 30-60s)
const MAX_SSE_CLIENTS_PER_LANG = 5000;

function getPopularPayload(lang) {
    const L = normalizeLang(lang);
    const similarRegex = /similares?\s*(a\b|al\b)/i;
    const sorted = [...H(L)].sort((a, b) => (b.count || 0) - (a.count || 0));
    const popular = sorted
        .filter(q => q && q.query && !similarRegex.test(q.query))
        .slice(0, 20)
        .map((q, i) => ({ rank: i + 1, query: q.query, count: q.count || 0 }));
    const similar = sorted
        .filter(q => q && q.query && similarRegex.test(q.query))
        .slice(0, 10)
        .map((q, i) => ({ rank: i + 1, query: q.query, count: q.count || 0 }));
    return { lang: L, popular, similar };
}

function broadcastPopular(lang) {
    const L = normalizeLang(lang);
    const clients = sseClientsByLang[L];
    if (!clients || clients.size === 0) return;
    let payload;
    try { payload = `data: ${JSON.stringify(getPopularPayload(L))}\n\n`; }
    catch (e) { logger.warn('broadcastPopular serialize falló', { lang: L, error: e && e.message }); return; }
    for (const client of clients) {
        try {
            if (client.writableEnded || client.destroyed) { clients.delete(client); continue; }
            client.write(payload);
        } catch (err) {
            clients.delete(client);
            try { client.end(); } catch { /* ignore */ }
        }
    }
}

// --- ENDPOINT SSE: actualizaciones en tiempo real de contadores ---
app.get('/api/popular/sse', (req, res) => {
    const lang = getRequestLang(req);
    const clients = sseClientsByLang[lang];

    // Proteger memoria: rechazar si pasamos del límite por idioma
    if (clients.size >= MAX_SSE_CLIENTS_PER_LANG) {
        res.status(503).end();
        logger.warn('SSE rechazado: demasiados clientes', { lang, current: clients.size });
        return;
    }

    const allowedOrigin = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : null;
    const requestOrigin = req.headers.origin;
    if (allowedOrigin) {
        if (allowedOrigin.includes(requestOrigin)) {
            res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        }
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // evita buffering en Nginx
    try { res.flushHeaders(); } catch { /* ignore */ }

    // Enviar estado actual al conectar (puede fallar si cliente cortó antes)
    try {
        res.write(`retry: 5000\n\n`);
        res.write(`event: lang\ndata: ${JSON.stringify({ lang })}\n\n`);
        res.write(`data: ${JSON.stringify(getPopularPayload(lang))}\n\n`);
    } catch (err) {
        logger.warn('SSE write inicial falló', { lang, error: err && err.message });
        try { res.end(); } catch { /* ignore */ }
        return;
    }

    clients.add(res);

    // Keepalive: evitar que proxies cierren la conexión por inactividad
    const ka = setInterval(() => {
        try {
            if (res.writableEnded || res.destroyed) { clearInterval(ka); clients.delete(res); return; }
            res.write(`: ka ${Date.now()}\n\n`);
        } catch {
            clearInterval(ka);
            clients.delete(res);
            try { res.end(); } catch { /* ignore */ }
        }
    }, SSE_KEEPALIVE_MS);

    const cleanup = () => {
        clearInterval(ka);
        clients.delete(res);
    };
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
});

// --- ENDPOINT PÚBLICO: sugerencias de búsqueda (popular + similar combinados) ---
app.get('/api/search-suggestions', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
    const lang = getRequestLang(req);
    const queryHistory = H(lang);
    const afterSearchMap = AS(lang);
    const similarRegex = /similares?\s*(a\b|al\b)/i;
    const sorted = [...queryHistory].sort((a, b) => b.count - a.count);
    const popular = sorted
        .filter(q => !similarRegex.test(q.query))
        .slice(0, 20)
        .map((q, i) => ({ rank: i + 1, query: q.query, count: q.count }));
    const similar = sorted
        .filter(q => similarRegex.test(q.query))
        .slice(0, 10)
        .map((q, i) => ({ rank: i + 1, query: q.query, count: q.count }));

    // --- Nuevos: consultas por firstSeen (genuinamente nuevas), deduplicadas por key ---
    // Fallback: si no hay firstSeen, usar lastSeen; si tampoco, usar posición en el array
    const seenNewest = new Set();
    const newestCandidates = queryHistory
        .filter(q => {
            if (!q || !q.query || similarRegex.test(q.query)) return false;
            const k = q.key || q.query;
            if (seenNewest.has(k)) return false;
            seenNewest.add(k);
            return true;
        });
    // Ordenar por firstSeen si existe, sino por lastSeen, sino mantener orden original (más reciente primero)
    const newest = [...newestCandidates]
        .sort((a, b) => {
            const aDate = a.firstSeen || a.lastSeen || '';
            const bDate = b.firstSeen || b.lastSeen || '';
            return bDate.localeCompare(aDate);
        })
        .slice(0, 20)
        .map((q, i) => ({
            rank: i + 1,
            query: q.query,
            count: q.count || 1,
            firstSeen: q.firstSeen || q.lastSeen || null,
            lastSeen: q.lastSeen || null
        }));

    // --- Tendencias (hot score): algoritmo de ventana deslizante con gravedad ---
    // hotScore combina:
    //   1) Frecuencia total (count) como señal de popularidad base
    //   2) Recencia (cuántas horas desde lastSeen) como señal de "caliente ahora"
    //   3) Velocidad: si firstSeen es reciente Y tiene muchos hits = viral
    // Fórmula: hotScore = (count^0.8 * velocityBoost) / (hoursSinceLast + 2)^gravity
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const GRAVITY = 1.5;
    const seenTrending = new Set();
    let trending = [...queryHistory]
        .filter(q => {
            if (!q.lastSeen || similarRegex.test(q.query)) return false;
            if (!q.key || seenTrending.has(q.key)) return false;
            const age = now - new Date(q.lastSeen).getTime();
            if (age > ONE_DAY_MS) return false;
            seenTrending.add(q.key);
            return q.count >= 2;
        })
        .map(q => {
            const hoursSinceLast = Math.max(0, (now - new Date(q.lastSeen).getTime()) / 3600000);
            const hoursSinceFirst = q.firstSeen
                ? Math.max(1, (now - new Date(q.firstSeen).getTime()) / 3600000)
                : 24;
            // Boost de velocidad: si acumuló muchos hits en poco tiempo
            const velocityBoost = Math.min(3, q.count / hoursSinceFirst + 1);
            const hotScore = (Math.pow(q.count, 0.8) * velocityBoost) / Math.pow(hoursSinceLast + 2, GRAVITY);
            return { ...q, hotScore };
        })
        .sort((a, b) => b.hotScore - a.hotScore)
        .slice(0, 15)
        .map((q, i) => ({
            rank: i + 1,
            query: q.query,
            count: q.count,
            hotScore: Math.round(q.hotScore * 100) / 100,
            lastSeen: q.lastSeen
        }));

    // Fallback escalonado: 7 días → 30 días → top por count (nunca queda vacío)
    if (trending.length < 3) {
        const windows = [7, 30, 365];
        for (const days of windows) {
            if (trending.length >= 3) break;
            const windowMs = days * ONE_DAY_MS;
            const seenFallback = new Set(trending.map(t => t.query));
            const extra = [...queryHistory]
                .filter(q => {
                    if (!q || !q.query || similarRegex.test(q.query)) return false;
                    if (seenFallback.has(q.query)) return false;
                    if (q.lastSeen) {
                        const age = now - new Date(q.lastSeen).getTime();
                        if (age > windowMs) return false;
                    }
                    seenFallback.add(q.query);
                    return (q.count || 0) >= 2;
                })
                .sort((a, b) => (b.count || 0) - (a.count || 0))
                .slice(0, 10 - trending.length)
                .map((q, i) => ({
                    rank: trending.length + i + 1,
                    query: q.query,
                    count: q.count || 1,
                    hotScore: 0,
                    lastSeen: q.lastSeen || null
                }));
            trending = [...trending, ...extra];
        }
        // Último recurso: top por count sin filtro de tiempo
        if (trending.length < 3) {
            const seenAll = new Set(trending.map(t => t.query));
            const topByCount = sorted
                .filter(q => !similarRegex.test(q.query) && !seenAll.has(q.query))
                .slice(0, 10 - trending.length)
                .map((q, i) => ({
                    rank: trending.length + i + 1,
                    query: q.query,
                    count: q.count || 1,
                    hotScore: 0,
                    lastSeen: q.lastSeen || null
                }));
            trending = [...trending, ...topByCount];
        }
    }

    // --- Queries relacionadas: basadas en la última búsqueda del usuario ---
    const relatedQuery = (req.query.q || '').trim();
    const related = relatedQuery.length >= 2 ? getRelatedQueries(relatedQuery, 8, lang) : [];

    // --- After-search: "Porque buscaste X, otros buscaron Y" (patrón colectivo) ---
    let afterSearch = [];
    if (relatedQuery.length >= 2) {
        const srcKey = cleanText(relatedQuery);
        let nextMap = afterSearchMap.get(srcKey);
        if (!nextMap) {
            let bestKey = null;
            let bestSim = 0.85;
            for (const k of afterSearchMap.keys()) {
                const sim = getSimilarityScore(k, srcKey);
                if (sim > bestSim) { bestSim = sim; bestKey = k; }
            }
            if (bestKey) nextMap = afterSearchMap.get(bestKey);
        }
        if (nextMap && nextMap.size > 0) {
            afterSearch = [...nextMap.entries()]
                .filter(([nextKey]) => getSimilarityScore(nextKey, srcKey) < 0.85)
                .map(([key, info]) => ({ key, ...info }))
                .sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    return (b.lastTs || 0) - (a.lastTs || 0);
                })
                .slice(0, 8)
                .map((item, i) => ({
                    rank: i + 1,
                    query: item.query,
                    count: item.count,
                    lastTs: item.lastTs,
                }));
        }
    }

    res.json({ success: true, lang, popular, similar, newest, trending, related, afterSearch });
});

// --- ENDPOINT DE DIAGNÓSTICO: salud del sistema multi-idioma ---
app.get('/api/lang-health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const lang = getRequestLang(req);
    const stats = {};
    for (const L of SUPPORTED_LANGS) {
        const list = H(L);
        const afterMap = AS(L);
        let afterPairs = 0;
        for (const m of afterMap.values()) afterPairs += m.size;
        stats[L] = {
            historyCount: list.length,
            historyMax: MAX_QUERY_HISTORY,
            sseClients: sseClientsByLang[L] ? sseClientsByLang[L].size : 0,
            afterSearchSources: afterMap.size,
            afterSearchPairs: afterPairs,
            pendingWrites: historyPendingWrites[L] || 0,
            metrics: langMetrics[L],
        };
    }
    res.json({
        success: true,
        detectedLang: lang,
        supported: SUPPORTED_LANGS,
        default: DEFAULT_LANG,
        byLang: stats,
    });
});

// --- ENDPOINT PÚBLICO: top consultas populares (sin auth) ---
app.get('/api/popular', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
    const lang = getRequestLang(req);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = [...H(lang)]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((q, i) => ({
            rank: i + 1,
            query: q.query,
            count: q.count
        }));
    res.json({ success: true, lang, queries: result });
});

// --- ENDPOINT PÚBLICO: top consultas "similar a..." rankeadas por popularidad ---
app.get('/api/popular-similar', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
    const lang = getRequestLang(req);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const similarRegex = /similares?\s*(a\b|al\b)/i;
    const result = [...H(lang)]
        .filter(q => similarRegex.test(q.query))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((q, i) => ({
            rank: i + 1,
            query: q.query,
            count: q.count
        }));
    res.json({ success: true, lang, queries: result });
});

// --- QUERIES RELACIONADAS: clustering por co-ocurrencia de palabras clave ---

// Stopwords por idioma (palabras que no aportan semántica para clustering/keywords)
const STOPWORDS_ES = new Set([
    'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante',
    'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'segun', 'sin',
    'sobre', 'tras', 'el', 'la', 'lo', 'los', 'las', 'un', 'una', 'uno', 'unos', 'unas',
    'y', 'e', 'ni', 'o', 'u', 'pero', 'sino', 'que', 'como', 'si', 'cuando', 'donde',
    'es', 'son', 'ser', 'estar', 'hay', 'tiene', 'tienen', 'fue', 'era', 'sus', 'su',
    'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'mi', 'tu', 'yo',
    'mas', 'muy', 'mucho', 'poco', 'tan', 'tanto', 'todo', 'toda', 'todos', 'todas',
    'este', 'esta', 'esto', 'estos', 'estas', 'ese', 'esa', 'eso', 'esos', 'esas',
    'no', 'ya', 'tambien', 'solo', 'aun', 'asi', 'aqui', 'ahi', 'alli',
    'manhwa', 'manhwas', 'manga', 'mangas', 'comic', 'comics', 'webtoon', 'webtoons',
    'similares', 'similar', 'parecido', 'parecidos', 'tipo', 'estilo',
    'buscar', 'busca', 'quiero', 'dame', 'recomienda', 'recomendaciones',
    'mejor', 'mejores', 'top', 'buenos', 'bueno', 'buenas'
]);

const STOPWORDS_EN = new Set([
    'the', 'a', 'an', 'of', 'and', 'or', 'nor', 'but', 'so', 'yet',
    'in', 'on', 'at', 'to', 'from', 'by', 'with', 'without', 'about',
    'for', 'as', 'into', 'onto', 'upon', 'over', 'under', 'between',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'doing',
    'this', 'that', 'these', 'those', 'there', 'here', 'where', 'when',
    'i', 'me', 'my', 'you', 'your', 'he', 'she', 'it', 'its', 'we', 'our', 'they', 'them', 'their',
    'not', 'no', 'yes', 'also', 'too', 'only', 'just', 'very', 'really',
    'manhwa', 'manhwas', 'manga', 'mangas', 'comic', 'comics', 'webtoon', 'webtoons',
    'similar', 'like', 'similar-to', 'kind', 'style', 'type',
    'search', 'find', 'want', 'need', 'give', 'show', 'tell', 'recommend', 'recommendation', 'recommendations',
    'best', 'good', 'great', 'top', 'new', 'latest'
]);

const STOPWORDS_BY_LANG = { es: STOPWORDS_ES, en: STOPWORDS_EN };
// Unión para clustering cross-lingual (evita que una stopword de un idioma contamine al otro)
const STOPWORDS = new Set([...STOPWORDS_ES, ...STOPWORDS_EN]);

// Extrae keywords significativas de un texto normalizado
// Nota: no aplicamos stemming. Prefijos/sufijos por idioma varían (ES vs Porter EN)
// y el stemming agresivo genera colisiones; preferimos tokens crudos + sinónimos.
function extractKeywords(text, lang = DEFAULT_LANG) {
    const userLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    const stops = STOPWORDS_BY_LANG[userLang] || STOPWORDS_ES;
    const normalized = cleanText(text);
    const words = normalized.split(/\s+/).filter(w => w.length >= 3 && !stops.has(w));
    return [...new Set(words)];
}

// Construye un mapa de keywords → queries que contienen esa keyword (por idioma)
function buildQueryKeywordIndex(lang) {
    const keywordMap = new Map(); // keyword → [{ idx, query, key, count }]
    const list = H(lang);

    for (let i = 0; i < list.length; i++) {
        const q = list[i];
        if (!q || !q.query) continue;

        const keywords = extractKeywords(q.query, lang);
        for (const kw of keywords) {
            if (!keywordMap.has(kw)) keywordMap.set(kw, []);
            keywordMap.get(kw).push({
                idx: i,
                query: q.query,
                key: q.key || cleanText(q.query),
                count: q.count || 1,
                resultTitles: q.resultTitles || []
            });
        }
    }
    return keywordMap;
}

// Calcula queries relacionadas por co-ocurrencia de keywords + overlap de resultTitles
function getRelatedQueries(inputQuery, limit = 10, lang = 'es') {
    const inputKey = cleanText(inputQuery);
    const inputKeywords = extractKeywords(inputQuery, lang);
    if (inputKeywords.length === 0) return [];

    const keywordMap = buildQueryKeywordIndex(lang);
    const candidateScores = new Map(); // key → { query, score, count, sharedKeywords }

    // Para cada keyword del input, encontrar queries que la contengan
    for (const kw of inputKeywords) {
        const entries = keywordMap.get(kw) || [];
        for (const entry of entries) {
            // No incluirse a sí misma
            if (entry.key === inputKey) continue;
            // No incluir queries muy similares (variantes de la misma)
            if (getSimilarityScore(entry.key, inputKey) > 0.7) continue;

            if (!candidateScores.has(entry.key)) {
                candidateScores.set(entry.key, {
                    query: entry.query,
                    key: entry.key,
                    score: 0,
                    count: entry.count,
                    sharedKeywords: [],
                    resultTitles: entry.resultTitles
                });
            }
            const candidate = candidateScores.get(entry.key);
            candidate.score += 1; // +1 por cada keyword compartida
            candidate.sharedKeywords.push(kw);
        }
    }

    // Boost por overlap de resultTitles con la query de entrada
    const inputEntry = H(lang).find(q => q && q.key === inputKey);
    if (inputEntry && inputEntry.resultTitles && inputEntry.resultTitles.length > 0) {
        const inputTitles = new Set(inputEntry.resultTitles.map(t => cleanText(t)));
        for (const [, candidate] of candidateScores) {
            if (candidate.resultTitles && candidate.resultTitles.length > 0) {
                const overlap = candidate.resultTitles.filter(t => inputTitles.has(cleanText(t))).length;
                if (overlap > 0) {
                    candidate.score += overlap * 0.5; // Peso menor que keywords directas
                }
            }
        }
    }

    // Normalizar score: dividir entre total de keywords del input para obtener %
    const maxPossible = inputKeywords.length;
    const results = [...candidateScores.values()]
        .filter(c => c.score >= 1) // Al menos 1 keyword compartida
        .map(c => ({
            query: c.query,
            relevance: Math.round((c.score / maxPossible) * 100) / 100,
            sharedKeywords: [...new Set(c.sharedKeywords)],
            count: c.count
        }))
        .sort((a, b) => {
            // Primero por relevance, luego por popularidad
            if (b.relevance !== a.relevance) return b.relevance - a.relevance;
            return b.count - a.count;
        })
        .slice(0, limit);

    return results;
}

// --- AFTER-SEARCH: "Porque buscaste X, otros buscaron Y" (patrón colectivo) ---
// Estructura:
//   sessionQueries: Map<deviceId, [{ key, query, ts }, ...]>
//     Ventana deslizante de 30 min. Si dentro de la ventana el usuario hace Q1 → Q2,
//     incrementamos afterSearchMap[Q1][Q2].count
//   afterSearchMap: Map<sourceKey, Map<nextKey, { query, count, lastTs }>>
//     Persistido a disco para sobrevivir restarts.

const AFTER_SEARCH_FILE_LEGACY = path.join(__dirname, 'after_search_map.json');
const AFTER_SEARCH_FILES = {
    es: path.join(__dirname, 'after_search_map_es.json'),
    en: path.join(__dirname, 'after_search_map_en.json'),
};
const SESSION_WINDOW_MS = 30 * 60 * 1000; // 30 minutos
const MAX_SESSIONS = 2000;
const MAX_QUERIES_PER_SESSION = 20;

// Sesiones separadas por idioma: un usuario que alterne /es y /en no cruza señales.
const sessionQueriesByLang = { es: new Map(), en: new Map() };
const afterSearchMapByLang = { es: new Map(), en: new Map() };

// Accesores
function SQ(lang) { return sessionQueriesByLang[normalizeLang(lang)]; }
function AS(lang) { return afterSearchMapByLang[normalizeLang(lang)]; }

function getRequestDeviceId(req) {
    if (!req || !req.headers) return null;
    const id = (req.headers['x-device-id'] || req.headers['x-visitor-id'] || '').toString().trim();
    return id || null;
}

function recordAfterSearchEvent(deviceId, key, query, lang) {
    if (!deviceId || !key || !query) return;
    const L = normalizeLang(lang);
    const now = Date.now();

    const sessions = SQ(L);
    const afterMap = AS(L);

    // Obtener o crear sesión
    let session = sessions.get(deviceId) || [];
    // Purgar eventos fuera de la ventana
    session = session.filter(s => (now - s.ts) < SESSION_WINDOW_MS);

    // Buscar la query previa más reciente (distinta de la actual)
    const prev = [...session].reverse().find(s => s.key !== key);
    if (prev) {
        if (!afterMap.has(prev.key)) afterMap.set(prev.key, new Map());
        const nextMap = afterMap.get(prev.key);
        const existing = nextMap.get(key);
        if (existing) {
            existing.count += 1;
            existing.lastTs = now;
            existing.query = query; // mantener la forma más reciente
        } else {
            nextMap.set(key, { query, count: 1, lastTs: now });
        }
        scheduleAfterSearchSave(L);
    }

    // Actualizar sesión
    session.push({ key, query, ts: now });
    if (session.length > MAX_QUERIES_PER_SESSION) {
        session.splice(0, session.length - MAX_QUERIES_PER_SESSION);
    }
    sessions.set(deviceId, session);

    // LRU aproximado: si pasamos del máximo, eliminar el más antiguo
    if (sessions.size > MAX_SESSIONS) {
        const firstKey = sessions.keys().next().value;
        sessions.delete(firstKey);
    }
}

function loadAfterSearchMap() {
    let anyLoaded = false;
    for (const lang of SUPPORTED_LANGS) {
        try {
            const file = AFTER_SEARCH_FILES[lang];
            // Limpiar tmp huérfanos
            try {
                const dir = path.dirname(file);
                const base = path.basename(file);
                for (const f of fs.readdirSync(dir)) {
                    if (f.startsWith(`${base}.`) && f.endsWith('.tmp')) {
                        try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ }
                    }
                }
            } catch { /* ignore */ }

            if (!fs.existsSync(file)) continue;
            const raw = fs.readFileSync(file, 'utf8');
            let data;
            try { data = JSON.parse(raw || '{}'); }
            catch (parseErr) {
                logger.error('after-search corrupto; moviendo a .bak', { lang, error: parseErr && parseErr.message });
                try { fs.renameSync(file, `${file}.corrupt.${Date.now()}.bak`); } catch { /* ignore */ }
                continue;
            }
            if (!data || typeof data !== 'object') continue;
            const target = AS(lang);
            let pairs = 0;
            for (const [src, nexts] of Object.entries(data)) {
                if (!nexts || typeof nexts !== 'object') continue;
                const m = new Map();
                for (const [k, v] of Object.entries(nexts)) {
                    if (!v || typeof v !== 'object') continue;
                    m.set(k, {
                        query: typeof v.query === 'string' ? v.query : k,
                        count: Number.isFinite(v.count) ? v.count : 1,
                        lastTs: Number.isFinite(v.lastTs) ? v.lastTs : Date.now(),
                    });
                    pairs++;
                }
                if (m.size > 0) target.set(src, m);
            }
            logger.info('🔗 After-search cargado', { lang, sources: target.size, pairs });
            anyLoaded = true;
        } catch (e) {
            logger.warn('loadAfterSearchMap falló', { lang, error: e && e.message });
        }
    }

    // Migración legacy
    if (!anyLoaded && fs.existsSync(AFTER_SEARCH_FILE_LEGACY)) {
        try {
            const raw = fs.readFileSync(AFTER_SEARCH_FILE_LEGACY, 'utf8');
            const data = JSON.parse(raw || '{}');
            const target = AS('es');
            for (const [src, nexts] of Object.entries(data)) {
                const m = new Map();
                for (const [k, v] of Object.entries(nexts || {})) m.set(k, v);
                target.set(src, m);
            }
            logger.info('🔗 After-search legacy migrado a ES', { sources: target.size });
        } catch (e) {
            logger.warn('Migración legacy after-search falló', { error: e && e.message });
        }
    }
}

const afterSearchSaveTimers = { es: null, en: null };
const afterSearchSaveLocks = { es: Promise.resolve(), en: Promise.resolve() };

function serializeAfterSearch(lang) {
    const obj = {};
    for (const [src, nexts] of AS(lang)) {
        obj[src] = {};
        for (const [k, v] of nexts) obj[src][k] = v;
    }
    return obj;
}

async function saveAfterSearchFor(lang) {
    const L = normalizeLang(lang);
    const prev = afterSearchSaveLocks[L];
    let release;
    afterSearchSaveLocks[L] = new Promise(res => { release = res; });
    try {
        await prev;
        const snapshot = serializeAfterSearch(L);
        await atomicWriteJSON(AFTER_SEARCH_FILES[L], snapshot);
    } catch (e) {
        logger.warn('after-search save falló', { lang: L, error: e && e.message });
    } finally {
        release();
    }
}

function scheduleAfterSearchSave(lang) {
    const L = normalizeLang(lang);
    if (afterSearchSaveTimers[L]) clearTimeout(afterSearchSaveTimers[L]);
    afterSearchSaveTimers[L] = setTimeout(() => {
        afterSearchSaveTimers[L] = null;
        saveAfterSearchFor(L).catch(() => { /* ya loguea dentro */ });
    }, 10000);
}

function saveAfterSearchSync() {
    for (const L of SUPPORTED_LANGS) {
        if (afterSearchSaveTimers[L]) { clearTimeout(afterSearchSaveTimers[L]); afterSearchSaveTimers[L] = null; }
        try {
            const tmp = `${AFTER_SEARCH_FILES[L]}.${process.pid}.sync.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(serializeAfterSearch(L)));
            fs.renameSync(tmp, AFTER_SEARCH_FILES[L]);
        } catch (e) {
            logger.error('saveAfterSearchSync error', { lang: L, error: e && e.message });
        }
    }
}

// Cargar al iniciar
loadAfterSearchMap();

// Endpoint: "Porque buscaste X, otros buscaron..."
app.get('/api/after-search', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    const lang = getRequestLang(req);
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
        return res.json({ success: true, lang, query: q, after: [] });
    }

    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const srcKey = cleanText(q);
    const afterSearchMap = AS(lang);

    // Match exacto
    let nextMap = afterSearchMap.get(srcKey);

    // Fallback fuzzy: si el key exacto no existe, buscar el más similar
    if (!nextMap) {
        let bestKey = null;
        let bestSim = 0.85;
        for (const k of afterSearchMap.keys()) {
            const sim = getSimilarityScore(k, srcKey);
            if (sim > bestSim) {
                bestSim = sim;
                bestKey = k;
            }
        }
        if (bestKey) nextMap = afterSearchMap.get(bestKey);
    }

    if (!nextMap || nextMap.size === 0) {
        return res.json({ success: true, lang, query: q, after: [] });
    }

    // Excluir queries casi idénticas al input (p. ej. variantes menores)
    const after = [...nextMap.entries()]
        .filter(([nextKey]) => getSimilarityScore(nextKey, srcKey) < 0.85)
        .map(([key, info]) => ({ key, ...info }))
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return (b.lastTs || 0) - (a.lastTs || 0);
        })
        .slice(0, limit)
        .map((item, i) => ({
            rank: i + 1,
            query: item.query,
            count: item.count,
            lastTs: item.lastTs,
        }));

    logger.info('🔗 After-search', { lang, input: q, found: after.length });
    res.json({ success: true, lang, query: q, after });
});

// Endpoint: queries relacionadas por co-ocurrencia
app.get('/api/related-queries', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    const lang = getRequestLang(req);
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
        return res.json({ success: true, lang, query: q, related: [] });
    }

    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const related = getRelatedQueries(q, limit, lang);

    logger.info('🔗 Related queries', { lang, input: q, found: related.length });
    res.json({ success: true, lang, query: q, related });
});

// --- PERSONALIZACION HOME: carruseles por historial reciente de IA ---
const PERSONALIZED_TOPIC_RULES = [
    {
        id: 'villano_venganza',
        minHits: 2,
        terms: ['villan', 'antihero', 'venganz', 'despiadad', 'oscuro', 'malo', 'sin piedad'],
        titleVariants: [
            'Tu era villano: protagonistas sin piedad',
            'Lado oscuro desbloqueado: antihéroes y venganza',
            'Sin piedad y sin frenos: justo tu tipo de prota'
        ],
        subtitleVariants: [
            'Lo armamos según lo que más repetiste estos días.',
            'Se nota el patrón: villanos, venganza y decisiones extremas.',
            'Si te gustan los protas grises, aquí vas a estar en casa.'
        ],
        query: 'manhwas con protagonista villano antiheroe y venganza despiadada'
    },
    {
        id: 'regresion',
        minHits: 2,
        terms: ['regres', 'pasado', 'reencarn', 'isekai', 'segunda oportunidad', 'volver el tiempo'],
        titleVariants: [
            'Tu obsesion actual: regresion y segunda oportunidad',
            'Volver al pasado, pero esta vez para dominarlo todo',
            'Otra vida, otra ruta: regresion en modo serio'
        ],
        subtitleVariants: [
            'Lo destacamos porque viene saliendo seguido en tus busquedas.',
            'Tu historial grita regresion, asi que lo pusimos arriba.',
            'Si hay viaje al pasado, aqui tienes de lo mejorcito.'
        ],
        query: 'manhwas de regresion reencarnacion y segunda oportunidad'
    },
    {
        id: 'murim_system',
        minHits: 2,
        terms: ['murim', 'artes marcial', 'sistem', 'pantalla', 'rpg', 'nivel'],
        titleVariants: [
            'Murim con sistema: la mezcla que te esta gustando',
            'Artes marciales + ventanas de estado = combo ganador',
            'Puños, qi y paneles de nivel: justo en tu vibra'
        ],
        subtitleVariants: [
            'Detectamos ese cruce raro que te encanta y lo reunimos aqui.',
            'Para cuando quieres murim, pero con sabor RPG.',
            'Nicho activado: marciales con sistema y ritmo rapido.'
        ],
        query: 'manhwas murim con sistema rpg y artes marciales'
    },
    {
        id: 'underdog_artifact',
        minHits: 2,
        terms: ['debil', 'objeto', 'artefact', 'mazmorra', 'op', 'power up', 'poder oculto'],
        titleVariants: [
            'De cero a leyenda: artefactos y power-ups ocultos',
            'Prota debil + objeto roto = caos delicioso',
            'Nadie lo vio venir: underdog en modo OP'
        ],
        subtitleVariants: [
            'Tu historial pide crecimiento bestia, asi que te lo servimos directo.',
            'Seleccionado para ese mood de pasar de inutil a monstruo.',
            'Si hay mazmorra y power-up inesperado, aqui lo tienes.'
        ],
        query: 'manhwas donde protagonista debil consigue artefacto y se vuelve op'
    },
    {
        id: 'light_vibe',
        minHits: 1,
        terms: ['liger', 'desconectar', 'no serio', 'sin drama', 'pasar el rato', 'relaj', 'comedi'],
        titleVariants: [
            'Cero estres: lecturas ligeras para desconectar',
            'Modo relax: historias para pasarla bien',
            'Sin dramas pesados: lectura suave para hoy'
        ],
        subtitleVariants: [
            'Para cuando solo quieres leer algo rico y sin complicarte.',
            'Elegimos series con ritmo ligero y vibe tranquila.',
            'Ideal para cerrar el dia sin carga emocional extra.'
        ],
        query: 'manhwas ligeros de comedia slice of life para desconectar'
    },
    {
        id: 'survival_like_orv',
        minHits: 1,
        terms: ['omniscient', 'orv', 'superviv', 'constelac', 'escenario', 'calamidad'],
        titleVariants: [
            'Tu siguiente paso tras Omniscient Reader\'s Viewpoint',
            'Si ORV te dejo vacio, empieza por aqui',
            'Supervivencia con cerebro: en la linea de ORV'
        ],
        subtitleVariants: [
            'Buscamos obras con sensacion similar para mantenerte en ese mood.',
            'Curado para ese vacio post-ORV que todos conocemos.',
            'Misma adrenalina, nuevas historias para engancharte.'
        ],
        query: 'manhwas similares a omniscient reader supervivencia y escenarios'
    }
];

// Géneros reales del catálogo — se cruzan con genreIndexNormalized para resultados exactos
const GENRE_CAROUSEL_RULES = [
    {
        id: 'genre_accion',
        genreKeys: ['accion', 'action', 'aventura'],
        terms: ['accion', 'pelea', 'combate', 'lucha', 'batalla', 'dungeon', 'hunter', 'tower', 'espada', 'guerr', 'matar'],
        query: 'manhwas de accion combate y aventura',
        titleVariants: [
            'Lo mejor de acción según tu historial',
            'Acción sin parar: seleccionado para ti',
            'Tu dosis de acción: series que no puedes perderte'
        ],
        subtitleVariants: [
            'Detectamos que disfrutas la acción — aquí lo más destacado.',
            'Curado según tu perfil: combate, poder y adrenalina.',
            'Para cuando quieres acción sin rodeos ni relleno.'
        ]
    },
    {
        id: 'genre_romance',
        genreKeys: ['romance', 'shoujo', 'josei'],
        terms: ['romance', 'amor', 'pareja', 'matrimon', 'enamorad', 'espos', 'contrat', 'boda', 'celo', 'novio'],
        query: 'manhwas de romance y amor',
        titleVariants: [
            'Romance para tu mood: curado para ti',
            'Historias de amor que enganchan de verdad',
            'Lo mejor del romance manhwa para tu perfil'
        ],
        subtitleVariants: [
            'Notamos que el romance aparece en tu historial — esto es para ti.',
            'Seleccionamos los mejores romances según tu vibe actual.',
            'Si buscas tensión y corazones, estas son las obras.'
        ]
    },
    {
        id: 'genre_fantasia',
        genreKeys: ['fantasia', 'fantasy', 'isekai'],
        terms: ['fantasi', 'magia', 'mago', 'dragon', 'elfo', 'reino', 'hechicero', 'brujo', 'mundo magico', 'isekai'],
        query: 'manhwas de fantasia magia y mundos alternos',
        titleVariants: [
            'Mundos de fantasía que te van a atrapar',
            'Fantasía épica: lo mejor del género para ti',
            'Magia, reinos y aventura — tu nueva línea'
        ],
        subtitleVariants: [
            'Tu historial muestra gusto por la fantasía — aquí lo curado.',
            'Mundos construidos con detalle, magia y lore profundo.',
            'Para escapar a otro mundo completamente diferente.'
        ]
    },
    {
        id: 'genre_murim',
        genreKeys: ['murim', 'artes marciales', 'wuxia'],
        terms: ['murim', 'artes marcial', 'qi', 'cultiv', 'sect', 'clan', 'wuxia', 'xianxia', 'maestro'],
        query: 'manhwas murim artes marciales cultivo y poder',
        titleVariants: [
            'Murim puro: lo mejor del subgénero para ti',
            'Artes marciales y poder: curado según tu perfil',
            'El camino del guerrero: selección murim top'
        ],
        subtitleVariants: [
            'Detectamos afición por el murim — aquí lo esencial.',
            'Lo mejor de artes marciales y cultivo, reunido para ti.',
            'Para ese mood de puños, qi y ascensión imparable.'
        ]
    },
    {
        id: 'genre_apocalipsis',
        genreKeys: ['apocalipsis', 'supervivencia', 'zombies', 'post-apocaliptico'],
        terms: ['apocalip', 'superviv', 'zombie', 'fin del mundo', 'calamidad', 'monstruo', 'invasion', 'plaga'],
        query: 'manhwas de apocalipsis supervivencia y monstruos',
        titleVariants: [
            'El mundo colapsó: supervivencia al límite',
            'Apocalipsis y caos: curado para tu perfil',
            'Cuando todo se rompe: lo mejor del género'
        ],
        subtitleVariants: [
            'Tu historial apunta a supervivencia — armamos esto para ti.',
            'Escenarios extremos, personajes que no se rinden jamás.',
            'Para ese mood de caos, monstruos y voluntad de vivir.'
        ]
    },
    {
        id: 'genre_sistema',
        genreKeys: ['sistema', 'rpg', 'videojuego'],
        terms: ['sistem', 'nivel', 'rpg', 'status', 'habilidad', 'clase', 'raid', 'puntos', 'experiencia', 'pantall'],
        query: 'manhwas con sistema rpg nivel y habilidades',
        titleVariants: [
            'Sistemas y niveles: lo que más te gusta',
            'RPG real: ventanas de estado y poder sin límites',
            'Level up: manhwas con sistema para tu perfil'
        ],
        subtitleVariants: [
            'Notamos que disfrutas los sistemas — esto es lo mejor del género.',
            'Ventanas de estado, skills y crecimiento de personaje.',
            'Si te gusta el RPG en manhwa, esta fila es tuya.'
        ]
    }
];

const LAST_QUERY_TITLE_TEMPLATES = [
    'Basado en tu interés por "{query}"',
    'Más ideas relacionadas con "{query}" para ti',
    'Recomendaciones para tu búsqueda de "{query}"'
];

const LAST_QUERY_SUBTITLE_TEMPLATES = [
    'Te dejamos una seleccion afinada para que no pierdas tiempo.',
    'Elegimos recomendaciones que van directo con esa idea.',
    'Partimos de esa consulta para mostrarte lo mas cercano.'
];

const RECENT_QUERY_TITLE_TEMPLATES = [
    'Siguiendo tu vibe: {query}',
    'Tambien te podria enganchar: {query}',
    'Como buscaste esto, te puede gustar:'
];

const RECENT_QUERY_SUBTITLE_TEMPLATES = [
    'Tomamos tus intereses recientes y armamos esta fila para ti.',
    'Basado en lo que vienes explorando, esto encaja muy bien.',
    'Contenido curado desde tus ultimas consultas IA.'
];

function sanitizeIncomingHistory(rawHistory) {
    if (!Array.isArray(rawHistory)) return [];

    const seen = new Set();
    const cleaned = [];

    for (let i = 0; i < rawHistory.length; i++) {
        const raw = rawHistory[i];
        const item = (raw && typeof raw === 'object' ? String(raw.query || '') : String(raw || '')).trim();
        if (item.length < 3 || item.length > 220) continue;

        const key = normalizeQuery(item);
        if (!key || seen.has(key)) continue;

        seen.add(key);
        cleaned.push({ raw: item, key });
        if (cleaned.length >= 20) break;
    }

    return cleaned;
}

function resolveHistorySeries(queryText, queryKey, lang = DEFAULT_LANG) {
    const cached = getCachedSearchSmart(cacheKey(lang, queryKey));
    if (cached && cached.data) {
        const cachedSeries = cached.data.series || [];
        const normalized = cachedSeries.length > 0 && typeof cachedSeries[0] === 'object'
            ? sanitizeSeriesForResponse(cachedSeries)
            : sanitizeSeriesForResponse(cachedSeries.map(id => seriesCache.find(s => s.id === id)).filter(Boolean));

        if (normalized.length > 0) {
            return {
                series: normalized,
                source: cached.status === 'fresh' ? 'cache' : 'cache_stale'
            };
        }
    }

    const fallback = performFallbackSearch(queryText).slice(0, 15).map(r => r.item);
    return {
        series: sanitizeSeriesForResponse(fallback),
        source: 'fallback'
    };
}

function buildDynamicTitleForLastQuery(rawQuery) {
    const compact = String(rawQuery || '').replace(/\s+/g, ' ').trim();
    if (!compact) return 'Hecho para tu busqueda mas reciente';

    const shortQuery = compact.length > 92 ? `${compact.slice(0, 89)}...` : compact;
    const template = pickStableVariant(LAST_QUERY_TITLE_TEMPLATES, shortQuery);
    return template.replace('{query}', shortQuery);
}

function buildDynamicSubtitleForLastQuery(rawQuery) {
    const compact = String(rawQuery || '').replace(/\s+/g, ' ').trim();
    const key = compact || 'latest';
    return pickStableVariant(LAST_QUERY_SUBTITLE_TEMPLATES, key);
}

function buildDynamicRecentQueryTitle(rawQuery) {
    const compact = String(rawQuery || '').replace(/\s+/g, ' ').trim();
    if (!compact) return 'Otra linea que podria gustarte';

    const shortQuery = compact.length > 78 ? `${compact.slice(0, 75)}...` : compact;
    const template = pickStableVariant(RECENT_QUERY_TITLE_TEMPLATES, shortQuery);
    return template.includes('{query}') ? template.replace('{query}', shortQuery) : `${template} ${shortQuery}`;
}

function buildDynamicRecentQuerySubtitle(rawQuery) {
    const compact = String(rawQuery || '').replace(/\s+/g, ' ').trim();
    const key = compact || 'recent';
    return pickStableVariant(RECENT_QUERY_SUBTITLE_TEMPLATES, key);
}

function pickStableVariant(variants, seedText) {
    const list = Array.isArray(variants) ? variants.filter(Boolean) : [];
    if (list.length === 0) return '';

    let hash = 0;
    const seed = String(seedText || 'seed');
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }

    const idx = Math.abs(hash) % list.length;
    return list[idx];
}

function scoreTopicRule(rule, historyKeys) {
    let score = 0;
    for (let i = 0; i < historyKeys.length; i++) {
        const key = historyKeys[i];
        for (let j = 0; j < rule.terms.length; j++) {
            if (key.includes(rule.terms[j])) {
                score += 1;
                break;
            }
        }
    }
    return score;
}

function resolveGenreSeries(genreKeys, limit) {
    const seen = new Set();
    const results = [];

    for (const key of genreKeys) {
        const normKey = cleanText(translateGenreToEs(key));
        const bucket = genreIndexNormalized[normKey] || [];
        for (const s of bucket) {
            if (!seen.has(s.id)) {
                seen.add(s.id);
                results.push(s);
            }
        }
    }

    if (results.length === 0) return [];

    // Rotación diaria para frescura: desplazar el array según el día del mes
    const dayOffset = new Date().getDate() % Math.max(1, results.length);
    const rotated = [...results.slice(dayOffset), ...results.slice(0, dayOffset)];

    return sanitizeSeriesForResponse(rotated.slice(0, limit));
}

// Endpoint orientado al Home: genera carruseles distintos por historial reciente del usuario/dispositivo
app.post('/api/personalized-carousels', (req, res) => {
    try {
        const body = req.body || {};
        const reqLang = getRequestLang(req);
        const safeLimitRows = Math.min(10, Math.max(1, parseInt(body.limitRows, 10) || 3));
        const safeLimitItems = Math.min(15, Math.max(3, parseInt(body.limitItems, 10) || 8));
        const history = sanitizeIncomingHistory(body.history);

        if (history.length === 0) {
            return res.json({ success: true, carousels: [] });
        }

        const latest = history[0];
        const historyKeys = history.map(h => h.key);
        const rows = [];
        const usedQueries = new Set();

        // Carrusel principal: ultima busqueda del usuario
        const latestResolved = resolveHistorySeries(latest.raw, latest.key, reqLang);
        if (latestResolved.series.length > 0) {
            rows.push({
                type: 'latest_query',
                title: buildDynamicTitleForLastQuery(latest.raw),
                subtitle: buildDynamicSubtitleForLastQuery(latest.raw),
                query: latest.raw,
                source: latestResolved.source,
                series: latestResolved.series.slice(0, safeLimitItems)
            });
            usedQueries.add(normalizeQuery(latest.raw));
        }

        // Carrusel evolutivo: detectar patron en ultimas consultas
        const rankedRules = PERSONALIZED_TOPIC_RULES
            .map(rule => ({ rule, score: scoreTopicRule(rule, historyKeys.slice(0, 8)) }))
            .filter(entry => entry.score >= entry.rule.minHits)
            .sort((a, b) => b.score - a.score);

        for (let i = 0; i < rankedRules.length && rows.length < safeLimitRows; i++) {
            const candidate = rankedRules[i].rule;
            const candidateKey = normalizeQuery(candidate.query);
            if (usedQueries.has(candidateKey)) continue;

            const resolved = resolveHistorySeries(candidate.query, candidateKey, reqLang);
            if (resolved.series.length < 3) continue;

            const humanTitle = pickStableVariant(candidate.titleVariants, `${candidate.id}:${latest.key}`) || candidate.title;
            const humanSubtitle = pickStableVariant(candidate.subtitleVariants, `${candidate.id}:${latest.key}`) || 'Basado en el patron de tus ultimas busquedas';

            rows.push({
                type: candidate.id,
                title: humanTitle,
                subtitle: humanSubtitle,
                query: candidate.query,
                source: resolved.source,
                series: resolved.series.slice(0, safeLimitItems)
            });
            usedQueries.add(candidateKey);
        }

        // Carruseles de género: solo géneros que el historial indica que le gustan al usuario
        const rankedGenres = GENRE_CAROUSEL_RULES
            .map(rule => ({ rule, score: scoreTopicRule(rule, historyKeys.slice(0, 8)) }))
            .filter(entry => entry.score >= 1)
            .sort((a, b) => b.score - a.score);

        for (let i = 0; i < rankedGenres.length && rows.length < safeLimitRows; i++) {
            const candidate = rankedGenres[i].rule;
            if (usedQueries.has(candidate.id)) continue;

            const genreSeries = resolveGenreSeries(candidate.genreKeys, safeLimitItems);
            if (genreSeries.length < 3) continue;

            const humanTitle = pickStableVariant(candidate.titleVariants, `${candidate.id}:${latest.key}`);
            const humanSubtitle = pickStableVariant(candidate.subtitleVariants, `${candidate.id}:${latest.key}`);

            rows.push({
                type: candidate.id,
                title: humanTitle,
                subtitle: humanSubtitle,
                query: candidate.query,
                source: 'genre_index',
                series: genreSeries
            });
            usedQueries.add(candidate.id);
        }

        // Relleno: consultas recientes restantes para no dejar vacio
        for (let i = 1; i < history.length && rows.length < safeLimitRows; i++) {
            const item = history[i];
            if (usedQueries.has(item.key)) continue;

            const resolved = resolveHistorySeries(item.raw, item.key, reqLang);
            if (resolved.series.length < 3) continue;

            rows.push({
                type: 'recent_query',
                title: buildDynamicRecentQueryTitle(item.raw),
                subtitle: buildDynamicRecentQuerySubtitle(item.raw),
                query: item.raw,
                source: resolved.source,
                series: resolved.series.slice(0, safeLimitItems)
            });
            usedQueries.add(item.key);
        }

        return res.json({ success: true, carousels: rows });
    } catch (err) {
        logger.error('Error en /api/personalized-carousels', err);
        return res.status(500).json({ success: false, error: 'Error interno generando carruseles personalizados', carousels: [] });
    }
});

// --- ENDPOINTS DE HISTORIAL DE CONSULTAS ---

// Listar todas las consultas guardadas, ordenadas por popularidad (rank 1 = más popular)
// Soporta ?lang=es|en|all — por defecto usa el del request (es).
app.get('/api/queries', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const rawLang = (req.query.lang || '').toString().toLowerCase().trim();
    const scope = rawLang === 'all' ? 'all' : getRequestLang(req);

    // Ordenar bajo demanda y paginar
    const source = scope === 'all'
        ? [
            ...H('es').map(q => ({ ...q, lang: 'es' })),
            ...H('en').map(q => ({ ...q, lang: 'en' })),
        ]
        : H(scope).map(q => ({ ...q, lang: scope }));

    const sorted = [...source].sort((a, b) => (b.count || 0) - (a.count || 0));
    const slice = sorted.slice(offset, offset + limit).map((q, i) => ({
        rank: offset + i + 1,
        ...q
    }));

    res.json({
        success: true,
        lang: scope,
        total: source.length,
        maxCapacity: MAX_QUERY_HISTORY,
        page,
        limit,
        queries: slice
    });
});

// Eliminar una consulta específica por ID. Busca en ambos idiomas.
app.delete('/api/queries/:id', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });

    const { id } = req.params;
    let deletedLang = null;
    for (const L of ['es', 'en']) {
        const before = H(L).length;
        const next = H(L).filter(q => q.id !== id);
        if (next.length !== before) {
            setH(L, next);
            deletedLang = L;
            saveQueryHistoryAsyncFor(L).catch(err => logger.warn('Error guardando historial tras delete', { lang: L, error: err && err.message }));
            break;
        }
    }

    if (!deletedLang) return res.status(404).json({ success: false, error: 'Consulta no encontrada' });

    logger.info('🗑️ Consulta eliminada del historial', { id, lang: deletedLang });
    res.json({ success: true, deleted: true, id, lang: deletedLang });
});

// Limpiar historial de consultas. Por defecto solo el idioma del request; ?lang=all para ambos.
app.post('/api/queries/clear', (req, res) => {
    const auth = requireAdmin(req, res);
    if (!auth.ok) return res.status(403).json({ success: false, error: auth.msg });

    const rawLang = (req.query.lang || req.body?.lang || '').toString().toLowerCase().trim();
    const scope = rawLang === 'all' ? 'all' : getRequestLang(req);

    const targets = scope === 'all' ? ['es', 'en'] : [scope];
    let total = 0;
    for (const L of targets) {
        total += H(L).length;
        setH(L, []);
        saveQueryHistoryAsyncFor(L).catch(err => logger.warn('Error guardando historial tras clear', { lang: L, error: err && err.message }));
    }
    logger.info('🗑️ Historial de consultas limpiado', { scope, deleted: total });
    res.json({ success: true, lang: scope, deleted: total });
});

// --- CONFIGURACIÓN OPTIMIZADA ---
const AI_MODEL = process.env.AI_MODEL || 'gpt-5-nano-2025-08-07';
const AI_RETRIES = parseInt(process.env.AI_RETRIES, 10) || 2;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

// URL de la API de OpenAI
// Builder del system prompt por idioma. `search_semantic` SIEMPRE se expresa en español
// porque el catálogo y los embeddings están indexados en español — eso no cambia con el
// idioma del usuario. Lo que SÍ cambia es el texto de `reason` (se devuelve al usuario)
// y las palabras-gatillo que se reconocen en la query (negaciones, "new", "+18", etc.).
const SYSTEM_PROMPT_BY_LANG = {
    es: `Role: DB Search Optimizer. Output: ONLY valid JSON.
Task: Analyze user query and extract search parameters for a Manhwa DB.
DB Context: Consider concepts related to title, synopsis, genres, themes, tone, narrativeTropes, protagonistType, powerSystem, artStyle, targetDemographic, romanceLevel, status, isAdult, isNew.

Rules:
1. search_semantic: Condense the query into highly relevant Spanish keywords targeting plot, tropes, protagonist traits, or power systems (e.g., "venganza sistema regreso op debil"). ALWAYS in Spanish, regardless of the user's input language, because the database is indexed in Spanish.
2. genres: Array of recognized genres in the query (Spanish names).
3. exclude_terms: Array of concepts to exclude based on negations ("sin", "no", "excepto", "cero", "without", "except", "no", "not", "avoid", "exclude").
4. sort: Map purely to "views", "rating", or "year" if requested. Else empty.
5. "Similar to [Title]" / "Parecido a [Title]": Do NOT search the title. Instead, extract its core tropes/themes into search_semantic.
6. Flags: If user asks for "nuevos"/"new"/"recent" add "nuevo" to search_semantic. If they ask for "+18"/"adult", add "adulto".

7. reason: Write a SHORT friendly explanation (1 sentence) IN SPANISH telling the user WHY these results were chosen. Example: "Busqué manhwas de acción donde el protagonista busca venganza y empieza siendo débil." Do NOT be technical, write as if talking to a friend.

Schema:
{"filter":{"genres":[],"search_semantic":"string","exclude_terms":[]},"sort":"string","reason":"string"}`,

    en: `Role: DB Search Optimizer. Output: ONLY valid JSON.
Task: Analyze user query and extract search parameters for a Manhwa DB.
DB Context: Consider concepts related to title, synopsis, genres, themes, tone, narrativeTropes, protagonistType, powerSystem, artStyle, targetDemographic, romanceLevel, status, isAdult, isNew.

Rules:
1. search_semantic: Condense the query into highly relevant SPANISH keywords (the database is indexed in Spanish) targeting plot, tropes, protagonist traits, or power systems (e.g., "venganza sistema regreso op debil"). Translate English concepts into Spanish keywords: revenge→venganza, system→sistema, regression→regresion, weak→debil, overpowered→op, hunter→cazador, tower→torre, dungeon→mazmorra, reincarnation→reencarnacion, villain→villano, apocalypse→apocalipsis, survival→supervivencia, martial arts→artes marciales, cultivation→cultivacion, necromancer→nigromante, assassin→asesino.
2. genres: Array of recognized genres in the query (output in Spanish: accion, romance, fantasia, terror, misterio, comedia, aventura, murim, ciencia ficcion, etc.).
3. exclude_terms: Array of concepts to exclude based on negations ("without", "except", "no", "not", "avoid", "exclude", "sin", "no", "excepto"). Output the terms in Spanish.
4. sort: Map purely to "views", "rating", or "year" if requested. Else empty.
5. "Similar to [Title]" / "Like [Title]": Do NOT search the title. Instead, extract its core tropes/themes into search_semantic (in Spanish).
6. Flags: If user asks for "new"/"recent"/"nuevos" add "nuevo" to search_semantic. If they ask for "+18"/"adult"/"mature", add "adulto".

7. reason: Write a SHORT friendly explanation (1 sentence) IN ENGLISH telling the user WHY these results were chosen. Example: "I looked for action manhwas where the protagonist seeks revenge and starts out weak." Do NOT be technical, write as if talking to a friend.

Schema:
{"filter":{"genres":[],"search_semantic":"string","exclude_terms":[]},"sort":"string","reason":"string"}`,
};

function getSystemPrompt(lang) {
    return SYSTEM_PROMPT_BY_LANG[normalizeLang(lang)] || SYSTEM_PROMPT_BY_LANG[DEFAULT_LANG];
}
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

async function callAIWorker(userMsg, retries = AI_RETRIES, externalSignal = null, lang = DEFAULT_LANG) {
    try {
        const systemPrompt = getSystemPrompt(lang);
        const prompt = `${systemPrompt}\n\nUser query: ${userMsg}`;
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
async function callAI(userMsg, retries = AI_RETRIES, externalSignal = null, lang = DEFAULT_LANG) {
    return Promise.race([
        callAIWorker(userMsg, retries, externalSignal, lang),
        new Promise((resolve) => setTimeout(() => {
            logger.warn('Timeout en llamada IA', { query: userMsg, lang });
            resolve(null);
        }, AI_CALL_TIMEOUT))
    ]);
}

const PORT = process.env.PORT || 3003;

// --- GESTIÓN UNIFICADA DE PERSISTENCIA ---

// Particiona entries del searchCache según el prefijo de idioma de la clave
// (cacheKey(lang, key) → "es:..." o "en:..."). Entradas legacy sin prefijo
// se ignoran al guardar (evita propagar keys sin scoping).
function partitionCacheEntriesByLang() {
    const buckets = { es: [], en: [] };
    for (const [k, v] of searchCache.entries()) {
        if (typeof k !== 'string') continue;
        const sep = k.indexOf(':');
        if (sep <= 0) continue;
        const prefix = k.slice(0, sep);
        if (buckets[prefix]) buckets[prefix].push([k, v]);
    }
    return buckets;
}

// Aplica una entrada ya cargada al searchCache respetando TTL/persist.
function applyLoadedCacheEntry(key, val, now) {
    if (val && val.persist) {
        searchCache.set(key, val, { ttl: 0 });
        return true;
    }
    const hardCutoff = 1000 * 60 * 60 * 24; // 24h
    if (now - (val.timestamp || 0) < hardCutoff) {
        const remainingTtl = Math.max(0, (val.ttl || SEARCH_CACHE_TTL) - (now - (val.timestamp || 0)));
        searchCache.set(key, val, { ttl: remainingTtl || SEARCH_CACHE_TTL });
        return true;
    }
    return false;
}

// Carga síncrona (Solo para el inicio del servidor)
function loadCacheSync() {
    const now = Date.now();
    let loaded = 0;
    try {
        for (const lang of SUPPORTED_LANGS) {
            const file = CACHE_FILES[lang];
            if (!fs.existsSync(file)) continue;
            try {
                const rawEntries = JSON.parse(fs.readFileSync(file, 'utf8'));
                for (const [key, val] of rawEntries) {
                    // Defensa: solo aceptar entradas cuya key empiece con el lang del archivo
                    if (typeof key !== 'string' || !key.startsWith(`${lang}:`)) continue;
                    if (applyLoadedCacheEntry(key, val, now)) loaded++;
                }
            } catch (err) {
                logger.error('Error leyendo caché por idioma', { lang, error: err && err.message });
            }
        }

        // Migración legacy: si aún existe el archivo pre-split, rellenar con prefijo 'es'
        // (asumimos que todo el legacy era ES, que es el default histórico).
        if (loaded === 0 && fs.existsSync(CACHE_FILE_PATH_LEGACY)) {
            try {
                const rawEntries = JSON.parse(fs.readFileSync(CACHE_FILE_PATH_LEGACY, 'utf8'));
                for (const [key, val] of rawEntries) {
                    const scoped = (typeof key === 'string' && key.includes(':'))
                        ? key
                        : `${DEFAULT_LANG}:${key}`;
                    if (applyLoadedCacheEntry(scoped, val, now)) loaded++;
                }
                logger.info('📂 Migración legacy → caché separada aplicada', { migrated: loaded });
            } catch (err) {
                logger.error('Error migrando caché legacy', err);
            }
        }

        logger.info('📂 Caché cargada desde disco (Sync)', { loaded });
    } catch (err) {
        logger.error('Error cargando caché desde disco', err);
    }
}

// Guardado asíncrono (Para el intervalo periódico)
async function saveCacheAsync() {
    try {
        const buckets = partitionCacheEntriesByLang();
        let total = 0;
        await Promise.all(SUPPORTED_LANGS.map(async (lang) => {
            const entries = buckets[lang] || [];
            total += entries.length;
            await fs.promises.writeFile(CACHE_FILES[lang], JSON.stringify(entries));
        }));
        logger.info('💾 Caché guardada (Async)', { entries: total, byLang: { es: buckets.es.length, en: buckets.en.length } });
    } catch (e) {
        logger.error('Error en guardado periódico', e);
    }
}

// Guardado síncrono (Solo para emergencias/apagado)
function saveCacheSync() {
    try {
        const buckets = partitionCacheEntriesByLang();
        let total = 0;
        for (const lang of SUPPORTED_LANGS) {
            const entries = buckets[lang] || [];
            total += entries.length;
            fs.writeFileSync(CACHE_FILES[lang], JSON.stringify(entries));
        }
        logger.info('💾 Caché guardada (Sync - Shutdown)', { entries: total });
    } catch (e) {
        logger.error('Error guardando caché al cerrar', e);
    }
}

// --- HISTORIAL DE CONSULTAS PERSISTENTE ---
function generateQueryId() {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function deduplicateQueryHistoryFor(lang) {
    const list = H(lang);
    const seen = new Map(); // key -> index in deduplicated array
    const deduplicated = [];
    let mergedCount = 0;

    for (const entry of list) {
        if (!entry || !entry.key) { deduplicated.push(entry); continue; }
        const existingIdx = seen.get(entry.key);
        if (existingIdx !== undefined) {
            // Merge: sumar counts, mantener el más reciente
            const existing = deduplicated[existingIdx];
            existing.count = (existing.count || 0) + (entry.count || 0);
            if (entry.lastSeen > existing.lastSeen) {
                existing.lastSeen = entry.lastSeen;
                existing.lastResultCount = entry.lastResultCount;
                existing.lastSource = entry.lastSource;
                existing.resultTitles = entry.resultTitles;
                existing.explanation = entry.explanation || existing.explanation;
            }
            mergedCount++;
        } else {
            seen.set(entry.key, deduplicated.length);
            deduplicated.push(entry);
        }
    }

    if (mergedCount > 0) {
        setH(lang, deduplicated);
        logger.info('🧹 Duplicados fusionados en historial', { lang: normalizeLang(lang), merged: mergedCount, after: deduplicated.length });
    }
}

function deduplicateQueryHistory() {
    deduplicateQueryHistoryFor('es');
    deduplicateQueryHistoryFor('en');
}

function sanitizeHistoryEntry(e) {
    if (!e || typeof e !== 'object') return null;
    if (typeof e.query !== 'string' || !e.query.trim()) return null;
    return {
        id: typeof e.id === 'string' ? e.id : generateQueryId(),
        query: e.query,
        key: typeof e.key === 'string' ? e.key : cleanText(e.query),
        count: Number.isFinite(e.count) && e.count > 0 ? e.count : 1,
        source: typeof e.source === 'string' ? e.source : 'unknown',
        lastSource: typeof e.lastSource === 'string' ? e.lastSource : (e.source || 'unknown'),
        lastResultCount: Number.isFinite(e.lastResultCount) ? e.lastResultCount : 0,
        explanation: typeof e.explanation === 'string' ? e.explanation : '',
        resultTitles: Array.isArray(e.resultTitles) ? e.resultTitles.slice(0, 10) : [],
        firstSeen: typeof e.firstSeen === 'string' ? e.firstSeen : (e.lastSeen || new Date().toISOString()),
        lastSeen: typeof e.lastSeen === 'string' ? e.lastSeen : new Date().toISOString(),
    };
}

function loadQueryHistory() {
    // Cargar cada idioma desde su archivo
    let anyLoaded = false;
    for (const lang of SUPPORTED_LANGS) {
        try {
            const file = QUERY_HISTORY_FILES[lang];
            // Limpiar tmp huérfanos de crashes previos
            try {
                const dir = path.dirname(file);
                const base = path.basename(file);
                const entries = fs.readdirSync(dir);
                for (const f of entries) {
                    if (f.startsWith(`${base}.`) && f.endsWith('.tmp')) {
                        try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignore */ }
                    }
                }
            } catch { /* ignore */ }

            if (fs.existsSync(file)) {
                const raw = fs.readFileSync(file, 'utf8');
                let parsed;
                try { parsed = JSON.parse(raw || '[]'); }
                catch (parseErr) {
                    logger.error('Historial corrupto; moviendo a .bak', { lang, error: parseErr && parseErr.message });
                    try { fs.renameSync(file, `${file}.corrupt.${Date.now()}.bak`); } catch { /* ignore */ }
                    parsed = [];
                }
                const sanitized = (Array.isArray(parsed) ? parsed : [])
                    .map(sanitizeHistoryEntry)
                    .filter(Boolean);
                setH(lang, sanitized);
                logger.info('📂 Historial cargado', { lang, count: H(lang).length });
                anyLoaded = true;
            }
        } catch (err) {
            logger.error(`Error cargando historial ${lang}`, err);
            setH(lang, []);
        }
    }

    // Migración legacy: si no existen los nuevos archivos pero SÍ el antiguo
    // `query_history.json`, cargarlo como ES (comportamiento previo a i18n).
    if (!anyLoaded && fs.existsSync(QUERY_HISTORY_FILE_LEGACY)) {
        try {
            const data = fs.readFileSync(QUERY_HISTORY_FILE_LEGACY, 'utf8');
            const parsed = JSON.parse(data || '[]');
            setH('es', Array.isArray(parsed) ? parsed : []);
            logger.info('📂 Historial legacy migrado a ES', { count: H('es').length });
        } catch (err) {
            logger.error('Error migrando historial legacy', err);
        }
    }

    deduplicateQueryHistory();
}

// --- ESCRITURA ATÓMICA (tmp + rename) + MUTEX POR IDIOMA ---
// Garantiza que un crash o escritura concurrente nunca deje el archivo corrupto.
// El mutex serializa las escrituras del mismo idioma; los idiomas no se bloquean entre sí.
const historySaveLocks = { es: Promise.resolve(), en: Promise.resolve() };

async function atomicWriteJSON(filePath, data) {
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    let fh;
    try {
        fh = await fs.promises.open(tmp, 'w');
        await fh.writeFile(payload, 'utf8');
        // fsync para asegurar que el contenido está en disco antes del rename
        try { await fh.sync(); } catch { /* algunos FS no soportan fsync */ }
    } finally {
        if (fh) { try { await fh.close(); } catch { /* ignore */ } }
    }
    // rename es atómico en el mismo FS; reemplaza el destino
    await fs.promises.rename(tmp, filePath);
}

async function saveQueryHistoryAsyncFor(lang) {
    const L = normalizeLang(lang);
    // Encadenar con el lock previo de este idioma para serializar escrituras
    const prev = historySaveLocks[L];
    let release;
    historySaveLocks[L] = new Promise(res => { release = res; });
    try {
        await prev; // esperar al anterior
        const snapshot = [...H(L)]; // snapshot inmutable del estado actual
        await atomicWriteJSON(QUERY_HISTORY_FILES[L], snapshot);
    } catch (err) {
        logger.error('Error guardando historial', { lang: L, error: err && err.message });
    } finally {
        release();
    }
}

async function saveQueryHistoryAsync() {
    await Promise.all([saveQueryHistoryAsyncFor('es'), saveQueryHistoryAsyncFor('en')]);
}

// --- GUARDADO SEGURO CON DEBOUNCE (por idioma) ---
const historySaveTimeouts = { es: null, en: null };
const HISTORY_SAVE_DEBOUNCE_MS = 5000;
// Watchdog: si un idioma acumula muchas escrituras pendientes, forzar flush
const historyPendingWrites = { es: 0, en: 0 };
const HISTORY_FORCE_FLUSH_AT = 50;

function scheduleHistorySave(lang) {
    const L = normalizeLang(lang);
    historyPendingWrites[L]++;

    // Flush inmediato si hay demasiadas escrituras acumuladas
    if (historyPendingWrites[L] >= HISTORY_FORCE_FLUSH_AT) {
        if (historySaveTimeouts[L]) { clearTimeout(historySaveTimeouts[L]); historySaveTimeouts[L] = null; }
        historyPendingWrites[L] = 0;
        saveQueryHistoryAsyncFor(L)
            .then(() => logger.info('💾 Historial guardado (force-flush)', { lang: L }))
            .catch(e => logger.error('Error force-flush historial', { lang: L, error: e && e.message }));
        return;
    }

    if (historySaveTimeouts[L]) clearTimeout(historySaveTimeouts[L]);
    historySaveTimeouts[L] = setTimeout(async () => {
        historyPendingWrites[L] = 0;
        historySaveTimeouts[L] = null;
        try {
            await saveQueryHistoryAsyncFor(L);
            logger.info('💾 Historial guardado (debounce)', { lang: L });
        } catch (e) {
            logger.error('Error IO guardando historial', { lang: L, error: e && e.message });
        }
    }, HISTORY_SAVE_DEBOUNCE_MS);
}

function saveQueryHistorySync() {
    // Cancelar debounces pendientes al hacer guardado síncrono (shutdown)
    for (const L of SUPPORTED_LANGS) {
        if (historySaveTimeouts[L]) { clearTimeout(historySaveTimeouts[L]); historySaveTimeouts[L] = null; }
        historyPendingWrites[L] = 0;
        try {
            // Escritura sync atómica con rename
            const tmp = `${QUERY_HISTORY_FILES[L]}.${process.pid}.sync.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(H(L), null, 2));
            fs.renameSync(tmp, QUERY_HISTORY_FILES[L]);
        } catch (err) {
            logger.error('Error guardando historial (sync)', { lang: L, error: err && err.message });
        }
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

// --- Métricas por idioma (para debug y health) ---
const langMetrics = {
    es: { recorded: 0, mismatchWarnings: 0, lastRecordedAt: null },
    en: { recorded: 0, mismatchWarnings: 0, lastRecordedAt: null },
};

// --- Registro de consultas: ranking, deduplicación y persistencia ---
// Las consultas se guardan en el historial del idioma del request (ES/EN) para que
// populares, trending, related y after-search nunca se crucen entre idiomas.
function recordQuery(rawQuery, key, payload, req) {
    try {
        if (!rawQuery || typeof rawQuery !== 'string') return;

        let lang = getRequestLang(req);

        // Guardia anti-contaminación: si el idioma declarado parece no coincidir con
        // el contenido (inferencia fuerte en sentido contrario), logueamos y preferimos
        // el idioma inferido para NO mezclar consultas en el bucket equivocado.
        const inferred = inferLangFromText(rawQuery);
        if (inferred && inferred !== lang) {
            langMetrics[lang].mismatchWarnings++;
            logger.warn('🌐 Lang mismatch — reasignando por contenido', {
                declared: lang,
                inferred,
                query: rawQuery.slice(0, 80)
            });
            lang = inferred;
        }

        const queryHistory = H(lang);

        const qKey = key || cleanText(rawQuery || '');
        const resultCount = (payload && payload.series) ? payload.series.length : 0;
        const source = (payload && payload.source) || 'unknown';
        const ts = new Date().toISOString();
        const resultTitles = (payload && payload.series || []).slice(0, 5).map(s => s.title || s.id);

        // Asegurar que la entrada se persista en searchCache (scoped por idioma)
        try {
            setCachedSearch(cacheKey(lang, qKey), payload, undefined, true);
        } catch (e) {
            logger.warn('setCachedSearch falló en recordQuery', { error: e && e.message });
        }

        // Agrupamiento: primero match exacto con mayor count, luego fuzzy
        let bestMatchIdx = -1;
        let highestSim = 0;
        let bestMatchCount = -1;

        // Match exacto: si hay duplicados, elegir el de mayor count
        for (let i = 0; i < queryHistory.length; i++) {
            if (queryHistory[i] && queryHistory[i].key === qKey) {
                const c = queryHistory[i].count || 0;
                if (c > bestMatchCount) {
                    bestMatchIdx = i;
                    bestMatchCount = c;
                    highestSim = 1.0;
                }
            }
        }

        // Si no hay match exacto, buscar fuzzy en el historial del mismo idioma
        if (bestMatchIdx === -1) {
            for (let i = 0; i < queryHistory.length; i++) {
                if (!queryHistory[i] || !queryHistory[i].key) continue;
                const sim = getSimilarityScore(queryHistory[i].key, qKey);
                if (sim > highestSim) {
                    highestSim = sim;
                    bestMatchIdx = i;
                }
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

            logger.info('🔍 Consulta agrupada (fuzzy)', {
                lang,
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
            // Si ya alcanzamos el límite (por idioma), eliminar la menos popular
            let evicted = null;
            if (queryHistory.length >= MAX_QUERY_HISTORY) {
                evicted = queryHistory.pop();
                logger.info('🗑️ Consulta menos popular eliminada por límite', {
                    lang,
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
                lang,
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

        // Registrar patrón de navegación colectiva (after-search) — separado por idioma
        try {
            const deviceId = getRequestDeviceId(req);
            if (deviceId) recordAfterSearchEvent(deviceId, qKey, rawQuery, lang);
        } catch (e) {
            logger.warn('recordAfterSearchEvent falló', { error: e && e.message });
        }

        // Métricas por idioma
        langMetrics[lang].recorded++;
        langMetrics[lang].lastRecordedAt = new Date().toISOString();

        // Persistir historial con debounce (un timer por idioma)
        scheduleHistorySave(lang);
        saveCacheAsync().catch(err => logger.warn('saveCacheAsync falló tras recordQuery', { error: err && err.message }));
        // Notificar solo a clientes SSE del idioma que cambió
        broadcastPopular(lang);
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

    server.listen(PORT, () => {
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
    saveAfterSearchSync();

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

const SYNONYMS_ES = {
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

// SYNONYMS_EN: expand English triggers to Spanish keywords (DB is ES-indexed)
const SYNONYMS_EN = {
    'school': 'escolar school',
    'teacher': 'escolar profesor',
    'teachers': 'escolar profesor',
    'student': 'escolar estudiante',
    'students': 'escolar estudiante',
    'college': 'universidad escolar',
    'university': 'universidad escolar',
    'love': 'romance amor love',
    'romance': 'romance amor',
    'boyfriend': 'romance novio',
    'girlfriend': 'romance novia',
    'fight': 'accion pelea fight',
    'fights': 'accion pelea',
    'fighting': 'accion pelea',
    'battle': 'accion pelea batalla',
    'battles': 'accion pelea batalla',
    'action': 'accion action',
    'adventure': 'aventura adventure',
    'horror': 'terror horror',
    'fear': 'terror miedo',
    'scary': 'terror',
    'magic': 'magia fantasia magic',
    'wizard': 'magia mago fantasia',
    'witch': 'magia bruja fantasia',
    'sorcery': 'magia hechiceria fantasia',
    'superpower': 'fantasia poder superpoderes',
    'superpowers': 'fantasia poder superpoderes',
    'friendship': 'amistad drama',
    'family': 'familia drama',
    'time travel': 'regresion viajes en el tiempo',
    'time-travel': 'regresion',
    'timetravel': 'regresion',
    'back in time': 'regresion',
    'go back': 'regresion',
    'return': 'regresion regreso',
    'returning': 'regresion',
    'regression': 'regresion regression',
    'robot': 'ciencia ficcion robot',
    'robots': 'ciencia ficcion robot',
    'sci-fi': 'ciencia ficcion sci-fi',
    'scifi': 'ciencia ficcion',
    'science fiction': 'ciencia ficcion',
    // Fantasy classes / tropes
    'necromancer': 'nigromante necromancia muertos invocador oscuro undead dark',
    'necromancy': 'nigromante necromancia muertos invocador oscuro undead',
    'undead': 'no-muertos undead zombie',
    'summoner': 'invocador invocacion summoner',
    'assassin': 'asesino sombras sigilo oscuro assassin',
    'vampire': 'vampiro sangre oscuro terror vampire',
    'zombie': 'zombie no-muertos terror apocalipsis',
    'zombies': 'zombie no-muertos terror apocalipsis',
    'demon': 'demonio oscuro infierno diablo demon',
    'demons': 'demonio oscuro infierno diablo',
    'devil': 'demonio diablo devil',
    'hunter': 'cazador hunter dungeon mazmorra',
    'hunters': 'cazador hunter dungeon',
    'dungeon': 'mazmorra dungeon tower',
    'dungeons': 'mazmorra dungeon',
    'tower': 'torre tower escalada',
    'cultivation': 'cultivation cultivacion murim artes marciales qi',
    'murim': 'murim cultivation artes marciales qi',
    'martial arts': 'artes marciales murim cultivation',
    'martial-arts': 'artes marciales murim',
    'op': 'overpowered fuerte poderoso op',
    'overpowered': 'op fuerte poderoso overpowered',
    'reincarnation': 'reencarnacion isekai otro mundo reincarnation',
    'reincarnated': 'reencarnacion isekai otro mundo',
    'isekai': 'reencarnacion otro mundo transmigration isekai',
    'transmigration': 'reencarnacion transmigration isekai otro mundo',
    'transmigrated': 'reencarnacion transmigration isekai',
    'another world': 'reencarnacion isekai otro mundo',
    'other world': 'reencarnacion isekai otro mundo',
    'guild': 'gremio guild aventurero',
    'revenge': 'venganza revenge',
    'vengeance': 'venganza vengeance',
    'system': 'sistema system',
    'leveling': 'nivelar subir nivel leveling',
    'level up': 'subir nivel leveling',
    'levelup': 'subir nivel leveling',
    'villain': 'villano villain antagonista',
    'villainess': 'villana villainess',
    'noble': 'noble nobleza',
    'kingdom': 'reino kingdom',
    'empire': 'imperio empire',
    'prince': 'principe prince',
    'princess': 'princesa princess',
    'knight': 'caballero knight',
    'monster': 'monstruo monster',
    'monsters': 'monstruo monster',
    'dragon': 'dragon',
    'dragons': 'dragon',
    'elf': 'elfo elf',
    'elves': 'elfo elf',
    'beast': 'bestia beast',
    'god': 'dios god deidad',
    'goddess': 'diosa goddess deidad',
    'apocalypse': 'apocalipsis apocalypse',
    'post-apocalyptic': 'apocalipsis post-apocaliptico',
    'regressor': 'regresion regressor',
    'tragedy': 'tragedia tragedy',
    'psychological': 'psicologico psychological',
    'mystery': 'misterio mystery',
    'thriller': 'suspenso thriller',
    'comedy': 'comedia comedy',
    'slice of life': 'slice of life cotidiano'
};

const SYNONYMS_BY_LANG = { es: SYNONYMS_ES, en: SYNONYMS_EN };

function enrichQuery(text, lang = DEFAULT_LANG) {
    const userLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    // Merge: user's language dict takes priority, ES fallback catches any ES keywords present
    const merged = userLang === 'es'
        ? SYNONYMS_ES
        : Object.assign({}, SYNONYMS_ES, SYNONYMS_BY_LANG[userLang] || {});
    let enriched = text;
    const lower = text.toLowerCase();
    Object.keys(merged).forEach(key => {
        if (lower.includes(key)) {
            enriched += ' ' + merged[key];
        }
    });
    return enriched;
}

// Stopwords per language — conservative: only pure greetings/courtesy words
const STOP_WORDS_ES = new Set([
    'hola', 'hey', 'buenas', 'oye', 'porfa', 'porfavor', 'por', 'favor',
    'bro', 'amigo', 'mano', 'wey', 'compa',
    'recomendacion', 'recomendame', 'recomiendame',
    'dame', 'dime', 'necesito', 'quiero', 'busco',
    'puedes', 'podrias', 'seria', 'gracias', 'thanks',
    'los', 'las', 'unos', 'unas', 'del', 'al'
]);

const STOP_WORDS_EN = new Set([
    'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'hiya',
    'please', 'pls', 'plz', 'thanks', 'thank', 'thx', 'ty',
    'bro', 'dude', 'man', 'bruh', 'mate', 'fam',
    'recommend', 'recommendation', 'recommendations', 'suggest', 'suggestion', 'suggestions',
    'give', 'gimme', 'tell', 'show', 'find',
    'want', 'need', 'looking', 'searching', 'search',
    'can', 'could', 'would', 'should', 'please',
    'the', 'some', 'any', 'any', 'for', 'me'
]);

const STOP_WORDS_BY_LANG = { es: STOP_WORDS_ES, en: STOP_WORDS_EN };

function cleanInputForAI(text, lang = DEFAULT_LANG) {
    const userLang = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
    const stopWords = STOP_WORDS_BY_LANG[userLang] || STOP_WORDS_ES;
    return text.toLowerCase()
        .split(/\s+/)
        .filter(word => !stopWords.has(word) && word.length > 1)
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
        // Idioma del request: propagarlo a NSFW, greetings, IA y mensajes al usuario
        const reqLang = getRequestLang(req);
        // Si el cliente envía este header, no registrar en historial ni caché de queries
        const skipHistory = req.headers['x-skip-history'] === 'true';

        // 0a. Detectar consultas NSFW y redirigir a /nsfw
        // Si la petición viene del contexto /nsfw (header X-Search-Context), permitir
        const searchContext = (req.headers['x-search-context'] || '').toLowerCase();
        if (searchContext !== 'nsfw' && isNsfwContent(cleanMsg)) {
            return safeJson(200, getNsfwRedirectResponse(reqLang));
        }

        // 0b. Detectar saludos y mensajes sin contenido de búsqueda (por idioma)
        if (isGreeting(cleanMsg, reqLang)) {
            return safeJson(200, {
                success: true,
                explanation: getGreetingExplanation(reqLang),
                series: [],
                source: 'greeting',
                lang: reqLang
            });
        }

        // 1. Revisar caché (scoped por idioma: /es y /en NUNCA comparten payload)
        const scopedKey = cacheKey(reqLang, cleanMsg);
        const cached = getCachedSearchSmart(scopedKey);
        if (cached && cached.status === 'fresh') {
            metrics.cacheHits++;
            // cached.data.series puede ser ya objetos completos o IDs (compatibilidad)
            const seriesField = cached.data.series || [];
            const fullSeries = seriesField.length > 0 && (typeof seriesField[0] === 'object')
                ? seriesField
                : seriesField.map(id => seriesCache.find(s => s.id === id)).filter(Boolean);

            logger.info('Cache HIT (fresh)', { query: cleanMsg, lang: reqLang });
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
            const seriesItems = localResults.map(r => r.item);
            const payload = {
                success: true,
                explanation: t(reqLang, 'directResults', { q: userMsg }),
                series: sanitizeSeriesForResponse(seriesItems),
                source: 'local_db_priority',
                lang: reqLang
            };
            setCachedSearch(scopedKey, payload);
            if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
            logger.info('Match de titulo exacto', { query: userMsg, results: seriesItems.length, bestScore: localResults[0].score.toFixed(3) });
            return safeJson(200, payload);
        }

        // 3. Si hay negación → ruta directa a Chat Completions AI
        const hasNegationEarly = detectNegative(userMsg, reqLang);

        // 4. VECTOR SEARCH: método primario para queries semánticas
        if (!hasNegationEarly && dbAvailable()) {
            const vectorResults = await performVectorSearch(userMsg);
            if (vectorResults && vectorResults.length > 0) {
                const seriesItems = vectorResults.map(r => r.item);
                const payload = {
                    success: true,
                    explanation: t(reqLang, 'semanticResults', { q: userMsg }),
                    series: sanitizeSeriesForResponse(seriesItems),
                    source: 'vector',
                    topSimilarity: vectorResults[0]?.similarity?.toFixed(3),
                    lang: reqLang
                };
                setCachedSearch(scopedKey, payload);
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
        const cleanedInput = cleanInputForAI(userMsg, reqLang);
        const enrichedInput = enrichQuery(cleanedInput, reqLang);

        // Deduplicación de peticiones concurrentes (Promise Coalescing) — key por idioma
        // para evitar que una query EN reutilice el resultado de una ES equivalente.
        let aiResult;
        const inflightKey = `${reqLang}:${enrichedInput}`;
        if (inFlightRequests.has(inflightKey)) {
            logger.info('Petición en vuelo detectada, esperando resultado compartido', { query: enrichedInput, lang: reqLang });
            aiResult = await inFlightRequests.get(inflightKey);
        } else {
            const aiPromise = callAI(enrichedInput, AI_RETRIES, userRequestController.signal, reqLang);
            inFlightRequests.set(inflightKey, aiPromise);
            try {
                aiResult = await aiPromise;
            } finally {
                inFlightRequests.delete(inflightKey);
            }
        }

        if (!aiResult || !aiResult.filter) {
            // Fallback: búsqueda con query enriquecido (sinónimos aplicados)
            let fallbackRaw = performFallbackSearch(enrichedInput);
            // Si el enriquecido no dio resultados, intentar con el original
            if (fallbackRaw.length === 0) {
                fallbackRaw = performFallbackSearch(userMsg);
            }
            const fallback = fallbackRaw.map(r => r.item);
            metrics.fallbackSearches++;
            const payload = {
                success: true,
                explanation: fallback.length > 0
                    ? t(reqLang, 'foundResults', { q: userMsg })
                    : t(reqLang, 'noResults', { q: userMsg }),
                series: sanitizeSeriesForResponse(fallback),
                source: 'fallback',
                lang: reqLang
            };
            // Registrar consulta y resultado (fallback)
            if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
            return safeJson(200, payload);
        }

        // 4. Filtrar series según la respuesta de la IA
        let filtered = [...seriesCache];
        const filter = aiResult.filter;
        const hasNegation = detectNegative(userMsg, reqLang);

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

        const results = filtered;

        // Si no hay resultados filtrados, fallback
        if (results.length === 0) {
            const fallback = performFallbackSearch(userMsg).map(r => r.item);
            const payload = {
                success: true,
                explanation: aiResult.reason || t(reqLang, 'resultsFor', { q: userMsg }),
                series: sanitizeSeriesForResponse(fallback),
                appliedFilter: aiResult,
                source: 'fallback_after_filter',
                lang: reqLang
            };
            // Registrar consulta y resultado (fallback después del filtro IA)
            if (!skipHistory) recordQuery(userMsg, cleanMsg, payload, req);
            return safeJson(200, payload);
        }

        const payload = {
            success: true,
            explanation: aiResult.reason || t(reqLang, 'resultsFor', { q: userMsg }),
            series: sanitizeSeriesForResponse(results),
            appliedFilter: aiResult,
            source: 'ai',
            lang: reqLang
        };

        // Guardar en caché (scoped por idioma)
        setCachedSearch(scopedKey, payload);

        // Estadísticas (scoped por idioma)
        const statsKey = scopedKey;
        const count = searchStats.get(statsKey) || { count: 0 };
        searchStats.set(statsKey, { count: count.count + 1, lastUsed: Date.now() });

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

