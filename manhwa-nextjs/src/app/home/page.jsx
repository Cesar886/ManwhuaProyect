import HomeClient from './HomeClient'
import { endpoint } from '../../config'

// ============================================================================
// SERVER COMPONENT - Fetches initial data para SSR
// Beneficios:
//   - LCP image está en el HTML inicial → browser puede hacer preload
//   - fetchpriority="high" es efectivo desde el primer render
//   - ISR con revalidate=300 → datos cacheados 5min en el edge
// ============================================================================

async function getInitialSeries() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
    const res = await fetch(endpoint('spaces', 'manhwas'), {
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
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
  const initialSeries = await getInitialSeries()
  return <HomeClient initialSeries={initialSeries} />
}
