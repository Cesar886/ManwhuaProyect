// src/hooks/useIA.js
import { useState, useCallback, useRef, useEffect } from 'react';

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read';

const CACHE_TTL = 15 * 60 * 1000; // 15 minutos
const DEFAULT_CACHE_PREFIX = 'ia_cache_v3_';
const DEFAULT_CACHE_INDEX_KEY = 'ia_cache_index';
const MAX_CACHE_ENTRIES = 20;
const SEARCH_COOLDOWN = 3000; // 3s entre búsquedas a la API
const MAX_QUERY_LENGTH = 300;
const MAX_QUERY_LINES = 6;
const STORAGE_PROBE_KEY = '__ia_storage_probe__';
const PROMPT_INJECTION_PATTERNS = [
    /\bignore\b.{0,40}\b(previous|above|prior)\b.{0,40}\b(instruction|prompt|message|rule)s?\b/i,
    /\b(system|developer|assistant)\s*[:=]/i,
    /\b(jailbreak|bypass|override|disable)\b.{0,40}\b(safety|policy|guardrail|restriction)s?\b/i,
    /\b(reveal|show|print|dump|expose)\b.{0,40}\b(system\s*prompt|hidden\s*prompt|api\s*key|secret|token)s?\b/i,
    /```[\s\S]*?```/i,
    /<(system|assistant|developer)>[\s\S]*?<\/(system|assistant|developer)>/i,
];

const storageAvailability = {
    local: null,
    session: null,
};

function buildCacheConfig(namespace = 'default') {
    const normalizedNamespace = String(namespace || 'default').trim().toLowerCase();
    if (normalizedNamespace === 'default') {
        return {
            namespace: 'default',
            cachePrefix: DEFAULT_CACHE_PREFIX,
            cacheIndexKey: DEFAULT_CACHE_INDEX_KEY,
            storage: 'session',
        };
    }

    const safeNamespace = normalizedNamespace.replace(/[^a-z0-9_-]/g, '');
    return {
        namespace: safeNamespace || 'default',
        cachePrefix: `${DEFAULT_CACHE_PREFIX}${safeNamespace || 'default'}_`,
        cacheIndexKey: `${DEFAULT_CACHE_INDEX_KEY}_${safeNamespace || 'default'}`,
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
    const cacheConfig = buildCacheConfig(options.namespace);
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
        const cacheConfig = buildCacheConfig(options.namespace);
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
        const cacheConfig = buildCacheConfig(options.namespace);
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
function classifyError(err) {
    if (err.name === 'AbortError') {
        return 'La IA tardó demasiado en responder. Intenta de nuevo.';
    }
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('net::')) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return 'Sin conexión a internet. Revisa tu red e intenta de nuevo.';
        }
        return 'No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.';
    }
    if (err.message?.startsWith('Error 5')) {
        return 'El servidor de IA está temporalmente sobrecargado. Intenta en unos minutos.';
    }
    if (err.message?.startsWith('Error 4')) {
        return err.message;
    }
    return err.message || 'Error al conectar con la IA';
}

export function useIA(options = {}) {
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [resultados, setResultados] = useState(null);
    const cacheConfigRef = useRef(buildCacheConfig(options.namespace));
    const promptProtectionRef = useRef(options.promptProtection !== false);

    useEffect(() => {
        cacheConfigRef.current = buildCacheConfig(options.namespace);
    }, [options.namespace]);

    useEffect(() => {
        promptProtectionRef.current = options.promptProtection !== false;
    }, [options.promptProtection]);

    // Ref para cancelar búsquedas anteriores (race condition fix)
    const activeControllerRef = useRef(null);
    // Ref para rate limiting
    const lastSearchTimeRef = useRef(0);

    const buscarConIA = useCallback(async (texto) => {
        if (!texto || texto.trim().length === 0) {
            setError('Por favor escribe una pregunta');
            return null;
        }

        const sanitized = sanitizeQueryForIA(texto);
        if (!sanitized) {
            setError('Por favor escribe una pregunta válida');
            return null;
        }

        const risk = getPromptInjectionRisk(sanitized);
        if (promptProtectionRef.current && risk.level === 'high') {
            const blockedMessage = 'Tu consulta parece contener instrucciones no permitidas. Reformúlala como una búsqueda de manhwa.';
            setError(blockedMessage);
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
            const response = await fetch(AI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: trimmed }]
                }),
                signal: controller.signal
            });
            const latencyMs = Math.round(performance.now() - t0);

            clearTimeout(timeoutId);

            // Si este controller ya fue reemplazado, ignorar la respuesta
            if (controller !== activeControllerRef.current) return null;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            const data = await response.json();

            if (controller !== activeControllerRef.current) return null;

            if (data.success) {
                const normalized = normalizeSeries(data);
                setResultados(normalized);
                saveToCache(trimmed, normalized, cacheConfigRef.current);
                trackIAEvent('ia_search', {
                    query: trimmed,
                    result_count: (data.series || []).length,
                    source: 'api',
                    latency_ms: latencyMs,
                    prompt_risk: risk.level,
                });
            } else {
                throw new Error('La IA no pudo procesar la solicitud correctamente');
            }

            setCargando(false);
            return data;

        } catch (err) {
            // Si fue abortado por una nueva búsqueda, no tocar el estado
            if (err.name === 'AbortError' && controller !== activeControllerRef.current) {
                return null;
            }

            const errorMsg = classifyError(err);

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
        if (!texto || texto.trim().length === 0) {
            setError('Por favor escribe una pregunta');
            return null;
        }

        const sanitized = sanitizeQueryForIA(texto);
        if (!sanitized) {
            setError('Por favor escribe una pregunta válida');
            return null;
        }

        const risk = getPromptInjectionRisk(sanitized);
        if (promptProtectionRef.current && risk.level === 'high') {
            const blockedMessage = 'Tu consulta parece contener instrucciones no permitidas. Reformúlala como una búsqueda de manhwa.';
            setError(blockedMessage);
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
            trackIAEvent('ia_search', {
                query: sanitized,
                result_count: (cached.data.series || []).length,
                source: 'cache',
                prompt_risk: risk.level,
            });
            return cached.data;
        }

        return buscarConIA(sanitized);
    }, [buscarConIA]);

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
        setCargando(false);
    }, []);

    return {
        buscarConIA,
        buscarConIACached,
        restaurarDesdeCache,
        cargando,
        error,
        resultados,
        limpiar,
    };
}
