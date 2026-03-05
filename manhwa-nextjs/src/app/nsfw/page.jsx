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

async function getAdultSeries() {
  try {
    const res = await fetch(`${SERVER_API_BASE}/series?adult=only&limit=100&sort=updated_at&order=desc`, {
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
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

export default async function NsfwPage() {
  const initialSeries = await getAdultSeries()
  return <NsfwClient initialSeries={initialSeries} />
}
