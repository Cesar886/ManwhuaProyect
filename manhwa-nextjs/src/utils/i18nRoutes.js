/**
 * Obtiene la ruta correcta según el idioma
 * @param {string} path - Ruta base (sin prefijo /en)
 * @param {string} lang - Idioma ('es' | 'en')
 * @returns {string} Ruta con prefijo correcto
 */
export function getLocalizedPath(path, lang = 'es') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return lang === 'en' ? `/en${cleanPath}` : cleanPath
}

/**
 * Mapeo de rutas español <-> inglés
 */
export const ROUTE_MAP = {
  // Español -> Inglés
  '/home': '/home',
  '/biblioteca': '/library',
  '/populares': '/populares',
  '/acerca-de': '/about',
  '/dmca': '/dmca',
  '/terminos-de-servicio': '/terms-of-service',
  '/politica-de-privacidad': '/privacy-policy',
  '/aviso-legal': '/legal-notice',
  '/genero': '/genre',
  '/perfil': '/profile',
  '/pedidos': '/pending',
  '/mangas': '/manga',
  
  // Inglés -> Español (inverso)
  '/library': '/biblioteca',
  '/about': '/acerca-de',
  '/terms-of-service': '/terminos-de-servicio',
  '/privacy-policy': '/politica-de-privacidad',
  '/legal-notice': '/aviso-legal',
  '/genre': '/genero',
  '/profile': '/perfil',
  '/pending': '/pedidos',
  '/manga': '/mangas',
}

/**
 * Obtiene la URL en el idioma opuesto
 * @param {string} currentPath - Ruta actual
 * @param {string} currentLang - Idioma actual
 * @returns {string} Ruta en el otro idioma
 */
export function getSwitchedLangPath(currentPath, currentLang = 'es') {
  // Remover prefijo /en si existe
  let basePath = currentPath.replace(/^\/en/, '')
  
  // Para manhwa y capítulos, mantener la estructura
  if (basePath.includes('/manhwa/')) {
    if (currentLang === 'es') {
      // ES -> EN: /manhwa/slug/capitulo/N -> /en/manhwa/slug/chapter/N
      basePath = basePath.replace('/capitulo/', '/chapter/')
      return `/en${basePath}`
    } else {
      // EN -> ES: /manhwa/slug/chapter/N -> /manhwa/slug/capitulo/N
      basePath = basePath.replace('/chapter/', '/capitulo/')
      return basePath
    }
  }
  
  // Para otras rutas, usar el mapeo
  for (const [es, en] of Object.entries(ROUTE_MAP)) {
    if (currentLang === 'es' && basePath === es) {
      return `/en${en}`
    }
    if (currentLang === 'en' && basePath === en) {
      return es
    }
  }
  
  // Si no hay mapeo específico, solo alternar el prefijo /en
  return currentLang === 'es' ? `/en${basePath}` : basePath
}
