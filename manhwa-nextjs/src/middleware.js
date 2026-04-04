import { NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/perfil', '/pedidos', '/en/profile', '/en/pending']
const BOT_PATTERNS = /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider/i
const ES_PATHS = ['/manhwa', '/genero', '/tag', '/home', '/populares', '/biblioteca']
const EN_PATHS = ['/en/manhwa', '/en/genre', '/en/tag', '/en/home', '/en/populares', '/en/library']
const LANG_COOKIE = 'preferred_lang'

export function middleware(request) {
  const { pathname } = request.nextUrl
  const { headers } = request
  const userAgent = headers.get('user-agent') || ''
  const token = request.cookies.get('token')?.value

  // 1. Protección de rutas privadas
  const isProtected = PROTECTED_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtected && !token) {
    const url = request.nextUrl.clone()
    // Redirigir a home según el idioma de la ruta
    url.pathname = pathname.startsWith('/en') ? '/en' : '/'
    return NextResponse.redirect(url)
  }

  // 2. Bots: nunca redirigir, dejar pasar siempre
  if (BOT_PATTERNS.test(userAgent)) {
    return NextResponse.next()
  }

  // 3. Si ya tiene cookie de preferencia, respetar
  const langCookie = request.cookies.get(LANG_COOKIE)?.value
  if (langCookie) {
    return NextResponse.next()
  }

  // 4. Detectar idioma del navegador
  const acceptLang = headers.get('accept-language') || ''
  const prefersEnglish = acceptLang.startsWith('en') && !acceptLang.startsWith('es')
  const prefersSpanish = acceptLang.startsWith('es')

  // 5. Usuario en ruta ES pero prefiere inglés → sugerir cambio
  if (prefersEnglish && ES_PATHS.some(p => pathname.startsWith(p))) {
    const response = NextResponse.next()
    response.headers.set('x-show-lang-banner', 'en')
    return response
  }

  // 6. Usuario en ruta EN pero prefiere español → sugerir cambio
  if (prefersSpanish && EN_PATHS.some(p => pathname.startsWith(p))) {
    const response = NextResponse.next()
    response.headers.set('x-show-lang-banner', 'es')
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|favicon|images|fonts|logo|og-image|sw.js|opensearch.xml).*)'],
}
