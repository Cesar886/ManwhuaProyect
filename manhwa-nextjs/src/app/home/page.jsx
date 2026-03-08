import HomeClient from './HomeClient'
import { endpoint, SITE_URL } from '../../config'
import { generateFAQJsonLdForHome } from '@/lib/seo/jsonld'
import { filterAvailableSeries } from '@/utils/adultContent'

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

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

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

export default async function Home() {
  const initialSeries = filterAvailableSeries(await getInitialSeries())

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQJsonLdForHome()) }}
      />
      <HomeClient initialSeries={initialSeries} />
    </>
  )
}
