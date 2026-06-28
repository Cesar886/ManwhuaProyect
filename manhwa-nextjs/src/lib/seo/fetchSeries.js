import { SERVER_API_BASE, SITE_URL } from '@/config'

const API_KEY = process.env.INTERNAL_API_KEY || ''

/** Headers comunes para todos los fetches SSR internos */
const sseHeaders = () => ({
  'Accept': 'application/json',
  'Origin': SITE_URL,
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
})

export async function fetchSeriesForSEO(slug) {
  // 1. Intentar con el endpoint de Spaces (tiene datos optimizados para SEO)
  try {
    const url = `${SERVER_API_BASE}/spaces/manhwas/${slug}`
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: sseHeaders(),
    })

    if (res.ok) {
      const result = await res.json()
      const series = result.data || result || null
      if (series) {
        // Normalizar flags al nivel superior (igual que en fallback)
        if (series.flags && typeof series.flags === 'object') {
          for (const [key, value] of Object.entries(series.flags)) {
            if (series[key] === undefined) {
              series[key] = value
            }
          }
        }
        return series
      }
    }
  } catch {
    // Continuar al fallback
  }

  // 2. Fallback: endpoint regular de series (funciona para todas las series)
  try {
    const url = `${SERVER_API_BASE}/series/${slug}`
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: sseHeaders(),
    })

    if (!res.ok) return null
    const result = await res.json()
    const series = result.data?.series || result.data || result || null
    if (!series) return null

    // Normalizar flags al nivel superior para compatibilidad
    if (series.flags && typeof series.flags === 'object') {
      for (const [key, value] of Object.entries(series.flags)) {
        if (series[key] === undefined) {
          series[key] = value
        }
      }
    }

    return series
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
