import HomeClient from './HomeClient'
import { endpoint, SITE_URL } from '@/config'
import { generateFAQJsonLdForHome, generateHomePageJsonLd } from '@/lib/seo/jsonld'
import { filterAvailableSeriesForLang } from '@/utils/adultContent'

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

const API_KEY = process.env.INTERNAL_API_KEY || ''

const defaultHeaders = {
  'Accept': 'application/json',
  'Origin': SITE_URL,
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
}

async function getInitialSeries() {
  try {
    const res = await fetch(endpoint('spaces', 'manhwas'), {
      headers: defaultHeaders,
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const result = await res.json()
    return result.data?.series || result.series || []
  } catch {
    return []
  }
}

function getFirstCover(series) {
  for (const s of series) {
    const url = s?.cover || s?.coverUrl || s?.cover_url || s?.coverUrlWeb || s?.cover_url_web
    if (url && s?.slug) return url
  }
  return null
}

export default async function Home() {
  const initialSeries = filterAvailableSeriesForLang(await getInitialSeries(), 'es')
  const firstCover = getFirstCover(initialSeries)

  return (
    <>
      {/* Preload del cover hero para mejorar LCP */}
      {firstCover && (
        <link rel="preload" as="image" href={firstCover} fetchPriority="high" />
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
