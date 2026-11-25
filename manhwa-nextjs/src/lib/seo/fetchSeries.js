import { SERVER_API_BASE, SITE_URL } from '@/config'
import { fetchInternalJson } from './serverFetch'

const API_KEY = process.env.INTERNAL_API_KEY || process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

/** Headers comunes para todos los fetches SSR internos */
const sseHeaders = () => ({
  'Accept': 'application/json',
  'Origin': SITE_URL,
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
})

export async function fetchSeriesForSEO(slug) {
  try {
    // PostgreSQL conserva la metadata editorial, pero Spaces es la única fuente
    // de verdad para disponibilidad y cantidad de capítulos.
    const [databaseResult, spacesResult] = await Promise.all([
      fetchInternalJson(`/series/${slug}`, { revalidate: 1800, allowNotFound: true }),
      fetchInternalJson(`/spaces/manhwas/${slug}`, { revalidate: 1800, allowNotFound: true }),
    ])

    const databaseSeries = databaseResult?.data?.series || databaseResult?.data || databaseResult || null
    const spacesSeries = spacesResult?.data || spacesResult || null
    if (!databaseSeries && !spacesSeries) throw new Error('Series not found in internal API')

    const chapters = Array.isArray(spacesSeries?.chapters)
      ? spacesSeries.chapters
      : []

    const series = {
      ...(databaseSeries || {}),
      ...(spacesSeries || {}),
      chapters,
      chapterCount: chapters.length,
      latestChapters: chapters.slice(0, 5),
    }

    if (series.stats && typeof series.stats === 'object') {
      series.stats = { ...series.stats, chapterCount: chapters.length }
    }

    // Normalizar flags al nivel superior para compatibilidad
    if (series.flags && typeof series.flags === 'object') {
      for (const [key, value] of Object.entries(series.flags)) {
        if (series[key] === undefined) {
          series[key] = value
        }
      }
    }

    return series
  } catch (error) {
    const cause = error?.message || 'Unknown upstream error'
    throw new Error('Unable to fetch series "' + slug + '": ' + cause)
  }
}

/**
 * Obtener rating específico de un capítulo para JSON-LD
 * Retorna { rating, ratingCount } o null si no hay datos
 */
export async function fetchChapterRatingForSEO(slug, chapterNum) {
  try {
    const url = `${SERVER_API_BASE}/chapters/${slug}/${chapterNum}/rating`
    const res = await fetch(url, {
      next: { revalidate: 600 },
      headers: sseHeaders(),
    })

    if (!res.ok) return null
    const result = await res.json()
    if (result.success && result.data?.rating && result.data?.ratingCount > 0) {
      return {
        rating: parseFloat(result.data.rating),
        ratingCount: parseInt(result.data.ratingCount, 10),
      }
    }
    return null
  } catch {
    return null
  }
}

export async function fetchAllSeriesForSitemap() {
  try {
    const url = `${SERVER_API_BASE}/spaces/manhwas`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: sseHeaders(),
    })

    if (!res.ok) {
      throw new Error(`API responded ${res.status}`)
    }

    const result = await res.json()
    const series = result.data?.series || result.series || result.data || []
    const sitemapSeries = Array.isArray(series) ? series.filter(s => s.slug) : []
    if (sitemapSeries.length === 0) {
      throw new Error('API returned no series for sitemap')
    }
    return sitemapSeries
  } catch (error) {
    console.error('[SITEMAP] Error en fetchAllSeriesForSitemap:', error.message)
    throw error
  }
}
