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
  if (!item) return ''

  const candidates = [
    item.coverUrl,
    item.cover_url,
    item.cover,
    item.coverUrlWeb,
    item.cover_url_web,
    item.coverUrlTmo,
    item.cover_url_tmo,
    item.coverUrlOni,
    item.cover_url_oni,
  ]

  return candidates.find((value) => {
    if (!value) return false
    const normalized = String(value).trim()
    return normalized && !['undefined', 'null', 'false', '0'].includes(normalized)
  }) || ''
}

/**
 * @deprecated Use normalizeImageUrl instead. Cache busters destroy browser/CDN caching.
 */
export function addCacheBuster(url) {
  return normalizeImageUrl(url)
}
