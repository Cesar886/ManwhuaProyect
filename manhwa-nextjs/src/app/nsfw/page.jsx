import { SERVER_API_BASE, SITE_URL } from '../../config'
import NsfwClient from './NsfwClient'

export const metadata = {
  title: 'Contenido +18 | Manhwa Imperial',
  description: 'Sección exclusiva para adultos (+18). Manhwas con contenido maduro y adulto.',
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/nsfw` },
}

export const revalidate = 300

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

const toSafeSeriesArray = (value) => {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item === 'object' && typeof item.title === 'string' && item.title.trim())
}

async function getAdultSeries() {
  const queryVariants = [
    'adult=only&limit=100&sort=updated_at&order=desc',
    'adult=only&limit=100',
    'adult=true&limit=100',
  ]

  try {
    for (const query of queryVariants) {
      const res = await fetch(`${SERVER_API_BASE}/series?${query}`, {
        headers: {
          'Accept': 'application/json',
          'Origin': SITE_URL,
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        next: { revalidate: 300 },
      })

      if (!res.ok) {
        if (res.status === 400 || res.status === 422) continue
        return []
      }

      const result = await res.json().catch(() => null)
      const safeSeries = toSafeSeriesArray(result?.data?.series || result?.series || [])
      if (safeSeries.length > 0) return safeSeries
    }

    return []
  } catch {
    return []
  }
}

export default async function NsfwPage() {
  const initialSeries = await getAdultSeries()
  return <NsfwClient initialSeries={initialSeries} />
}
