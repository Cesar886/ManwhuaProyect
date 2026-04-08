import { NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/perfil', '/pedidos', '/en/profile', '/en/pending']
const BOT_PATTERNS = /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider/i

// Rutas "canónicas" por idioma — se usan sólo para sugerir el banner de cambio de idioma
const ES_PATHS = ['/home', '/manhwa', '/genero', '/tag', '/populares', '/biblioteca', '/mangas']
const EN_PATHS = ['/en/home', '/en/manhwa', '/en/genre', '/en/tag', '/en/popular', '/en/library', '/en/manga']

const LANG_COOKIE = 'preferred_lang'

export function middleware(request) {
  const { pathname } = request.nextUrl
  const { headers } = request
  const userAgent = headers.get('user-agent') || ''
  const token = request.cookies.get('token')?.value

  // ─── Clonar headers y exponer el pathname al layout (server component) ──
  // Esto permite que RootLayout lea el pathname vía `headers()` y decida
  // dinámicamente `<html lang="en|es">`, hreflang, metadata, etc.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  requestHeaders.set('x-lang', pathname.startsWith('/en') ? 'en' : 'es')

  const forward = () =>
    NextResponse.next({ request: { headers: requestHeaders } })

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

  // 3. Si ya tiene cookie de preferencia, respetar
  const langCookie = request.cookies.get(LANG_COOKIE)?.value
  if (langCookie) {
    return forward()
  }

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
