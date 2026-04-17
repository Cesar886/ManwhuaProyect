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
const CATALOG_TTL = 10 * 60 * 1000;
const QUERY_TTL = 5 * 60 * 1000;
const QUERY_MAX_ITEMS = 15;
const SUPPORTED_LANGS = ['es', 'en'];

let catalogCache = null;
let catalogCacheTime = 0;
// Caché key-prefix por idioma: /es y /en nunca comparten similares
let queryCache = new Map();

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

  if (queryCache.size > 250) {
    queryCache.clear();
  }
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = String(searchParams.get('title') || '').trim();
    const excludeSlug = String(searchParams.get('exclude') || '').trim();
    const limitRaw = Number(searchParams.get('limit') || 8);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), QUERY_MAX_ITEMS) : 8;
    const lang = resolveLang(request);

    if (!title) {
      return NextResponse.json({ data: [], query: '', lang });
    }

    // Query en el idioma del visitante: en /en pedimos "similar to X", en /es lo dejamos en español.
    const query = lang === 'en'
      ? `manhwas similar to ${title}`
      : `manhwas similares a ${title}`;
    // Clave scoped por idioma para que ES/EN no compartan el payload del IA.
    const titleKey = `${lang}|${normTitle(title)}`;

    pruneQueryCache();

    let baseMapped = null;
    let fromCache = false;

    const cached = queryCache.get(titleKey);
    if (cached && Date.now() - cached.time < QUERY_TTL && Array.isArray(cached.items)) {
      baseMapped = cached.items;
      fromCache = true;
    }

    if (!baseMapped) {
      const aiRes = await fetch(`${AI_BASE_URL}/api/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lang': lang },
        body: JSON.stringify({ messages: [{ role: 'user', content: query }], lang }),
        next: { revalidate: 0 },
      });

      if (!aiRes.ok) {
        return NextResponse.json({ data: [], query, fromCache: false, lang });
      }

      const aiData = await aiRes.json();
      const aiSeries = Array.isArray(aiData?.series) ? aiData.series : [];

      const { bySlug, byTitle } = await getCatalogMaps();

      baseMapped = aiSeries
        .slice(0, QUERY_MAX_ITEMS)
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
          };
        })
        .filter((s) => s.slug && s.title);

      queryCache.set(titleKey, {
        items: baseMapped,
        time: Date.now(),
      });
    }

    const mapped = (baseMapped || [])
      .filter((s) => !excludeSlug || s.slug !== excludeSlug)
      .slice(0, limit);

    return NextResponse.json({ data: mapped, query, fromCache, lang });
  } catch {
    return NextResponse.json({ data: [], query: '' });
  }
}
