import { SERVER_API_BASE, SITE_URL } from '@/config'

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

/** Headers comunes para todos los fetches SSR internos */
const sseHeaders = () => ({
  'Accept': 'application/json',
  'Origin': SITE_URL,
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
})

export async function fetchSeriesForSEO(slug) {
  try {
    const url = `${SERVER_API_BASE}/spaces/manhwas/${slug}`
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: sseHeaders(),
    })

    if (!res.ok) return null
    const result = await res.json()
    return result.data || result || null
  } catch {
    return null
  }
}

/**
 * Verifica si un slug pertenece a una serie adulta consultando el endpoint de series
 * con filtro adult=only. Útil como fallback cuando el detalle no trae el flag isAdult.
 */
export async function isSlugAdultSeries(slug) {
  if (!slug) return false
  try {
    const url = `${SERVER_API_BASE}/series?adult=only&slug=${encodeURIComponent(slug)}&limit=1`
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: sseHeaders(),
    })
    if (!res.ok) return false
    const result = await res.json()
    const series = result.data?.series || result.series || []
    return Array.isArray(series) && series.length > 0
  } catch {
    return false
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
      next: { revalidate: 3600 },
      headers: sseHeaders(),
    })

    if (!res.ok) {
      console.error('[SITEMAP] Error obteniendo series:', res.status)
      return []
    }

    const result = await res.json()
    const series = result.data?.series || result.series || result.data || []
    return Array.isArray(series) ? series.filter(s => s.slug) : []
  } catch (error) {
    console.error('[SITEMAP] Error en fetchAllSeriesForSitemap:', error.message)
    return []
  }
}
