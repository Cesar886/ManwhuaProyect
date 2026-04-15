/**
 * Última serie vista por el usuario (funciona para anon + logueado).
 * Persiste en localStorage para poder personalizar secciones como "Similar a X"
 * incluso cuando el usuario no tiene reading progress backend.
 */

const LAST_VIEWED_KEY = 'mi_last_viewed_series';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export function setLastViewedSeries({ slug, title, cover } = {}) {
    if (typeof window === 'undefined') return;
    if (!slug || !title) return;
    try {
        const payload = {
            slug: String(slug),
            title: String(title),
            cover: cover ? String(cover) : null,
            ts: Date.now(),
        };
        window.localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(payload));
    } catch {
        // localStorage puede fallar en incognito estricto → ignorar silenciosamente
    }
}

export function getLastViewedSeries() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(LAST_VIEWED_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.slug || !parsed.title) return null;
        // Expira tras 30 días para evitar sugerir algo abandonado hace mucho
        if (parsed.ts && (Date.now() - parsed.ts) > MAX_AGE_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function clearLastViewedSeries() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(LAST_VIEWED_KEY);
    } catch { /* ignore */ }
}
