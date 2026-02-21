import PopularesClient from './PopularesClient'
import { endpoint } from '../../config'

// ============================================================================
// SERVER COMPONENT — Precarga el ranking de series populares para SSR
//
// Los crawlers de OpenAI, Perplexity, Bing AI y otros no ejecutan JS.
// Al hacer el fetch aquí (en el servidor), el HTML inicial incluye el
// ranking completo, garantizando que los bots indexen los datos.
//
// ISR: revalidate=600 → reconstruye cada 10 minutos (rankings son semi-estáticos)
// ============================================================================

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://manhwaimperial.site'

/**
 * Mapea la respuesta raw de la API al formato de ranking esperado por el UI.
 */
function mapSeriesToRanking(series, index) {
  return {
    id: series.id,
    rank: index + 1,
    slug: series.slug,
    title: series.title,
    cover: series.coverUrl || series.cover || series.cover_url || '',
    views: series.totalViews ?? series.view_count ?? series.views ?? 0,
    monthlyViews: series.periodViews ?? series.monthlyViews ?? 0,
    rating: series.rating ?? series.rating_average ?? 0,
    likes: series.likesCount ?? series.bookmarkCount ?? 0,
    chapters: series.chapterCount ?? series.totalChapters ?? 0,
    trend: 'up',
    trendValue: 0,
  }
}

async function getPopularRankings() {
  try {
    const url = `${endpoint('series', 'popular')}?limit=20`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 600 }, // ISR: reconstruir cada 10 minutos
    })
    if (!res.ok) return []
    const result = await res.json()
    const series = result.data?.series || result.series || result.data || []
    return Array.isArray(series) ? series.map(mapSeriesToRanking) : []
  } catch {
    return []
  }
}

export default async function PopularesPage() {
  // Fetch ejecutado en el servidor → incluido en el HTML inicial
  const initialRankings = await getPopularRankings()

  return <PopularesClient initialRankings={initialRankings} />
}