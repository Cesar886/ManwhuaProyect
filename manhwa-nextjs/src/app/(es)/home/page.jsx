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
  const result = await fetchInternalJson('/spaces/manhwas', { revalidate: 300, requireNonEmpty: true })
  return extractSeries(result)
}

function getFirstCover(series) {
  for (const s of series) {
    const url = s?.coverUrl || s?.cover_url || s?.cover || s?.image || s?.coverUrlWeb || s?.cover_url_web || s?.coverUrlTmo || s?.cover_url_tmo || s?.coverUrlOni || s?.cover_url_oni
    if (url && s?.slug) return url
  }
  return null
}

function getHeroPreloadUrl(url) {
  if (!url) return ''

  try {
    const imageUrl = new URL(url)
    if (imageUrl.hostname !== 'oni.ntr-files.online') return url

    return `/_next/image?url=${encodeURIComponent(url)}&w=828&q=55`
  } catch {
    return url
  }
}

export default async function Home() {
  const initialSeries = filterAvailableSeriesForLang(await getInitialSeries(), 'es')
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
