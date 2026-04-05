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

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
const MAX_QUERIES = 5;
const DELAY_MS = 1000;
const RETRYABLE_AI_STATUS_CODES = new Set([502, 503, 504]);

// Caché en memoria del servidor
let serverCache = null;
let serverCacheTime = 0;
let inFlightRefresh = null;

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

export async function GET() {
  // Devolver caché si está fresco
  if (serverCache && Date.now() - serverCacheTime < CACHE_TTL) {
    return NextResponse.json({ data: serverCache, fromCache: true });
  }

  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    // Cargar catálogo para enriquecer covers
    const { bySlug, byTitle } = await getCatalogMaps();

    // 1. Obtener queries populares
    const popRes = await fetchWithRetry(`${AI_BASE_URL}/api/popular?limit=20`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
    });
    if (!popRes.ok) return NextResponse.json({ data: [] });

    const popData = await popRes.json();
    if (!popData.success || !Array.isArray(popData.queries)) return NextResponse.json({ data: [] });

    const queries = popData.queries
      .filter((q) => q.query && q.query.trim().length > 3)
      .slice(0, MAX_QUERIES);

    if (queries.length === 0) return NextResponse.json({ data: [] });

    // 2. Llamar a /api/read secuencialmente y enriquecer con catálogo
    const accumulated = [];

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      try {
        const res = await fetchWithRetry(`${AI_BASE_URL}/api/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: q.query }] }),
          next: { revalidate: 0 },
        });
        if (res.ok) {
          const result = await res.json();
          const seriesList = result.series || [];
          const mapped = seriesList.slice(0, 15).map((s) => {
            // Buscar en catálogo por slug y por título normalizado
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
            };
          }).filter((s) => s.slug && s.title);

          if (mapped.length >= 3) {
            accumulated.push({ query: q.query, count: q.count, series: mapped });
          }
        }
      } catch {
        // ignorar error individual
      }
      if (i < queries.length - 1) await delay(DELAY_MS);
    }

    if (accumulated.length > 0) {
      serverCache = accumulated;
      serverCacheTime = Date.now();
    }

    return NextResponse.json({ data: accumulated, fromCache: false });
  })()
    .catch(() => NextResponse.json({ data: [] }))
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}
