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
 * @deprecated Use normalizeImageUrl instead. Cache busters destroy browser/CDN caching.
 */
export function addCacheBuster(url) {
  return normalizeImageUrl(url)
}
