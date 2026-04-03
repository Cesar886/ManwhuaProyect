import PopularesClient from './PopularesClient'
import { SERVER_API_BASE, SITE_URL } from '../../config'
import { filterAvailableSeries } from '@/utils/adultContent'
// SEO: JSON-LD para rankings (ItemList) y breadcrumbs
import { generateItemListJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'

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
 * - Incluye timeout de 10s para evitar bloqueos
 * - Normaliza campos con múltiples variantes del backend
 * - Filtra contenido adulto automáticamente
 */
async function fetchSeriesList(path) {
    try {
        const url = `${SERVER_API_BASE}${path}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
        
        const res = await fetch(url, {
            headers: defaultHeaders,
            next: { revalidate: 600 },
            signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (!res.ok) {
            console.warn(`[Populares] API error: ${path} returned ${res.status}`)
            return []
        }
        
        const result = await res.json()
        const series = result.data?.series || result.series || result.data || []
        
        if (!Array.isArray(series)) {
            console.warn(`[Populares] Invalid response format for ${path}`)
            return []
        }
        
        const safeSeries = filterAvailableSeries(series)
        
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
            isHot: s.isHot ?? s.is_hot ?? false,
            isNew: s.isNew ?? s.is_new ?? false,
            isTrending: s.isTrending ?? s.is_trending ?? false,
            updatedAt: s.updatedAt || s.updated_at || '',
        }))
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`[Populares] Request timeout: ${path}`)
        } else {
            console.error(`[Populares] Fetch error: ${path}`, error.message)
        }
        return []
    }
}

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

    // SEO: JSON-LD schemas para rankings y navegación
    const rankingJsonLd = generateItemListJsonLd('Manhwas Más Populares en Español', topRankings, 'ranking')
    const breadcrumbJsonLd = generateBreadcrumbJsonLd([
        { name: 'Inicio', url: '/home' },
        { name: 'Manhwas Populares', url: '/populares' },
    ])

    return (
        <>
            {/* SEO: Schema ItemList para rich snippets de ranking en SERPs */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(rankingJsonLd) }}
            />
            {/* SEO: Schema BreadcrumbList para migas de pan en Google */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <PopularesClient
                topRankings={topRankings}
                trending={trending}
                topRated={topRated}
                weeklyPopular={weeklyPopular}
                monthlyPopular={monthlyPopular}
                newReleases={newReleases}
                latestUpdates={latestUpdates}
            />
        </>
    )
}
