import PopularesClient from './PopularesClient'
import { SERVER_API_BASE, SITE_URL } from '../../config'

// ============================================================================
// SERVER COMPONENT — Precarga el ranking de series populares para SSR
//
// Los crawlers de OpenAI, Perplexity, Bing AI y otros no ejecutan JS.
// Al hacer el fetch aquí (en el servidor), el HTML inicial incluye el
// ranking completo, garantizando que los bots indexen los datos.
//
// ISR: revalidate=300 → reconstruye cada 5 minutos
// ============================================================================

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

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
    weeklyViews: series.weeklyViews ?? 0,
    monthlyViews: series.monthlyViews ?? series.periodViews ?? 0,
    dailyViews: series.dailyViews ?? 0,
    rating: series.rating ?? series.rating_average ?? 0,
    ratingCount: series.ratingCount ?? 0,
    likes: series.likesCount ?? series.bookmarkCount ?? 0,
    chapters: series.chapterCount ?? series.totalChapters ?? 0,
    status: series.status ?? 'ongoing',
    contentType: series.contentType ?? 'manhwa',
    genres: Array.isArray(series.genres) ? series.genres : [],
    synopsis: series.synopsis ?? '',
    isHot: series.isHot ?? false,
    isNew: series.isNew ?? false,
    isTrending: series.isTrending ?? false,
    isFeatured: series.isFeatured ?? false,
  }
}

async function getPopularRankings() {
  try {
    const url = `${SERVER_API_BASE}/series/popular?limit=50&period=all`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 300 },
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