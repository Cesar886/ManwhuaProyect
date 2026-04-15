import { NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/perfil', '/pedidos']
const BOT_PATTERNS = /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider/i

// Rutas "canónicas" por idioma — se usan para sugerir el banner de cambio de idioma
// IMPORTANTE: solo listar rutas que TIENEN equivalente real en el otro idioma.
// Si aparece aquí una ruta sin equivalente (ej. /genero, /tag), el banner de
// idioma llevaría al usuario a un 404.
const ES_PATHS = ['/home', '/manhwa', '/populares', '/biblioteca', '/mangas']
const EN_PATHS = ['/en/home', '/en/manhwa', '/en/popular', '/en/library', '/en/manga']

const LANG_COOKIE = 'preferred_lang'

// Segmentos ES que tienen página EN equivalente (para redirect por cookie)
// IMPORTANTE: solo incluir segmentos donde la ruta /en/<en-segment> existe
// realmente en src/app/en/. No agregar aquí 'genero' ni 'colecciones' porque
// /en/genre y /en/collections NO existen aún → causarían 404 en redirect.
const ES_TO_EN_SEGMENT = {
  '': 'home',        // / → /en/home
  'home': 'home',
  'biblioteca': 'library',
  'populares': 'popular',
  'manhwa': 'manhwa',
  'acerca-de': 'about',
  'dmca': 'dmca',
  'terminos-de-servicio': 'terms-of-service',
  'politica-de-privacidad': 'privacy-policy',
  'aviso-legal': 'legal-notice',
  'mangas': 'manga',
}

// Segmentos EN que tienen equivalente ES (para redirect ES-cookie → ES)
const EN_SEGMENT_TO_ES = {
  'home': 'home',
  'library': 'biblioteca',
  'popular': 'populares',
  'manhwa': 'manhwa',
  'about': 'acerca-de',
  'dmca': 'dmca',
  'terms-of-service': 'terminos-de-servicio',
  'privacy-policy': 'politica-de-privacidad',
  'legal-notice': 'aviso-legal',
  'manga': 'mangas',
}

function getEnEquivalent(pathname) {
  // /manhwa/slug/capitulo/N → /en/manhwa/slug/chapter/N
  if (pathname.startsWith('/manhwa/') && pathname.includes('/capitulo/')) {
    return '/en' + pathname.replace('/capitulo/', '/chapter/')
  }
  const firstSegment = pathname.split('/')[1] || ''
  const enSegment = ES_TO_EN_SEGMENT[firstSegment]
  if (enSegment === undefined) return null  // no EN equivalent
  const rest = pathname.slice(firstSegment.length + 1)  // includes leading /
  return `/en/${enSegment}${rest}`
}

function getEsEquivalent(pathname) {
  // /en/manhwa/slug/chapter/N → /manhwa/slug/capitulo/N
  const withoutEn = pathname.slice(3)  // remove /en
  if (withoutEn.startsWith('/manhwa/') && withoutEn.includes('/chapter/')) {
    return withoutEn.replace('/chapter/', '/capitulo/')
  }
  const firstEnSegment = withoutEn.split('/')[1] || ''
  const esSegment = EN_SEGMENT_TO_ES[firstEnSegment]
  if (esSegment === undefined) return null
  const rest = withoutEn.slice(firstEnSegment.length + 1)
  return `/${esSegment}${rest}`
}

export function middleware(request) {
  const { pathname } = request.nextUrl
  const { headers } = request
  const userAgent = headers.get('user-agent') || ''
  const token = request.cookies.get('token')?.value

  const forward = () => NextResponse.next()

  // 1. Protección de rutas privadas
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtected && !token) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.startsWith('/en') ? '/en' : '/'
    return NextResponse.redirect(url)
  }

  // 2. Bots: nunca redirigir, dejar pasar con headers
  if (BOT_PATTERNS.test(userAgent)) {
    return forward()
  }

  // 3. Cookie de preferencia: redirigir al idioma guardado si está en el otro
  const langCookie = request.cookies.get(LANG_COOKIE)?.value
  if (langCookie === 'en' && !pathname.startsWith('/en')) {
    const target = getEnEquivalent(pathname)
    if (target) {
      const url = request.nextUrl.clone()
      url.pathname = target
      return NextResponse.redirect(url)
    }
    return forward()
  }
  if (langCookie === 'es' && pathname.startsWith('/en')) {
    const target = getEsEquivalent(pathname)
    if (target) {
      const url = request.nextUrl.clone()
      url.pathname = target
      return NextResponse.redirect(url)
    }
    return forward()
  }
  if (langCookie) return forward()

  // 4. Detectar idioma del navegador
  const acceptLang = headers.get('accept-language') || ''
  const prefersEnglish = acceptLang.startsWith('en')
  const prefersSpanish = acceptLang.startsWith('es')

  // 5. Sugerir cambio de idioma (sólo un header; el cliente decide si mostrar banner)
  const response = forward()

  if (prefersEnglish && ES_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    response.headers.set('x-suggest-lang', 'en')
  } else if (prefersSpanish && EN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    response.headers.set('x-suggest-lang', 'es')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next|api|favicon|images|fonts|logo|og-image|sw.js|opensearch.xml).*)'],
}
