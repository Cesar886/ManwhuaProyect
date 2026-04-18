// src/hooks/useIA.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { endpoint } from '@/config';

const AI_API_URL = endpoint('search', 'ai/read');
const AI_TRACK_URL = endpoint('search', 'ai/track');
const AI_QUOTA_URL = endpoint('search', 'ai/quota');

const CACHE_TTL = 15 * 60 * 1000; // 15 minutos
const DEFAULT_CACHE_PREFIX = 'ia_cache_v3_';
const DEFAULT_CACHE_INDEX_KEY = 'ia_cache_index';
const MAX_CACHE_ENTRIES = 20;
const SEARCH_COOLDOWN = 3000; // 3s entre búsquedas a la API
const MAX_QUERY_LENGTH = 300;
const MAX_QUERY_LINES = 6;
const STORAGE_PROBE_KEY = '__ia_storage_probe__';
const GUEST_DAILY_IA_LIMIT = 5;
const USER_DAILY_IA_LIMIT = 10;
const IA_DEVICE_ID_KEY = 'ia_device_id_v1';
const RETRYABLE_AI_STATUS_CODES = new Set([502, 503, 504]);
const PROMPT_INJECTION_PATTERNS = [
    /\bignore\b.{0,40}\b(previous|above|prior)\b.{0,40}\b(instruction|prompt|message|rule)s?\b/i,
    /\b(system|developer|assistant)\s*[:=]/i,
    /\b(jailbreak|bypass|override|disable)\b.{0,40}\b(safety|policy|guardrail|restriction)s?\b/i,
    /\b(reveal|show|print|dump|expose)\b.{0,40}\b(system\s*prompt|hidden\s*prompt|api\s*key|secret|token)s?\b/i,
    /```[\s\S]*?```/i,
    /<(system|assistant|developer)>[\s\S]*?<\/(system|assistant|developer)>/i,
];

// --- Mensajes localizables (ES/EN) ---
const I18N = {
    nsfwRedirect: {
        es: 'Este tipo de búsqueda pertenece a la sección +18. Usa el buscador en /nsfw para encontrar contenido adulto.',
        en: 'This type of search belongs to the +18 section. Use the search at /nsfw to find adult content.',
    },
    emptyQuery: { es: 'Por favor escribe una pregunta', en: 'Please enter a question' },
    invalidQuery: { es: 'Por favor escribe una pregunta válida', en: 'Please enter a valid question' },
    promptBlocked: {
        es: 'Tu consulta parece contener instrucciones no permitidas. Reformúlala como una búsqueda de manhwa.',
        en: 'Your query looks like it contains disallowed instructions. Rephrase it as a manhwa search.',
    },
    guestLimit: {
        es: (n) => `Has alcanzado el límite diario de ${n} consultas IA. Regístrate para seguir usándola.`,
        en: (n) => `You've reached the daily limit of ${n} AI queries. Sign up to keep using it.`,
    },
    userLimit: {
        es: (n) => `Has alcanzado el límite diario de ${n} consultas IA.`,
        en: (n) => `You've reached the daily limit of ${n} AI queries.`,
    },
    dailyLimitGeneric: {
        es: 'Has alcanzado el límite diario de consultas IA.',
        en: "You've reached the daily AI query limit.",
    },
    errAiMaintenance: {
        es: 'El servicio IA está en mantenimiento o temporalmente bloqueado por la red. Intenta en unos minutos.',
        en: 'The AI service is under maintenance or temporarily blocked. Try again in a few minutes.',
    },
    errAiTimeout: {
        es: 'La IA tardó demasiado en responder. Intenta nuevamente en unos segundos.',
        en: 'The AI took too long to respond. Try again in a few seconds.',
    },
    errAiUnavailable: {
        es: 'No se pudo conectar con el servicio IA. Verifica la conectividad y vuelve a intentar.',
        en: 'Could not reach the AI service. Check your connection and try again.',
    },
    errNoInternet: {
        es: 'Sin conexión a internet. Revisa tu red e intenta de nuevo.',
        en: 'No internet connection. Check your network and try again.',
    },
    errNetwork: {
        es: 'No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.',
        en: 'Could not reach the server. Try again in a few seconds.',
    },
    err5xx: {
        es: 'El servidor de IA está temporalmente sobrecargado. Intenta en unos minutos.',
        en: 'The AI server is temporarily overloaded. Try again in a few minutes.',
    },
    errGeneric: {
        es: 'Error al conectar con la IA',
        en: 'Error connecting to the AI',
    },
    errProcess: {
        es: 'La IA no pudo procesar la solicitud correctamente',
        en: 'The AI could not process the request correctly',
    },
};

export function tMsg(key, lang, ...args) {
    const entry = I18N[key];
    if (!entry) return '';
    const value = entry[lang === 'en' ? 'en' : 'es'];
    return typeof value === 'function' ? value(...args) : value;
}

// --- Detección de contenido NSFW para redirigir a /nsfw ---
const NSFW_SAFE = Object.freeze({ isNsfw: false, message: null });

// NOTA: Todos los patrones asumen texto ya normalizado (lowercase, sin diacríticos,
// sin leetspeak, sin espacios sueltos entre letras).
const NSFW_PATTERNS = [
    // Términos explícitos del medio manga/manhwa
    /\b(hentai|hntai|ec+hi|pornhwa|smut)\b/,
    /\b(erotic[oa]?s?|erotico)\b/,
    // Actos / verbos sexuales
    /\b(sexo|sexuales?|follar|coj[eio](r|n|ndo)?|cojiend[oa]|fornicar)\b/,
    // Partes del cuerpo (solo términos inequívocamente sexuales)
    /\b(tetas|pechos?|senos|nalgas|trasero|vagina|pene|polla|verga|pija)\b/,
    // Desnudez
    /\b(desnud[oa]s?|nudes?|naked|xxx|nsfw)\b/,
    // Actos grupales
    /\b(orgias?|trio\s+sexual|threesome|gangbang|bukak+e)\b/,
    // Actos sexuales específicos
    /\b(masturb\w*|pajea\w*|handjob|blowjob|mamada|felacion|cunnilingus)\b/,
    // Violencia sexual
    /\b(violacion(es)?|violar|rape)\b/,
    // Tropos adultos manga/manhwa
    /\b(ntr|netorare|netori|cuckold)\b/,
    // Fetishes
    /\b(bondage|bdsm|sado(maso)?)\b/,
    // Categorías adultas
    /\b(incest[uo]\w*|milf|dilf|loli|shota)\b/,
    /\b(futanari|futa)\b/,
    // Fluidos / actos de culminación
    /\b(creampie|semen|eyacul\w*)\b/,
    // Porno genérico
    /\b(porno?)\b/,
    // Frases compuestas ("escenas de sexo", "escenas calientes")
    /\bescenas?\s+(?:de\s+)?(sexo|sexuales?|cama|calientes?|explicitas?)\b/,
    // Expresiones ("subido de tono", "contenido adulto")
    /\bsubid[oa]s?\s+de\s+tono\b/,
    /\bcontenido\s+adulto\b/,
    /\bpara\s+adultos\b/,
    // +18 / 18+
    /\+\s*18\b|\b18\s*\+/,
    // Subgéneros adultos manga/manhwa/anime
    /\b(doujin(shi)?|ahegao)\b/,
    /\b(rule\s*34|r34)\b/,
    // Vulgarismos inequívocamente sexuales (español)
    /\b(culo|coño|puta|zorra)\b/,
    /\b(correrse|corrida\s+sexual|chupada|chupar(la|selo)?)\b/,
    // Variantes con typos/abreviaturas comunes
    /\b(pr[o0]n|p0rn)\b/,
    // Términos adultos en inglés comunes en búsquedas
    /\b(harem\s+sexual|uncensored|raw\s+18)\b/,
];

// Mapa de homóglifos Unicode comunes usados para evasión (Cyrillic, fullwidth, etc.)
const HOMOGLYPH_MAP = {
    '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
    '\u0441': 'c', '\u0445': 'x', '\u0456': 'i', '\u0443': 'y',
    '\u044A': 'b', '\u043D': 'h', '\u0442': 't', '\u043C': 'm',
    '\u2107': 'e', '\u210E': 'h',
};
// Generar fullwidth Latin → ASCII (Ａ-Ｚ U+FF21-FF3A, ａ-ｚ U+FF41-FF5A)
for (let i = 0; i < 26; i++) {
    HOMOGLYPH_MAP[String.fromCharCode(0xFF21 + i)] = String.fromCharCode(97 + i);
    HOMOGLYPH_MAP[String.fromCharCode(0xFF41 + i)] = String.fromCharCode(97 + i);
}
const HOMOGLYPH_REGEX = new RegExp('[' + Object.keys(HOMOGLYPH_MAP).join('') + ']', 'g');

/**
 * Normaliza texto para detección NSFW:
 * 1. lowercase + strip diacríticos
 * 2. Strip caracteres invisibles (zero-width, BOM, soft-hyphen)
 * 3. Mapear homóglifos Unicode → ASCII
 * 4. Preservar secuencias numéricas (\d+) antes de leetspeak (para "+18", "18+")
 * 5. Leetspeak selectivo (3→e, 0→o, etc.) solo fuera de números
 * 6. Strip separadores entre letras (h-e-n-t-a-i, h.e.n.t.a.i, h_e_n_t_a_i)
 * 7. Colapsar letras repetidas (sexxo → sexo, heentai → hentai)
 * 8. Colapsar letras con espacios intercalados ("h e n t a i" → "hentai")
 */
function normalizeForNsfw(text) {
    let s = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Strip caracteres invisibles: zero-width spaces, BOM, soft-hyphen, etc.
    s = s.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD\u2060\u180E]/g, '');

    // Mapear homóglifos Unicode a ASCII (Cyrillic а→a, fullwidth Ａ→a, etc.)
    s = s.replace(HOMOGLYPH_REGEX, (ch) => HOMOGLYPH_MAP[ch] || ch);

    // Proteger secuencias numéricas de 2+ dígitos antes del leetspeak:
    // "+18", "18+", "100" → placeholders (dígitos sueltos como "3", "0" SÍ se convierten)
    const numericTokens = [];
    s = s.replace(/\+?\d{2,}\+?/g, (match) => {
        numericTokens.push(match);
        return `__NUM${numericTokens.length - 1}__`;
    });

    // Leetspeak → letras reales (solo aplicado al texto no-numérico)
    s = s.replace(/3/g, 'e').replace(/0/g, 'o').replace(/1/g, 'i')
         .replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a');

    // Restaurar tokens numéricos
    s = s.replace(/__NUM(\d+)__/g, (_, idx) => numericTokens[parseInt(idx)] || '');

    // Strip separadores entre letras sueltas (h-e-n-t-a-i → hentai, p.o.r.n → porn)
    s = s.replace(/([a-z])[-_.*\/\\|]+(?=[a-z])/g, '$1');

    // Colapsar letras repetidas (3+) → 1 (pornooo→porno, sexxxo→sexo)
    s = s.replace(/(.)\1{2,}/g, '$1');
    // Colapsar dobles letras → 1 EXCEPTO ll, rr (legítimas en español)
    s = s.replace(/([a-z])\1/g, (match, ch) => (ch === 'l' || ch === 'r') ? match : ch);

    // Colapsar letras con espacios intercalados:
    // "h e n t a i" → "hentai", "s e x o" → "sexo"
    // Solo si hay ≥3 grupos de letra-espacio consecutivos
    s = s.replace(/\b((?:[a-z]\s){3,}[a-z])\b/g, (match) => match.replace(/\s/g, ''));

    // Limpiar espacios múltiples
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

/**
 * Detecta si una consulta contiene términos NSFW.
 * Retorna siempre un objeto seguro — nunca lanza excepciones.
 * @param {string} query
 * @returns {{ isNsfw: boolean, message: string | null }}
 */
export function detectNsfwQuery(query, lang = 'es') {
    try {
        const raw = typeof query === 'string' ? query : String(query || '');
        if (raw.length < 2) return NSFW_SAFE;

        const sample = normalizeForNsfw(raw);
        if (!sample || sample.length < 2) return NSFW_SAFE;

        for (let i = 0; i < NSFW_PATTERNS.length; i++) {
            if (NSFW_PATTERNS[i].test(sample)) {
                return { isNsfw: true, message: tMsg('nsfwRedirect', lang) };
            }
        }
        return NSFW_SAFE;
    } catch {
        // Nunca bloquear al usuario por un error interno de detección
        return NSFW_SAFE;
    }
}

const storageAvailability = {
    local: null,
    session: null,
};

function buildCacheConfig(namespace = 'default', lang = 'es') {
    const safeLang = lang === 'en' ? 'en' : 'es';
    const normalizedNamespace = String(namespace || 'default').trim().toLowerCase();
    if (normalizedNamespace === 'default') {
        return {
            namespace: 'default',
            lang: safeLang,
            cachePrefix: `${DEFAULT_CACHE_PREFIX}${safeLang}_`,
            cacheIndexKey: `${DEFAULT_CACHE_INDEX_KEY}_${safeLang}`,
            storage: 'session',
        };
    }

    const safeNamespace = normalizedNamespace.replace(/[^a-z0-9_-]/g, '') || 'default';
    return {
        namespace: safeNamespace,
        lang: safeLang,
        cachePrefix: `${DEFAULT_CACHE_PREFIX}${safeLang}_${safeNamespace}_`,
        cacheIndexKey: `${DEFAULT_CACHE_INDEX_KEY}_${safeLang}_${safeNamespace}`,
        storage: 'local',
    };
}

function getStorageByType(type) {
    if (typeof window === 'undefined') return null;
    try {
        return type === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
        return null;
    }
}

function canUseStorage(type) {
    if (typeof window === 'undefined') return false;
    if (storageAvailability[type] !== null) return storageAvailability[type];

    const storage = getStorageByType(type);
    if (!storage) {
        storageAvailability[type] = false;
        return false;
    }

    try {
        storage.setItem(STORAGE_PROBE_KEY, '1');
        storage.removeItem(STORAGE_PROBE_KEY);
        storageAvailability[type] = true;
        return true;
    } catch {
        storageAvailability[type] = false;
        return false;
    }
}

function resolveStorage(config) {
    if (typeof window === 'undefined') return null;
    const preferredType = config?.storage === 'local' ? 'local' : 'session';
    const fallbackType = preferredType === 'local' ? 'session' : 'local';

    if (canUseStorage(preferredType)) {
        return getStorageByType(preferredType);
    }

    if (canUseStorage(fallbackType)) {
        return getStorageByType(fallbackType);
    }

    return null;
}

// Analytics helper — envía eventos a Google Analytics si está disponible
function trackIAEvent(eventName, params) {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
    }
}

function sanitizeInputText(text) {
    return String(text || '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeQueryForIA(text) {
    const raw = String(text || '');
    const normalizedLines = raw
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => sanitizeInputText(line))
        .filter(Boolean)
        .slice(0, MAX_QUERY_LINES);

    const merged = normalizedLines.join(' ').trim();
    return merged.slice(0, MAX_QUERY_LENGTH);
}

function getPromptInjectionRisk(query) {
    const sample = String(query || '').trim();
    if (!sample) return { level: 'none', score: 0 };

    let score = 0;
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
        if (pattern.test(sample)) score += 1;
    }

    if (score >= 2) return { level: 'high', score };
    if (score === 1) return { level: 'medium', score };
    return { level: 'none', score };
}

// Slugify compartido — se usa tanto para claves de caché como para URLs
export function slugifyQuery(text) {
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 300);
}

function getCacheKey(query, config = buildCacheConfig()) {
    return `${config.cachePrefix}${slugifyQuery(query)}`;
}

// --- Índice de caché para eviction eficiente ---
function getCacheIndex(config = buildCacheConfig()) {
    if (typeof window === 'undefined') return [];
    try {
        const storage = resolveStorage(config);
        if (!storage) return [];
        const raw = storage.getItem(config.cacheIndexKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(entry =>
            entry
            && typeof entry === 'object'
            && typeof entry.key === 'string'
            && Number.isFinite(entry.ts)
        );
    } catch {
        return [];
    }
}

function saveCacheIndex(index, config = buildCacheConfig()) {
    if (typeof window === 'undefined') return;
    try {
        const storage = resolveStorage(config);
        if (!storage) return;
        storage.setItem(config.cacheIndexKey, JSON.stringify(index));
    } catch { /* ignore */ }
}

function evictOldEntries(config = buildCacheConfig()) {
    if (typeof window === 'undefined') return;
    try {
        const storage = resolveStorage(config);
        if (!storage) return;
        const index = getCacheIndex(config);
        if (index.length <= MAX_CACHE_ENTRIES) return;
        index.sort((a, b) => a.ts - b.ts);
        const toRemove = index.length - MAX_CACHE_ENTRIES;
        for (let i = 0; i < toRemove; i++) {
            storage.removeItem(index[i].key);
        }
        saveCacheIndex(index.slice(toRemove), config);
    } catch { /* ignore */ }
}

function getFromCache(query, config = buildCacheConfig(), { allowStale = false } = {}) {
    if (typeof window === 'undefined') return null;
    try {
        const storage = resolveStorage(config);
        if (!storage) return null;
        const trimmedQuery = String(query || '').trim();
        if (!trimmedQuery) return null;

        const raw = storage.getItem(getCacheKey(trimmedQuery, config));
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || typeof cached !== 'object' || !cached.timestamp || !cached.data) {
            return null;
        }
        const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
        if (isExpired && !allowStale) {
            return null;
        }
        return {
            data: cached.data,
            originalQuery: cached.originalQuery,
            stale: isExpired,
        };
    } catch {
        return null;
    }
}

function parseChapterCount(...values) {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
            return value;
        }

        if (typeof value === 'string') {
            const text = value.trim();
            if (!text) continue;

            const numeric = Number(text);
            if (Number.isFinite(numeric) && numeric >= 0) {
                return numeric;
            }

            const extracted = text.match(/\d+/);
            if (extracted) {
                const parsed = Number(extracted[0]);
                if (Number.isFinite(parsed) && parsed >= 0) {
                    return parsed;
                }
            }
        }
    }
    return 0;
}

// Normaliza los campos de cada serie para que el frontend siempre use los mismos nombres.
// Maneja todas las variantes de naming que pueden venir del AI middleware o del API.
function normalizeSeries(data) {
    if (!data) return data;
    const series = data.series;
    if (!Array.isArray(series) || series.length === 0) return data;
    return {
        ...data,
        series: series.map(s => {
            if (!s || typeof s !== 'object') return s;
            const cover = s.cover || s.coverUrl || s.cover_url || s.coverImage || s.image || null;
            const chapterCount = parseChapterCount(
                s.chapterCount,
                s.chapter_count,
                s.chaptersCount,
                s.chapters_count,
                s.totalChapters,
                s.total_chapters,
                s.chapter_total,
                s.latestChapter,
                s.latest_chapter,
                s.lastChapter,
                s.last_chapter
            );
            return {
                ...s,
                cover,
                coverUrl: cover,
                chapterCount,
                rating: s.rating ?? s.rating_average ?? s.ratingAverage ?? 0,
                status: s.status || 'ongoing',
            };
        }),
    };
}

function saveToCache(query, data, config = buildCacheConfig()) {
    if (typeof window === 'undefined') return;
    try {
        const storage = resolveStorage(config);
        if (!storage) return;
        const trimmed = String(query || '').trim();
        if (!trimmed) return;

        const key = getCacheKey(trimmed, config);

        // Guardar solo los campos necesarios de cada serie para reducir tamaño
        const leanData = {
            ...data,
            series: (data.series || []).map(s => ({
                id: s.id,
                slug: s.slug,
                title: s.title,
                cover: s.cover || s.coverUrl || s.cover_url || null,
                chapterCount: parseChapterCount(
                    s.chapterCount,
                    s.chapter_count,
                    s.chaptersCount,
                    s.chapters_count,
                    s.totalChapters,
                    s.total_chapters,
                    s.chapter_total,
                    s.latestChapter,
                    s.latest_chapter,
                    s.lastChapter,
                    s.last_chapter
                ),
            })),
        };

        const payload = JSON.stringify({
            data: leanData,
            originalQuery: trimmed,
            timestamp: Date.now(),
        });

        // Primer intento
        storage.setItem(key, payload);

        // Actualizar índice
        const index = getCacheIndex(config).filter(e => e.key !== key);
        index.push({ key, ts: Date.now() });
        saveCacheIndex(index, config);

        evictOldEntries(config);
    } catch {
        // Reintento tras eviction (p.ej. quota exceeded)
        try {
            const storage = resolveStorage(config);
            if (!storage) return;
            evictOldEntries(config);
            const trimmed = String(query || '').trim();
            if (!trimmed) return;
            const key = getCacheKey(trimmed, config);
            const retryData = {
                ...data,
                series: (data.series || []).map(s => ({
                    id: s.id,
                    slug: s.slug,
                    title: s.title,
                    cover: s.cover || s.coverUrl || s.cover_url || null,
                    chapterCount: parseChapterCount(
                        s.chapterCount,
                        s.chapter_count,
                        s.chaptersCount,
                        s.chapters_count,
                        s.totalChapters,
                        s.total_chapters,
                        s.chapter_total,
                        s.latestChapter,
                        s.latest_chapter,
                        s.lastChapter,
                        s.last_chapter
                    ),
                })),
            };
            storage.setItem(key, JSON.stringify({
                data: retryData,
                originalQuery: trimmed,
                timestamp: Date.now(),
            }));

            const index = getCacheIndex(config).filter(e => e.key !== key);
            index.push({ key, ts: Date.now() });
            saveCacheIndex(index, config);
        } catch {
            // sin storage disponible — ignorar
        }
    }
}

// Devuelve las últimas N búsquedas del historial de caché
export function getSearchHistory(limit = 5, options = {}) {
    const cacheConfig = buildCacheConfig(options.namespace, options.lang);
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, limit)) : 5;
    const index = getCacheIndex(cacheConfig);
    return index
        .slice()
        .sort((a, b) => b.ts - a.ts)
        .slice(0, safeLimit)
        .map(entry => {
            const slug = entry.key.replace(cacheConfig.cachePrefix, '');
            const original = getOriginalQuery(slug, options);
            return original ? { query: original, slug, ts: entry.ts } : null;
        })
        .filter(Boolean);
}

// Elimina una entrada del historial de búsquedas
export function removeFromHistory(slug, options = {}) {
    if (typeof window === 'undefined') return;
    try {
        const cacheConfig = buildCacheConfig(options.namespace, options.lang);
        const storage = resolveStorage(cacheConfig);
        if (!storage) return;
        const safeSlug = String(slug || '').trim();
        if (!safeSlug) return;
        const key = `${cacheConfig.cachePrefix}${safeSlug}`;
        storage.removeItem(key);
        const index = getCacheIndex(cacheConfig).filter(e => e.key !== key);
        saveCacheIndex(index, cacheConfig);
    } catch { /* ignore */ }
}

// Recupera el query original almacenado en el caché para un slug dado
export function getOriginalQuery(slug, options = {}) {
    if (typeof window === 'undefined') return null;
    try {
        const cacheConfig = buildCacheConfig(options.namespace, options.lang);
        const storage = resolveStorage(cacheConfig);
        if (!storage) return null;
        const safeSlug = String(slug || '').trim();
        if (!safeSlug) return null;
        const key = `${cacheConfig.cachePrefix}${safeSlug}`;
        const raw = storage.getItem(key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || typeof cached !== 'object') return null;
        return typeof cached.originalQuery === 'string' ? cached.originalQuery : null;
    } catch {
        return null;
    }
}

// Clasificar error para dar mensajes claros al usuario
function classifyError(err, lang = 'es') {
    if (err?.body?.code === 'AI_UPSTREAM_HTML_ERROR' || /<html[\s>]|<!doctype\s/i.test(String(err?.body || err?.message || ''))) {
        return tMsg('errAiMaintenance', lang);
    }
    if (err?.status === 429 || err?.body?.code === 'AI_GUEST_DAILY_LIMIT' || err?.body?.code === 'AI_USER_DAILY_LIMIT') {
        return err.message || tMsg('dailyLimitGeneric', lang);
    }
    if (err?.status === 504 || err?.body?.code === 'AI_UPSTREAM_TIMEOUT') {
        return tMsg('errAiTimeout', lang);
    }
    if (err?.status === 502 || err?.status === 503 || err?.status === 500 || err?.body?.code === 'AI_UPSTREAM_UNAVAILABLE') {
        return tMsg('errAiUnavailable', lang);
    }
    if (err.name === 'AbortError') {
        return tMsg('errAiTimeout', lang);
    }
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('net::')) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return tMsg('errNoInternet', lang);
        }
        return tMsg('errNetwork', lang);
    }
    if (err.message?.startsWith('Error 5')) {
        return tMsg('err5xx', lang);
    }
    if (err.message?.startsWith('Error 4')) {
        return err.message;
    }
    return err.message || tMsg('errGeneric', lang);
}

function getIaDeviceId() {
    if (typeof window === 'undefined') return null;

    try {
        let value = window.localStorage.getItem(IA_DEVICE_ID_KEY);
        if (!value) {
            value = window.crypto?.randomUUID
                ? window.crypto.randomUUID()
                : `ia-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            window.localStorage.setItem(IA_DEVICE_ID_KEY, value);
        }
        return value;
    } catch {
        return null;
    }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildGuestAiLimitState({ isGuest, used = 0, limit = GUEST_DAILY_IA_LIMIT, blocked = false }) {
    if (!isGuest) {
        return {
            isGuest: false,
            limit,
            used: 0,
            remaining: null,
            blocked: false,
            message: null,
        };
    }

    const safeLimit = Math.max(1, Number(limit) || GUEST_DAILY_IA_LIMIT);
    const safeUsed = Math.max(0, Math.min(safeLimit, Number(used) || 0));
    const remaining = Math.max(0, safeLimit - safeUsed);
    const isBlocked = blocked || remaining === 0;
    return {
        isGuest: true,
        limit: safeLimit,
        used: safeUsed,
        remaining,
        blocked: isBlocked,
        // El mensaje se construye en el consumer según lang (ver tMsg('guestLimit', lang, n)).
        message: null,
    };
}

function toGuestLimitState(payload, fallbackIsGuest = true) {
    const limitData = payload?.guestLimit;
    if (!limitData) return buildGuestAiLimitState({ isGuest: fallbackIsGuest, used: 0 });
    return buildGuestAiLimitState({
        isGuest: fallbackIsGuest,
        used: limitData.used,
        limit: limitData.limit,
        blocked: Boolean(limitData.blocked),
    });
}

function buildUserAiLimitState({ limit = USER_DAILY_IA_LIMIT, used = 0, remaining = null, blocked = false } = {}) {
    const safeLimit = Math.max(1, Number(limit) || USER_DAILY_IA_LIMIT);
    const safeUsed = Math.max(0, Math.min(safeLimit, Number(used) || 0));
    const safeRemaining = remaining == null
        ? Math.max(0, safeLimit - safeUsed)
        : Math.max(0, Math.min(safeLimit, Number(remaining) || 0));

    return {
        limit: safeLimit,
        used: safeUsed,
        remaining: safeRemaining,
        blocked: Boolean(blocked) || safeRemaining === 0,
    };
}

function toUserLimitState(payload) {
    const limitData = payload?.userLimit;
    if (!limitData) return null;
    return buildUserAiLimitState({
        limit: limitData.limit,
        used: limitData.used,
        remaining: limitData.remaining,
        blocked: limitData.blocked,
    });
}

export function useIA(options = {}) {
    // Idioma activo: si el caller lo pasa explícito (options.lang), gana; si no, se deriva
    // del pathname (/en → 'en', resto → 'es'). Se propaga al servidor como header X-Lang
    // y en el body, y además se usa como key del caché para evitar colisiones ES↔EN.
    const pathname = usePathname();
    const detectedLang = (pathname && pathname.startsWith('/en')) ? 'en' : 'es';
    const lang = options.lang || detectedLang;

    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [resultados, setResultados] = useState(null);
    const [nsfwRedirect, setNsfwRedirect] = useState(false);
    const [searchCount, setSearchCount] = useState(null);
    const { user } = useAuth();
    const [guestAiLimit, setGuestAiLimit] = useState(() => buildGuestAiLimitState({ isGuest: true, used: 0 }));
    const [userAiLimit, setUserAiLimit] = useState(null);
    const cacheConfigRef = useRef(buildCacheConfig(options.namespace, lang));
    const promptProtectionRef = useRef(options.promptProtection !== false);
    const userRef = useRef(user);
    const langRef = useRef(lang);
    useEffect(() => { langRef.current = lang; }, [lang]);
    // Refs para pre-bloqueo (evitan closures obsoletos en buscarConIA).
    // Inicializados con el estado inicial real para que el bloqueo funcione
    // desde el primer render, antes de que fetchQuota responda.
    const guestAiLimitRef = useRef(buildGuestAiLimitState({ isGuest: true, used: 0 }));
    const userAiLimitRef = useRef(null);

    // Mantener refs sincronizados con el state (para acceso sin closures obsoletos)
    useEffect(() => { guestAiLimitRef.current = guestAiLimit; }, [guestAiLimit]);
    useEffect(() => { userAiLimitRef.current = userAiLimit; }, [userAiLimit]);

    // Flag para deduplicar fetchQuota concurrentes (ej: doble effect al montar)
    const fetchQuotaInFlightRef = useRef(false);

    // Consulta cuota actual sin consumirla (read-only)
    const fetchQuota = useCallback(async () => {
        if (typeof window === 'undefined') return;
        if (fetchQuotaInFlightRef.current) return;
        fetchQuotaInFlightRef.current = true;
        try {
            const res = await fetch(AI_QUOTA_URL, {
                method: 'GET',
                credentials: 'include',
            });
            if (!res.ok) return;
            const data = await res.json();
            if (!data?.success) return;

            if (data.userLimit) {
                // Usuario registrado
                setGuestAiLimit(buildGuestAiLimitState({ isGuest: false, used: 0 }));
                setUserAiLimit(toUserLimitState(data));
            } else if (data.guestLimit) {
                // Invitado
                setGuestAiLimit(toGuestLimitState(data, true));
                setUserAiLimit(null);
            }
        } catch { /* no crítico — ignorar */ }
        finally {
            fetchQuotaInFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        userRef.current = user;

        if (user) {
            setGuestAiLimit(buildGuestAiLimitState({ isGuest: false, used: 0 }));
            setUserAiLimit(null);
        } else {
            setGuestAiLimit(buildGuestAiLimitState({ isGuest: true, used: 0 }));
            setUserAiLimit(null);
        }

        // Obtener cuota real del servidor al iniciar o al cambiar sesión
        fetchQuota();
    }, [user, fetchQuota]);

    useEffect(() => {
        cacheConfigRef.current = buildCacheConfig(options.namespace, lang);
    }, [options.namespace, lang]);

    useEffect(() => {
        promptProtectionRef.current = options.promptProtection !== false;
    }, [options.promptProtection]);

    // Fire-and-forget: registrar búsqueda y actualizar searchCount
    const trackSearch = useCallback((queryText) => {
        if (!queryText || queryText.length < 2) return;
        fetch(AI_TRACK_URL, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryText }),
        })
            .then(r => r.json())
            .then(data => {
                if (data?.searchCount != null) setSearchCount(data.searchCount);
            })
            .catch(() => {});
    }, []);

    // Ref para cancelar búsquedas anteriores (race condition fix)
    const activeControllerRef = useRef(null);
    // Ref para rate limiting
    const lastSearchTimeRef = useRef(0);

    const buscarConIA = useCallback(async (texto) => {
        setNsfwRedirect(false);

        const activeLang = langRef.current || 'es';

        // Pre-bloqueo client-side: evita llamadas innecesarias al API cuando la cuota está agotada
        {
            const currentUser = userRef.current;
            if (!currentUser) {
                const gl = guestAiLimitRef.current;
                if (gl?.blocked) {
                    setError(gl.message || tMsg('guestLimit', activeLang, gl.limit));
                    return null;
                }
            } else {
                const ul = userAiLimitRef.current;
                if (ul?.blocked) {
                    setError(tMsg('userLimit', activeLang, ul.limit));
                    return null;
                }
            }
        }

        if (!texto || texto.trim().length === 0) {
            setError(tMsg('emptyQuery', activeLang));
            return null;
        }

        const sanitized = sanitizeQueryForIA(texto);
        if (!sanitized) {
            setError(tMsg('invalidQuery', activeLang));
            return null;
        }

        // Bloquear contenido NSFW en contextos no-adultos (cualquier namespace que no sea 'nsfw')
        if (cacheConfigRef.current.namespace !== 'nsfw') {
            const nsfwCheck = detectNsfwQuery(sanitized, activeLang);
            if (nsfwCheck.isNsfw) {
                setNsfwRedirect(true);
                setError(nsfwCheck.message);
                setCargando(false);
                trackIAEvent('ia_search_blocked', {
                    query: sanitized,
                    reason: 'nsfw_redirect',
                    namespace: cacheConfigRef.current.namespace,
                });
                return null;
            }
        }

        const risk = getPromptInjectionRisk(sanitized);
        if (promptProtectionRef.current && risk.level === 'high') {
            setError(tMsg('promptBlocked', activeLang));
            trackIAEvent('ia_search_blocked', {
                query: sanitized,
                reason: 'prompt_injection_high',
                namespace: cacheConfigRef.current.namespace,
            });
            return null;
        }

        const trimmed = sanitized;

        // Rate limiting: si la última búsqueda fue hace menos de SEARCH_COOLDOWN, rechazar
        const now = Date.now();
        if (now - lastSearchTimeRef.current < SEARCH_COOLDOWN) {
            return null;
        }

        // Cancelar búsqueda anterior si existe
        if (activeControllerRef.current) {
            activeControllerRef.current.abort();
        }

        const controller = new AbortController();
        activeControllerRef.current = controller;
        lastSearchTimeRef.current = now;

        setCargando(true);
        setError(null);
        setResultados(null);

        try {
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const t0 = performance.now();
            const fetchHeaders = {
                'Content-Type': 'application/json',
                // Idioma del request: garantiza que el backend use el bucket correcto
                // (historial, caché, populares, after-search). Sin este header el
                // servidor cae a Referer / Accept-Language.
                'X-Lang': activeLang,
            };
            // Informar al servidor del contexto para que no bloquee queries NSFW en /nsfw
            if (cacheConfigRef.current.namespace === 'nsfw') {
                fetchHeaders['X-Search-Context'] = 'nsfw';
            }
            const deviceId = getIaDeviceId();
            if (deviceId) {
                fetchHeaders['X-Device-Id'] = deviceId;
            }
            let response = null;
            for (let attempt = 0; attempt < 2; attempt++) {
                response = await fetch(AI_API_URL, {
                    method: 'POST',
                    credentials: 'include',
                    headers: fetchHeaders,
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: trimmed }],
                        lang: activeLang
                    }),
                    signal: controller.signal
                });

                if (response.ok || !RETRYABLE_AI_STATUS_CODES.has(response.status) || attempt === 1) {
                    break;
                }

                await delay(900 * (attempt + 1));

                if (controller !== activeControllerRef.current) {
                    return null;
                }
            }

            const latencyMs = Math.round(performance.now() - t0);

            clearTimeout(timeoutId);

            // Si este controller ya fue reemplazado, ignorar la respuesta
            if (controller !== activeControllerRef.current) return null;

            if (!response.ok) {
                const rawErrorText = await response.text().catch(() => '');
                const contentType = response.headers.get('content-type') || '';
                let errorData = {};

                if (contentType.includes('application/json') && rawErrorText) {
                    try {
                        errorData = JSON.parse(rawErrorText);
                    } catch {
                        errorData = { message: rawErrorText };
                    }
                } else if (rawErrorText) {
                    errorData = { message: rawErrorText };
                }

                const appearsToBeHtml = /<html[\s>]|<!doctype\s/i.test(rawErrorText);
                if (appearsToBeHtml && !errorData.code) {
                    errorData = {
                        ...errorData,
                        code: 'AI_UPSTREAM_HTML_ERROR',
                        message: tMsg('errAiMaintenance', activeLang),
                    };
                }

                if (!userRef.current && errorData?.guestLimit) {
                    setGuestAiLimit(toGuestLimitState(errorData, true));
                }
                if (userRef.current && errorData?.userLimit) {
                    setUserAiLimit(toUserLimitState(errorData));
                }
                const serverMessage = errorData?.message || errorData?.error || `Error ${response.status}`;
                const customError = new Error(serverMessage);
                customError.status = response.status;
                customError.body = errorData;
                throw customError;
            }

            const responseContentType = response.headers.get('content-type') || '';
            const responseText = await response.text().catch(() => '');
            const responseLooksLikeHtml = /<html[\s>]|<!doctype\s/i.test(responseText);

            let data = null;
            if (responseContentType.includes('application/json') && responseText) {
                try {
                    data = JSON.parse(responseText);
                } catch {
                    data = {
                        success: false,
                        code: 'AI_UPSTREAM_INVALID_JSON',
                        message: responseText || tMsg('errAiUnavailable', activeLang),
                    };
                }
            } else if (responseText) {
                data = {
                    success: false,
                    code: responseLooksLikeHtml ? 'AI_UPSTREAM_HTML_ERROR' : 'AI_UPSTREAM_INVALID_RESPONSE',
                    message: responseLooksLikeHtml
                        ? tMsg('errAiMaintenance', activeLang)
                        : responseText,
                };
            }

            if (responseLooksLikeHtml && (!data || data.success !== false)) {
                data = {
                    success: false,
                    code: 'AI_UPSTREAM_HTML_ERROR',
                    message: tMsg('errAiMaintenance', activeLang),
                };
            }

            if (!data) {
                data = {
                    success: false,
                    code: 'AI_UPSTREAM_EMPTY_RESPONSE',
                    message: tMsg('errAiUnavailable', activeLang),
                };
            }

            if (!userRef.current && data?.guestLimit) {
                setGuestAiLimit(toGuestLimitState(data, true));
            }
            if (userRef.current && data?.userLimit) {
                setUserAiLimit(toUserLimitState(data));
            }

            if (controller !== activeControllerRef.current) return null;

            if (data.success) {
                // Si el servidor detectó NSFW y devolvió redirect, propagarlo
                if (data.source === 'nsfw_redirect') {
                    setNsfwRedirect(true);
                    setError(data.explanation || tMsg('nsfwRedirect', activeLang));
                    setCargando(false);
                    trackIAEvent('ia_search_blocked', {
                        query: trimmed,
                        reason: 'nsfw_redirect_server',
                        namespace: cacheConfigRef.current.namespace,
                    });
                    return null;
                }

                const normalized = normalizeSeries(data);
                setResultados(normalized);
                saveToCache(trimmed, normalized, cacheConfigRef.current);
                trackSearch(trimmed);
                trackIAEvent('ia_search', {
                    query: trimmed,
                    result_count: (data.series || []).length,
                    source: 'api',
                    latency_ms: latencyMs,
                    prompt_risk: risk.level,
                });
            } else {
                const upstreamError = new Error(data.message || tMsg('errProcess', activeLang));
                upstreamError.status = response.status;
                upstreamError.body = data;
                throw upstreamError;
            }

            setCargando(false);
            return data;

        } catch (err) {
            // Si fue abortado por una nueva búsqueda, no tocar el estado
            if (err.name === 'AbortError' && controller !== activeControllerRef.current) {
                return null;
            }

            const errorMsg = classifyError(err, activeLang);

            // Intentar usar caché stale como fallback si la API falla
            const staleCache = getFromCache(trimmed, cacheConfigRef.current, { allowStale: true });
            if (staleCache) {
                setResultados(normalizeSeries(staleCache.data));
                setError(null);
                setCargando(false);
                trackIAEvent('ia_search', {
                    query: trimmed,
                    result_count: (staleCache.data.series || []).length,
                    source: 'stale_cache',
                    prompt_risk: risk.level,
                });
                return staleCache.data;
            }

            trackIAEvent('ia_search_error', {
                query: trimmed,
                error_type: errorMsg,
            });

            setError(errorMsg);
            setCargando(false);
            return null;
        } finally {
            // Limpiar ref si este es el controller activo
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;
            }
        }
    }, []);

    // Busca primero en caché fresco, si no hay llama a la API (sin cooldown)
    const buscarConIACached = useCallback(async (texto) => {
        setNsfwRedirect(false);

        const activeLang = langRef.current || 'es';

        if (!texto || texto.trim().length === 0) {
            setError(tMsg('emptyQuery', activeLang));
            return null;
        }

        const sanitized = sanitizeQueryForIA(texto);
        if (!sanitized) {
            setError(tMsg('invalidQuery', activeLang));
            return null;
        }

        // Bloquear contenido NSFW en contextos no-adultos
        if (cacheConfigRef.current.namespace !== 'nsfw') {
            const nsfwCheck = detectNsfwQuery(sanitized, activeLang);
            if (nsfwCheck.isNsfw) {
                setNsfwRedirect(true);
                setError(nsfwCheck.message);
                setCargando(false);
                trackIAEvent('ia_search_blocked', {
                    query: sanitized,
                    reason: 'nsfw_redirect',
                    namespace: cacheConfigRef.current.namespace,
                });
                return null;
            }
        }

        const risk = getPromptInjectionRisk(sanitized);
        if (promptProtectionRef.current && risk.level === 'high') {
            setError(tMsg('promptBlocked', activeLang));
            trackIAEvent('ia_search_blocked', {
                query: sanitized,
                reason: 'prompt_injection_high',
                namespace: cacheConfigRef.current.namespace,
            });
            return null;
        }

        const cached = getFromCache(sanitized, cacheConfigRef.current);
        if (cached && !cached.stale) {
            setResultados(normalizeSeries(cached.data));
            setError(null);
            trackSearch(sanitized);
            trackIAEvent('ia_search', {
                query: sanitized,
                result_count: (cached.data.series || []).length,
                source: 'cache',
                prompt_risk: risk.level,
            });
            return cached.data;
        }

        return buscarConIA(sanitized);
    }, [buscarConIA, trackSearch]);

    // Restaura resultados desde caché sin llamar a la API
    const restaurarDesdeCache = useCallback((query) => {
        if (!query) return false;
        const cached = getFromCache(query.trim(), cacheConfigRef.current, { allowStale: true });
        if (cached) {
            setResultados(normalizeSeries(cached.data));
            setError(null);
            return true;
        }
        return false;
    }, []);

    const limpiar = useCallback(() => {
        // Cancelar búsqueda activa si hay
        if (activeControllerRef.current) {
            activeControllerRef.current.abort();
            activeControllerRef.current = null;
        }
        setResultados(null);
        setError(null);
        setNsfwRedirect(false);
        setCargando(false);
        // No reseteamos guestAiLimit ni userAiLimit: la cuota es independiente
        // de los resultados de búsqueda y debe persistir entre limpiezas.
    }, []);

    return {
        buscarConIA,
        buscarConIACached,
        restaurarDesdeCache,
        cargando,
        error,
        nsfwRedirect,
        resultados,
        searchCount,
        guestAiLimit,
        userAiLimit,
        limpiar,
    };
}
