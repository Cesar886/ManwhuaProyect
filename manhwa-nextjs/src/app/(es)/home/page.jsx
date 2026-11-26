import HomeClient from './HomeClient'
import { generateFAQJsonLdForHome, generateHomePageJsonLd } from '@/lib/seo/jsonld'
import { filterAvailableSeriesForLang } from '@/utils/adultContent'
import { extractSeries, fetchInternalJson } from '@/lib/seo/serverFetch'

// La home se renderiza en runtime; el contenido SSR no se fabrica durante build.
export const dynamic = 'force-dynamic'

// ============================================================================
// SERVER COMPONENT - Fetches initial data para SSR
// Beneficios:
//   - LCP image está en el HTML inicial → browser puede hacer preload
//   - fetchpriority="high" es efectivo desde el primer render
//   - ISR con revalidate=300 → datos cacheados 5min en el edge
//
// Nota: Las queries populares se cargan client-side para no bloquear el SSR
// (cada query requiere un fetch adicional al API de búsqueda ~1.5s)
// ============================================================================

async function getInitialSeries() {
  try {
    // La ruta Spaces puede esperar decenas de segundos a la precarga en desarrollo.
    // La lista de series responde desde BD rápidamente y trae las cuatro variantes.
    const result = await fetchInternalJson('/series?limit=100&sort=updated_at&order=desc', { revalidate: 300, requireNonEmpty: true })
    return extractSeries(result)
  } catch (error) {
    // Keep the page usable when the API is temporarily unavailable. HomeClient
    // retries the same request in the browser once the page has rendered.
    console.error('[home] No se pudieron cargar las series iniciales:', error)
    return []
  }
}

function getFirstCover(series) {
  for (const s of series) {
    const url = s?.cover_url || s?.cover_url_web || s?.cover_url_tmo || s?.cover_url_oni || s?.coverUrl || s?.coverUrlWeb || s?.coverUrlTmo || s?.coverUrlOni || s?.cover || s?.image
    if (url && s?.slug) return url
    if (s?.slug) return `https://oni.ntr-files.online/public/archivos/mangas/${encodeURIComponent(s.slug)}/cover.jpg`
  }
  return null
}

async function prioritizeSeriesWithAvailableOniCover(series) {
  const candidates = series.slice(0, 30).filter((item) => item?.slug && !(
    item.cover_url || item.cover_url_web || item.cover_url_tmo || item.cover_url_oni ||
    item.coverUrl || item.coverUrlWeb || item.coverUrlTmo || item.coverUrlOni
  ))
  if (candidates.length === 0) return series

  const checks = await Promise.all(candidates.map(async (item) => {
    const coverUrl = `https://oni.ntr-files.online/public/archivos/mangas/${encodeURIComponent(item.slug)}/cover.jpg`
    try {
      const response = await fetch(coverUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 3600 },
      })
      return response.ok ? item.slug : null
    } catch {
      return null
    }
  }))
  const availableSlug = checks.find(Boolean)
  if (!availableSlug) return series

  const index = series.findIndex((item) => item.slug === availableSlug)
  if (index <= 0) return series
  return [series[index], ...series.slice(0, index), ...series.slice(index + 1)]
}

function getHeroPreloadUrl(url) {
  if (!url) return ''
  if (process.env.NODE_ENV === 'development') return url

  try {
    const imageUrl = new URL(url)
    if (imageUrl.hostname !== 'oni.ntr-files.online') return url

    return `/_next/image?url=${encodeURIComponent(url)}&w=828&q=55`
  } catch {
    return url
  }
}

export default async function Home() {
  const fetchedSeries = filterAvailableSeriesForLang(await getInitialSeries(), 'es')
  const initialSeries = await prioritizeSeriesWithAvailableOniCover(fetchedSeries)
  const firstCover = getFirstCover(initialSeries)

  return (
    <>
      {/* Preload del cover hero para mejorar LCP */}
      {firstCover && (
        <link rel="preload" as="image" href={getHeroPreloadUrl(firstCover)} fetchPriority="high" />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateHomePageJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQJsonLdForHome()) }}
      />
      <HomeClient initialSeries={initialSeries} />
    </>
  )
}
