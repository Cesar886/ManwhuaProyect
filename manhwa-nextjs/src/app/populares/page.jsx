import PopularesClient from './PopularesClient'
import { SERVER_API_BASE, SITE_URL } from '../../config'
import { filterNonAdultSeries } from '@/utils/adultContent'

// ============================================================================
// SERVER COMPONENT — Fetches real ranking data from backend endpoints
//
// 7 secciones: Top Ranking, Trending, Mejor Valoradas, Semanal, Mensual,
//              Nuevos Lanzamientos, Últimas Actualizaciones
//
// ISR: revalidate=600 → reconstruye cada 10 minutos
// ============================================================================

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

const defaultHeaders = {
    'Accept': 'application/json',
    'Origin': SITE_URL,
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
}

/**
 * Fetch genérico: llama al backend, normaliza los campos y devuelve un array
 */
async function fetchSeriesList(path) {
    try {
        const url = `${SERVER_API_BASE}${path}`
        const res = await fetch(url, {
            headers: defaultHeaders,
            next: { revalidate: 600 },
        })
        if (!res.ok) return []
        const result = await res.json()
        const series = result.data?.series || result.series || result.data || []
        if (!Array.isArray(series)) return []
        const safeSeries = filterNonAdultSeries(series)
        return safeSeries.map((s, i) => ({
            id: s.id,
            rank: i + 1,
            title: s.title,
            slug: s.slug,
            cover: s.coverUrl || s.cover || s.cover_url || '',
            rating: s.rating ?? s.rating_average ?? 0,
            chapters: s.chapterCount ?? s.totalChapters ?? s.chapter_count ?? 0,
            views: s.totalViews ?? s.view_count ?? s.views ?? 0,
            status: s.status ?? 'ongoing',
            contentType: s.contentType || s.content_type || 'manhwa',
            genres: Array.isArray(s.genres) ? s.genres.slice(0, 3) : [],
            isHot: s.isHot ?? false,
            isNew: s.isNew ?? false,
            isTrending: s.isTrending ?? false,
            updatedAt: s.updatedAt || s.updated_at || '',
        }))
    } catch {
        return []
    }
}

export const dynamic = 'force-dynamic'
export const revalidate = 600

export default async function PopularesPage() {
    const [topRankings, trending, topRated, weeklyPopular, monthlyPopular, newReleases, latestUpdates] = await Promise.all([
        fetchSeriesList('/series/popular?limit=20&period=all'),
        fetchSeriesList('/series/trending?limit=20'),
        fetchSeriesList('/series?sort=rating&order=desc&limit=20'),
        fetchSeriesList('/series/popular?limit=20&period=weekly'),
        fetchSeriesList('/series/popular?limit=20&period=monthly'),
        fetchSeriesList('/series/new-releases?limit=20'),
        fetchSeriesList('/series/latest?limit=20'),
    ])

    return (
        <PopularesClient
            topRankings={topRankings}
            trending={trending}
            topRated={topRated}
            weeklyPopular={weeklyPopular}
            monthlyPopular={monthlyPopular}
            newReleases={newReleases}
            latestUpdates={latestUpdates}
        />
    )
}
