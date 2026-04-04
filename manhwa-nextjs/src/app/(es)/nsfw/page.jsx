import { SERVER_API_BASE, SITE_URL } from '@/config'
import { isAdultSeries, hasAvailableChapters } from '@/utils/adultContent'
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
    // Usar /spaces/manhwas que tiene chapterCount real de DigitalOcean Spaces
    const res = await fetch(`${SERVER_API_BASE}/spaces/manhwas`, {
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) return []

    const result = await res.json().catch(() => null)
    const series = result?.data?.series || result?.series || []
    if (!Array.isArray(series)) return []

    // Filtrar solo series adultas que tengan capítulos en Spaces
    return series.filter((s) => s && s.title && isAdultSeries(s) && hasAvailableChapters(s))
  } catch {
    return []
  }
}

export default async function NsfwPage() {
  const initialSeries = await getAdultSeries()
  return <NsfwClient initialSeries={initialSeries} />
}
