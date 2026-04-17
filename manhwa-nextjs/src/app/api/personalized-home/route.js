import { NextResponse } from 'next/server';

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
const QUERY_TTL = 3 * 60 * 1000;
const MAX_HISTORY = 20;
const SUPPORTED_LANGS = ['es', 'en'];

// Caché separada por idioma: una query idéntica en /es vs /en no colisiona.
let queryCache = new Map();
let catalogCache = null;
let catalogCacheTime = 0;
const CATALOG_TTL = 10 * 60 * 1000;

// Resuelve el idioma del request en este orden:
//   1) ?lang=en|es en el querystring.
//   2) body.lang (solo en POST).
//   3) Header Referer: /en/... → 'en', el resto → 'es'.
//   4) Default 'es'.
function resolveLang(request, body) {
  const url = new URL(request.url);
  const q = url.searchParams.get('lang');
  if (q && SUPPORTED_LANGS.includes(q)) return q;
  const bodyLang = body && typeof body.lang === 'string' ? body.lang : null;
  if (bodyLang && SUPPORTED_LANGS.includes(bodyLang)) return bodyLang;
  const referer = request.headers.get('referer') || request.headers.get('referrer') || '';
  try {
    const r = new URL(referer);
    const seg = (r.pathname || '/').split('/').filter(Boolean)[0] || '';
    if (seg === 'en') return 'en';
    if (seg === 'es') return 'es';
  } catch { /* referer inválido: ignorar */ }
  return 'es';
}

const normTitle = (t) =>
  String(t || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

function getCover(s) {
  return s?.cover || s?.coverUrl || s?.cover_url || s?.coverUrlWeb || s?.cover_url_web || '';
}

function getChapters(s) {
  return s?.chapterCount ?? s?.chaptersCount ?? s?.chapters_count ?? s?.totalChapters ?? s?.chapter_count ?? 0;
}

function pruneQueryCache() {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (!value?.time || now - value.time >= QUERY_TTL) {
      queryCache.delete(key);
    }
  }
  if (queryCache.size > 300) {
    queryCache.clear();
  }
}

function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];

  const seen = new Set();
  const out = [];
  const now = Date.now();

  for (const raw of rawHistory) {
    const value = typeof raw === 'object' && raw !== null
      ? String(raw.query || '').trim()
      : String(raw || '').trim();

    if (value.length < 3 || value.length > 220) continue;

    const key = normTitle(value);
    if (!key || seen.has(key)) continue;

    let ts = typeof raw === 'object' && raw !== null ? raw.ts : null;
    if (typeof ts === 'string') {
      const parsed = Date.parse(ts);
      ts = Number.isFinite(parsed) ? parsed : null;
    }
    if (!Number.isFinite(ts)) {
      ts = now;
    }

    seen.add(key);
    out.push({ query: value, ts });
    if (out.length >= MAX_HISTORY) break;
  }

  return out;
}

async function getCatalogMaps() {
  if (catalogCache && Date.now() - catalogCacheTime < CATALOG_TTL) {
    return catalogCache;
  }

  try {
    const res = await fetch(SPACES_URL, {
      headers: {
        Accept: 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return catalogCache || { bySlug: new Map(), byTitle: new Map() };
    }

    const result = await res.json();
    const list = result.data?.series || result.series || [];

    const bySlug = new Map();
    const byTitle = new Map();

    for (const s of list) {
      if (s.slug) bySlug.set(s.slug, s);
      const t = normTitle(s.title);
      if (t && !byTitle.has(t)) byTitle.set(t, s);
    }

    catalogCache = { bySlug, byTitle };
    catalogCacheTime = Date.now();
    return catalogCache;
  } catch {
    return catalogCache || { bySlug: new Map(), byTitle: new Map() };
  }
}

function enrichCarousels(carousels, catalogMaps) {
  const { bySlug, byTitle } = catalogMaps;

  return (Array.isArray(carousels) ? carousels : [])
    .map((carousel) => {
      const enrichedSeries = (Array.isArray(carousel?.series) ? carousel.series : [])
        .map((s) => {
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
        })
        .filter((s) => s.slug && s.title);

      return {
        type: carousel?.type || 'personalized',
        title: String(carousel?.title || '').trim(),
        subtitle: String(carousel?.subtitle || '').trim(),
        query: String(carousel?.query || '').trim(),
        rowScore: Number(carousel?.rowScore) || 0,
        source: String(carousel?.source || '').trim(),
        series: enrichedSeries,
      };
    })
    .filter((row) => row.title && row.query && row.series.length >= 3);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const lang = resolveLang(request, body);
    const history = sanitizeHistory(body?.history);

    if (history.length === 0) {
      return NextResponse.json({ data: [], fromCache: false, lang });
    }

    // Scoping por idioma: mismo history en /es y /en nunca comparten fila cacheada
    const cacheKey = `${lang}|` + history.map((h) => `${normTitle(h.query)}@${Math.floor(Number(h.ts) / (6 * 60 * 60 * 1000))}`).join('|');
    pruneQueryCache();

    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.time < QUERY_TTL && Array.isArray(cached.rows)) {
      return NextResponse.json({ data: cached.rows, fromCache: true, lang });
    }

    const aiRes = await fetch(`${AI_BASE_URL}/api/personalized-carousels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lang': lang },
      body: JSON.stringify({ history, limitRows: 8, limitItems: 10, lang }),
      next: { revalidate: 0 },
    });

    if (!aiRes.ok) {
      return NextResponse.json({ data: [], fromCache: false, lang });
    }

    const aiData = await aiRes.json().catch(() => ({}));
    const rawRows = Array.isArray(aiData?.carousels) ? aiData.carousels : [];

    if (rawRows.length === 0) {
      return NextResponse.json({ data: [], fromCache: false, lang });
    }

    const catalogMaps = await getCatalogMaps();
    const rows = enrichCarousels(rawRows, catalogMaps);

    queryCache.set(cacheKey, {
      rows,
      time: Date.now(),
    });

    return NextResponse.json({ data: rows, fromCache: false, lang });
  } catch {
    return NextResponse.json({ data: [], fromCache: false });
  }
}
