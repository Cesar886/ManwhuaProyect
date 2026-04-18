import { SITE_URL } from '@/config'
import { fetchAllSeriesForSitemap } from '@/lib/seo/fetchSeries'
import { buildUrlset, urlEntry, urlEntryWithAlternates, xmlResponse } from '@/lib/seo/xml'
import {
  filterAvailableSeries,
  getSeriesLanguages,
  DEFAULT_LANG,
} from '@/utils/adultContent'

// force-dynamic: el sitemap siempre se genera en runtime con datos frescos
export const dynamic = 'force-dynamic'

// ──────────────────────────────────────────────────────────────────
// Páginas estáticas públicas con equivalente en ambos idiomas
// (emiten hreflang alternates entre sí)
// ──────────────────────────────────────────────────────────────────
const BILINGUAL_STATIC_PAGES = [
  { es: '/home',       en: '/en/home',     priority: '1.0', freq: 'daily'   },
  { es: '/populares',  en: '/en/popular',  priority: '0.9', freq: 'daily'   },
  { es: '/biblioteca',   en: '/en/library',    priority: '0.8', freq: 'daily'   },
  { es: '/mangas',       en: '/en/manga',      priority: '0.8', freq: 'daily'   },
  { es: '/busqueda-ia',  en: '/en/search-ai',  priority: '0.7', freq: 'weekly'  },
  // Legales (existen en ambos idiomas)
  { es: '/acerca-de',               en: '/en/about',            priority: '0.4', freq: 'monthly' },
  { es: '/dmca',                    en: '/en/dmca',             priority: '0.3', freq: 'yearly'  },
  { es: '/terminos-de-servicio',    en: '/en/terms-of-service', priority: '0.3', freq: 'yearly'  },
  { es: '/politica-de-privacidad',  en: '/en/privacy-policy',   priority: '0.3', freq: 'yearly'  },
  { es: '/aviso-legal',             en: '/en/legal-notice',     priority: '0.3', freq: 'yearly'  },
]

// Páginas solo en ES (sin equivalente EN en el repo actual)
const ES_ONLY_PAGES = [
  { path: '/colecciones', priority: '0.7', freq: 'weekly' },
  { path: '/buscar',      priority: '0.5', freq: 'weekly' },
  { path: '/blog',        priority: '0.5', freq: 'weekly' },
]

// Géneros con página dedicada (src/app/(es)/genero/[genre]/page.jsx)
const GENRE_SLUGS = [
  'accion', 'romance', 'fantasia', 'drama', 'comedia', 'escolar',
  'artes-marciales', 'terror', 'ciencia-ficcion', 'aventura',
  'supernatural', 'misterio', 'historico', 'venganza', 'isekai', 'sistema',
]

function bilingualAlternates(esPath, enPath) {
  return [
    { hreflang: 'es',        href: `${SITE_URL}${esPath}` },
    { hreflang: 'en',        href: `${SITE_URL}${enPath}` },
    { hreflang: 'x-default', href: `${SITE_URL}${esPath}` },
  ]
}

function seriesAlternates(slug, languages) {
  const alt = []
  if (languages.includes('es')) {
    alt.push({ hreflang: 'es', href: `${SITE_URL}/manhwa/${slug}` })
  }
  if (languages.includes('en')) {
    alt.push({ hreflang: 'en', href: `${SITE_URL}/en/manhwa/${slug}` })
  }
  if (alt.length > 0) {
    const def = alt.find(a => a.hreflang === 'es') || alt[0]
    alt.push({ hreflang: 'x-default', href: def.href })
  }
  return alt
}

export async function GET() {
  const allSeries = filterAvailableSeries(await fetchAllSeriesForSitemap())
  const now = new Date().toISOString()
  const urls = []

  // 1) Páginas bilingües (con hreflang)
  for (const p of BILINGUAL_STATIC_PAGES) {
    const alt = bilingualAlternates(p.es, p.en)
    urls.push(urlEntryWithAlternates(`${SITE_URL}${p.es}`, now, p.freq, p.priority, alt))
    urls.push(urlEntryWithAlternates(`${SITE_URL}${p.en}`, now, p.freq, p.priority, alt))
  }

  // 2) Páginas solo ES
  for (const p of ES_ONLY_PAGES) {
    urls.push(urlEntry(`${SITE_URL}${p.path}`, now, p.freq, p.priority))
  }

  // 3) Páginas de género (solo existen en ES actualmente)
  for (const slug of GENRE_SLUGS) {
    urls.push(urlEntry(`${SITE_URL}/genero/${slug}`, now, 'weekly', '0.6'))
  }

  // 4) Series — una entrada por idioma, con alternates que apuntan entre sí
  for (const s of allSeries) {
    if (!s?.slug) continue
    const lastmod = new Date(
      s.lastUpdated || s.updatedAt || s.updated_at || Date.now()
    ).toISOString()

    const langs = getSeriesLanguages(s)
    const effectiveLangs = langs.length > 0 ? langs : [DEFAULT_LANG]
    const alt = seriesAlternates(s.slug, effectiveLangs)

    if (effectiveLangs.includes('es')) {
      urls.push(urlEntryWithAlternates(
        `${SITE_URL}/manhwa/${s.slug}`, lastmod, 'daily', '0.9', alt,
      ))
    }
    if (effectiveLangs.includes('en')) {
      urls.push(urlEntryWithAlternates(
        `${SITE_URL}/en/manhwa/${s.slug}`, lastmod, 'daily', '0.9', alt,
      ))
    }
  }

  return xmlResponse(buildUrlset(urls, { withXhtml: true }))
}
