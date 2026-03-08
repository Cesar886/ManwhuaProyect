import { SERVER_API_BASE, SITE_URL } from '@/config'
import { isAdultSeries } from '@/utils/adultContent'

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

// Series actualizadas en los últimos 14 días se consideran "recientes"
const RECENT_DAYS = 14

export async function fetchAllChaptersFromSpaces() {
  try {
    const url = `${SERVER_API_BASE}/spaces/manhwas`
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    })

    if (!res.ok) {
      console.error('[SITEMAP] Error obteniendo series desde Spaces:', res.status)
      return { totalChapters: 0, allChapters: [] }
    }

    const result = await res.json()
    const series = result.data?.series || result.series || []

    if (!Array.isArray(series) || series.length === 0) {
      return { totalChapters: 0, allChapters: [] }
    }

    const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000

    // Ordenar series por fecha de actualización DESC:
    // así los capítulos nuevos quedan en la página 1 del sitemap
    const sorted = [...series]
      .filter(s => s.slug && (s.chapterCount || 0) > 0 && !isAdultSeries(s))
      .sort((a, b) => {
        const aTime = new Date(a.lastUpdated || a.updatedAt || a.updated_at || 0).getTime()
        const bTime = new Date(b.lastUpdated || b.updatedAt || b.updated_at || 0).getTime()
        return bTime - aTime
      })

    const allChapters = []

    for (const serie of sorted) {
      const count = serie.chapterCount
      const lastMod = serie.lastUpdated || serie.updatedAt || serie.updated_at || null
      const isRecentSeries = new Date(lastMod || 0).getTime() >= recentCutoff

      // Capítulos en orden DESC dentro de cada serie (el más nuevo primero)
      for (let n = count; n >= 1; n--) {
        allChapters.push({
          seriesSlug: serie.slug,
          chapterNumber: n,
          lastModified: lastMod,
          // El último capítulo de una serie actualizada recientemente es "nuevo"
          isLatest: isRecentSeries && n === count,
          // Todos los capítulos de una serie activa reciben prioridad intermedia
          isRecent: isRecentSeries,
        })
      }
    }

    console.log(`[SITEMAP] ${sorted.length} series → ${allChapters.length} capítulos`)
    return { totalChapters: allChapters.length, allChapters }
  } catch (error) {
    console.error('[SITEMAP] Error en fetchAllChaptersFromSpaces:', error.message)
    return { totalChapters: 0, allChapters: [] }
  }
}
