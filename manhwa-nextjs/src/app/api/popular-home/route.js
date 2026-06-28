import { NextResponse } from 'next/server';

// API route con caché server-side compartido entre todos los usuarios.
// Enriquece los covers desde el catálogo de Spaces para que el cliente
// siempre reciba datos completos, sin depender del coverRegistry.

const AI_BASE_URL = (process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read')
  .replace('/api/read', '');

const SPACES_URL = (() => {
  const base = (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL_PROD ||
    process.env.NEXT_PUBLIC_API_URL_LOCAL ||
    ''
  ).replace(/\/$/, '');
  const hasApi = base.endsWith('/api');
  return `${base}${hasApi ? '' : '/api'}/spaces/manhwas`;
})();

const API_KEY = process.env.INTERNAL_API_KEY || '';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
const MAX_EACH = 5;              // 5 populares + 5 similares = 10 total
const READ_TIMEOUT_MS = 5000;    // máx por llamada individual a /api/read
const TOTAL_TIMEOUT_MS = 8000;   // máx total antes de devolver resultados parciales
const RETRYABLE_AI_STATUS_CODES = new Set([502, 503, 504]);
const SUPPORTED_LANGS = ['es', 'en'];

// Caché en memoria del servidor, SEPARADA por idioma: ES y EN nunca se mezclan.
const serverCacheByLang = { es: { data: null, time: 0 }, en: { data: null, time: 0 } };
const inFlightRefreshByLang = { es: null, en: null };

function resolveLang(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('lang');
  if (q && SUPPORTED_LANGS.includes(q)) return q;
  const referer = request.headers.get('referer') || request.headers.get('referrer') || '';
  try {
    const r = new URL(referer);
    const seg = (r.pathname || '/').split('/').filter(Boolean)[0] || '';
    if (seg === 'en') return 'en';
    if (seg === 'es') return 'es';
  } catch { /* ignorar */ }
  return 'es';
}

// Caché del catálogo (se renueva cada 10 min)
let catalogCache = null;
let catalogCacheTime = 0;
const CATALOG_TTL = 10 * 60 * 1000;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchWithRetry(url, options, retries = 1, retryDelay = 900) {
  let response = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    response = await fetch(url, options);

    if (response.ok || !RETRYABLE_AI_STATUS_CODES.has(response.status) || attempt === retries) {
      return response;
    }

    await delay(retryDelay * (attempt + 1));
  }

  return response;
}

const normTitle = (t) =>
  String(t || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

async function getCatalogMaps() {
  if (catalogCache && Date.now() - catalogCacheTime < CATALOG_TTL) {
    return catalogCache;
  }
  try {
    const res = await fetch(SPACES_URL, {
      headers: {
        'Accept': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return catalogCache || { bySlug: new Map(), byTitle: new Map() };
    const result = await res.json();
    const list = result.data?.series || result.series || [];

    const bySlug = new Map();
    const byTitle = new Map();
    for (const s of list) {
      if (s.slug) bySlug.set(s.slug, s);
      const t = normTitle(s.title);
      if (t) byTitle.set(t, s);
    }
    catalogCache = { bySlug, byTitle };
    catalogCacheTime = Date.now();
    return catalogCache;
  } catch {
    return catalogCache || { bySlug: new Map(), byTitle: new Map() };
  }
}

function getCover(s) {
  return s?.cover || s?.coverUrl || s?.cover_url || s?.coverUrlWeb || s?.cover_url_web || '';
}

function getChapters(s) {
  return s?.chapterCount ?? s?.chaptersCount ?? s?.chapters_count ?? s?.totalChapters ?? s?.chapter_count ?? 0;
}

export async function GET(request) {
  const lang = resolveLang(request);
  const bucket = serverCacheByLang[lang];

  // Devolver caché si está fresco (del idioma correcto)
  if (bucket.data && Date.now() - bucket.time < CACHE_TTL) {
    return NextResponse.json({ data: bucket.data, fromCache: true, lang }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  }

  if (inFlightRefreshByLang[lang]) {
    return inFlightRefreshByLang[lang];
  }

  inFlightRefreshByLang[lang] = (async () => {
    // Cargar catálogo para enriquecer covers
    const { bySlug, byTitle } = await getCatalogMaps();

    // 1. Obtener populares y similares por separado desde /api/search-suggestions
    //    Pasamos lang para que el servidor use el bucket correcto.
    const sugRes = await fetchWithRetry(`${AI_BASE_URL}/api/search-suggestions?lang=${lang}`, {
      headers: { 'Accept': 'application/json', 'X-Lang': lang },
      next: { revalidate: 0 },
    });
    const cacheHeaders = { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } };
    if (!sugRes.ok) return NextResponse.json({ data: [], lang }, cacheHeaders);

    const sugData = await sugRes.json();
    if (!sugData.success) return NextResponse.json({ data: [], lang }, cacheHeaders);

    const popularQueries = (sugData.popular || [])
      .filter((q) => q.query && q.query.trim().length > 3)
      .slice(0, MAX_EACH);

    const similarQueries = (sugData.similar || [])
      .filter((q) => q.query && q.query.trim().length > 3)
      .slice(0, MAX_EACH);

    // Intercalar: popular, similar, popular, similar, ...
    const interleaved = [];
    const maxLen = Math.max(popularQueries.length, similarQueries.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < popularQueries.length) interleaved.push({ ...popularQueries[i], type: 'popular' });
      if (i < similarQueries.length) interleaved.push({ ...similarQueries[i], type: 'similar' });
    }

    if (interleaved.length === 0) return NextResponse.json({ data: [], lang }, cacheHeaders);

    // 2. Llamar a /api/read en paralelo con timeout por llamada
    const callRead = async (q) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
      try {
        const res = await fetchWithRetry(`${AI_BASE_URL}/api/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Lang': lang },
          body: JSON.stringify({ messages: [{ role: 'user', content: q.query }], lang }),
          signal: controller.signal,
          next: { revalidate: 0 },
        }, 0); // sin reintentos en paralelo
        if (!res.ok) return null;
        const result = await res.json();
        const seriesList = result.series || [];
        const mapped = seriesList.slice(0, 15).map((s) => {
          const catalog = bySlug.get(s.slug) || byTitle.get(normTitle(s.title));
          const cover = getCover(catalog) || getCover(s);
          const chapterCount = getChapters(catalog) || getChapters(s);
          return {
            id: s.id ?? catalog?.id,
            title: s.title,
            slug: s.slug || catalog?.slug,
            cover,
            chapterCount,
            status: catalog?.status || s.status || 'ongoing',
            isAdult: s.isAdult ?? catalog?.isAdult,
            is_adult: s.is_adult ?? catalog?.is_adult,
            genres: Array.isArray(s.genres) ? s.genres : (catalog?.genres || []),
            contentType: catalog?.contentType || catalog?.content_type || s.contentType || '',
            language: catalog?.language || catalog?.lang || s.language || s.lang || null,
          };
        }).filter((s) => s.slug && s.title);
        return mapped.length >= 3 ? { query: q.query, count: q.count, type: q.type, series: mapped } : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    // Timeout global: devolver lo que ya completó si se supera el límite
    const callsWithFallback = interleaved.map((q) =>
      callRead(q).catch(() => null)
    );
    const partialResults = new Array(callsWithFallback.length).fill(null);
    callsWithFallback.forEach((p, i) => p.then((v) => { partialResults[i] = v; }));

    const timeoutGuard = new Promise((resolve) =>
      setTimeout(resolve, TOTAL_TIMEOUT_MS)
    );
    await Promise.race([Promise.all(callsWithFallback), timeoutGuard]);

    const rawResults = partialResults;

    // Mantener el orden intercalado original
    const accumulated = rawResults.filter(Boolean);

    if (accumulated.length > 0) {
      bucket.data = accumulated;
      bucket.time = Date.now();
    }

    return NextResponse.json({ data: accumulated, fromCache: false, lang }, cacheHeaders);
  })()
    .catch(() => NextResponse.json({ data: [], lang }, { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }))
    .finally(() => {
      inFlightRefreshByLang[lang] = null;
    });

  return inFlightRefreshByLang[lang];
}
