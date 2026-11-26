/**
 * Mapeo de rutas español -> inglés (segmento raíz)
 * Usado por getLocalizedPath para traducir automáticamente el primer segmento de ruta.
 */
const ES_TO_EN = {
  '/home': '/home',
  '/biblioteca': '/library',
  '/populares': '/popular',
  '/acerca-de': '/about',
  '/dmca': '/dmca',
  '/terminos-de-servicio': '/terms-of-service',
  '/politica-de-privacidad': '/privacy-policy',
  '/aviso-legal': '/legal-notice',
  '/genero': '/genre',
  '/perfil': '/profile',
  '/pedidos': '/pending',
  '/mangas': '/manga',
  '/manhwa': '/manhwa',
  '/busqueda-ia': '/search-ai',
  '/muro': '/wall',

  '/buscar': '/buscar',
  '/colecciones': '/collections',
  '/mis-colecciones': '/my-collections',
  '/colecciones': '/collections',
  '/coleccion': '/collection',
}

/**
 * Mapeo bidireccional (incluye inverso EN -> ES) para getSwitchedLangPath
 */
export const ROUTE_MAP = {
  // Español -> Inglés
  '/home': '/home',
  '/biblioteca': '/library',
  '/populares': '/popular',
  '/acerca-de': '/about',
  '/dmca': '/dmca',
  '/terminos-de-servicio': '/terms-of-service',
  '/politica-de-privacidad': '/privacy-policy',
  '/aviso-legal': '/legal-notice',
  '/genero': '/genre',
  '/perfil': '/profile',
  '/pedidos': '/pending',
  '/mangas': '/manga',
  '/busqueda-ia': '/search-ai',
  '/mis-colecciones': '/my-collections',
  '/coleccion': '/collection',

  // Inglés -> Español (inverso)
  '/search-ai': '/busqueda-ia',
  '/my-collections': '/mis-colecciones',
  '/collections': '/colecciones',
  '/collection': '/coleccion',
  '/library': '/biblioteca',
  '/popular': '/populares',
  '/about': '/acerca-de',
  '/terms-of-service': '/terminos-de-servicio',
  '/privacy-policy': '/politica-de-privacidad',
  '/legal-notice': '/aviso-legal',
  '/genre': '/genero',
  '/profile': '/perfil',
  '/pending': '/pedidos',
  '/manga': '/mangas',
  '/buscar': '/buscar',
  '/wall': '/muro',
}

/**
 * Obtiene la ruta correcta según el idioma.
 * Para lang='en' traduce automáticamente el primer segmento ES→EN usando ES_TO_EN.
 * Paths que ya están en inglés (no presentes en ES_TO_EN) se pasan tal cual con prefijo /en.
 *
 * @param {string} path - Ruta base (segmento en español o inglés)
 * @param {string} lang - Idioma ('es' | 'en')
 * @returns {string} Ruta con prefijo y traducción correctos
 */
export function getLocalizedPath(path, lang = 'es') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (lang !== 'en') return cleanPath

  const userPath = /^\/u\/([^/]+)\/(colecciones|favoritos)$/.exec(cleanPath)
  if (userPath) return `/en/u/${userPath[1]}/${userPath[2] === 'colecciones' ? 'collections' : 'favorites'}`

  // Traducir solo el primer segmento
  const slashIdx = cleanPath.indexOf('/', 1)
  const rootSegment = slashIdx === -1 ? cleanPath : cleanPath.slice(0, slashIdx)
  const rest = slashIdx === -1 ? '' : cleanPath.slice(slashIdx)
  const translatedRoot = ES_TO_EN[rootSegment] ?? rootSegment

  return `/en${translatedRoot}${rest}`
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
  const esUser = /^\/u\/([^/]+)\/(colecciones|favoritos)$/.exec(basePath)
  const enUser = /^\/u\/([^/]+)\/(collections|favorites)$/.exec(basePath)
  if (currentLang === 'es' && esUser) return `/en/u/${esUser[1]}/${esUser[2] === 'colecciones' ? 'collections' : 'favorites'}`
  if (currentLang === 'en' && enUser) return `/u/${enUser[1]}/${enUser[2] === 'collections' ? 'colecciones' : 'favoritos'}`
  if (currentLang === 'es' && basePath.startsWith('/coleccion/')) return `/en/collection/${basePath.slice('/coleccion/'.length)}`
  if (currentLang === 'en' && basePath.startsWith('/collection/')) return `/coleccion/${basePath.slice('/collection/'.length)}`

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
