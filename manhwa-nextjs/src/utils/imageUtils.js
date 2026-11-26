/**
 * Utilidades para manejo de imágenes
 */
import { API_BASE } from '../config'

/**
 * Normaliza una URL de imagen: si es relativa la convierte en absoluta usando `API_BASE`.
 * @param {string} url - URL de la imagen
 * @returns {string} - URL absoluta normalizada
 */
export function normalizeImageUrl(url) {
  if (!url) return url;

  let final = String(url);

  // Si no es una URL absoluta, intentar prefix con API_BASE
  if (!/^https?:\/\//i.test(final)) {
    const base = (API_BASE || '').replace(/\/$/, '')
    const path = final.replace(/^\/+/, '')
    final = base ? `${base}/${path}` : `/${path}`
  }

  return final
}

/**
 * Devuelve la primera portada disponible. Las APIs antiguas pueden exponer
 * cualquiera de estas variantes, por eso no se debe asumir que cover_url es
 * siempre la fuente principal.
 */
export function getCoverUrl(item) {
  return getCoverUrls(item)[0] || ''
}

/** Return every available cover source in the preferred display order. */
export function getSeriesCovers(series) {
  const item = series
  if (!item) return []

  const candidates = [
    item.cover_url,
    item.cover_url_web,
    item.cover_url_tmo,
    item.cover_url_oni,
    item.coverUrl,
    item.coverUrlWeb,
    item.coverUrlTmo,
    item.coverUrlOni,
    item.cover,
    item.image,
  ]

  return [...new Set(candidates.filter((value) => {
    if (!value) return false
    const normalized = String(value).trim()
    return normalized && !['undefined', 'null', 'false', '0'].includes(normalized)
  }).map((value) => {
    const cover = String(value).trim()
    return normalizeImageUrl(cover.startsWith('//') ? `https:${cover}` : cover)
  }).filter(Boolean))]
}

export const getCoverUrls = getSeriesCovers;

/**
 * @deprecated Use normalizeImageUrl instead. Cache busters destroy browser/CDN caching.
 */
export function addCacheBuster(url) {
  return normalizeImageUrl(url)
}
