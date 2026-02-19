import { NextResponse } from 'next/server'

const PROTECTED_ROUTES = ['/perfil', '/pedidos']

export function middleware(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  const isProtected = PROTECTED_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  if (isProtected && !token) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/perfil/:path*', '/pedidos/:path*'],
}
