import { endpoint, SITE_URL } from '@/config'

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

export async function fetchSeriesForSEO(slug) {
  try {
    const url = endpoint('spaces', `manhwas/${slug}`)
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    })

    if (!res.ok) return null
    const result = await res.json()
    return result.data || result || null
  } catch {
    return null
  }
}

/**
 * Obtener rating específico de un capítulo para JSON-LD
 * Retorna { rating, ratingCount } o null si no hay datos
 */
export async function fetchChapterRatingForSEO(slug, chapterNum) {
  try {
    const url = endpoint('chapters', `${slug}/${chapterNum}/rating`)
    const res = await fetch(url, {
      next: { revalidate: 600 }, // Revalidar cada 10 min (ratings cambian más frecuente)
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
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
    const url = endpoint('spaces', 'manhwas')
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
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
