// src/hooks/useIA.js
import { useState, useCallback, useRef } from 'react';

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read';

const CACHE_TTL = 15 * 60 * 1000; // 15 minutos
const CACHE_PREFIX = 'ia_cache_';
const CACHE_INDEX_KEY = 'ia_cache_index';
const MAX_CACHE_ENTRIES = 20;
const SEARCH_COOLDOWN = 3000; // 3s entre búsquedas a la API
const MAX_QUERY_LENGTH = 300;

// Analytics helper — envía eventos a Google Analytics si está disponible
function trackIAEvent(eventName, params) {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
    }
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
        .slice(0, 120);
}

function getCacheKey(query) {
    return `${CACHE_PREFIX}${slugifyQuery(query)}`;
}

// --- Índice de caché para eviction eficiente ---
function getCacheIndex() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(CACHE_INDEX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCacheIndex(index) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    } catch { /* ignore */ }
}

function evictOldEntries() {
    if (typeof window === 'undefined') return;
    try {
        const index = getCacheIndex();
        if (index.length <= MAX_CACHE_ENTRIES) return;
        index.sort((a, b) => a.ts - b.ts);
        const toRemove = index.length - MAX_CACHE_ENTRIES;
        for (let i = 0; i < toRemove; i++) {
            sessionStorage.removeItem(index[i].key);
        }
        saveCacheIndex(index.slice(toRemove));
    } catch { /* ignore */ }
}

function getFromCache(query, { allowStale = false } = {}) {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(getCacheKey(query));
        if (!raw) return null;
        const cached = JSON.parse(raw);
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

function saveToCache(query, data) {
    if (typeof window === 'undefined') return;
    try {
        const key = getCacheKey(query);
        const trimmed = query.trim();

        // Guardar solo los campos necesarios de cada serie para reducir tamaño
        const leanData = {
            ...data,
            series: (data.series || []).map(s => ({
                id: s.id,
                slug: s.slug,
                title: s.title,
                cover: s.cover || s.coverUrl || s.cover_url || null,
                chapterCount: s.chapterCount || s.totalChapters || (s.chapters || []).length || 0,
            })),
        };

        sessionStorage.setItem(key, JSON.stringify({
            data: leanData,
            originalQuery: trimmed,
            timestamp: Date.now(),
        }));

        // Actualizar índice
        const index = getCacheIndex().filter(e => e.key !== key);
        index.push({ key, ts: Date.now() });
        saveCacheIndex(index);

        evictOldEntries();
    } catch {
        // sessionStorage lleno — ignorar
    }
}

// Devuelve las últimas N búsquedas del historial de caché
export function getSearchHistory(limit = 5) {
    const index = getCacheIndex();
    return index
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit)
        .map(entry => {
            const slug = entry.key.replace(CACHE_PREFIX, '');
            const original = getOriginalQuery(slug);
            return original ? { query: original, slug, ts: entry.ts } : null;
        })
        .filter(Boolean);
}

// Elimina una entrada del historial de búsquedas
export function removeFromHistory(slug) {
    if (typeof window === 'undefined') return;
    try {
        const key = `${CACHE_PREFIX}${slug}`;
        sessionStorage.removeItem(key);
        const index = getCacheIndex().filter(e => e.key !== key);
        saveCacheIndex(index);
    } catch { /* ignore */ }
}

// Recupera el query original almacenado en el caché para un slug dado
export function getOriginalQuery(slug) {
    if (typeof window === 'undefined') return null;
    try {
        const key = `${CACHE_PREFIX}${slug}`;
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        return cached.originalQuery || null;
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

export function useIA() {
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);
    const [resultados, setResultados] = useState(null);

    // Ref para cancelar búsquedas anteriores (race condition fix)
    const activeControllerRef = useRef(null);
    // Ref para rate limiting
    const lastSearchTimeRef = useRef(0);

    const buscarConIA = useCallback(async (texto) => {
        if (!texto || texto.trim().length === 0) {
            setError('Por favor escribe una pregunta');
            return null;
        }

        const trimmed = texto.trim().slice(0, MAX_QUERY_LENGTH);

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
                setResultados(data);
                saveToCache(trimmed, data);
                trackIAEvent('ia_search', {
                    query: trimmed,
                    result_count: (data.series || []).length,
                    source: 'api',
                    latency_ms: latencyMs,
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
            const staleCache = getFromCache(trimmed, { allowStale: true });
            if (staleCache) {
                setResultados(staleCache.data);
                setError(null);
                setCargando(false);
                trackIAEvent('ia_search', {
                    query: trimmed,
                    result_count: (staleCache.data.series || []).length,
                    source: 'stale_cache',
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

        const cached = getFromCache(texto.trim());
        if (cached && !cached.stale) {
            setResultados(cached.data);
            setError(null);
            trackIAEvent('ia_search', {
                query: texto.trim(),
                result_count: (cached.data.series || []).length,
                source: 'cache',
            });
            return cached.data;
        }

        return buscarConIA(texto);
    }, [buscarConIA]);

    // Restaura resultados desde caché sin llamar a la API
    const restaurarDesdeCache = useCallback((query) => {
        if (!query) return false;
        const cached = getFromCache(query.trim(), { allowStale: true });
        if (cached) {
            setResultados(cached.data);
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
