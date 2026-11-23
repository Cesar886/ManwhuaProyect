import type { NextConfig } from 'next'

const isDevelopment = process.env.NODE_ENV !== 'production'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ['web-push'],
  // Reducir logs innecesarios
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Reducir warnings de HMR
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'manwhaimperial.sfo3.digitaloceanspaces.com',
      },
      {
        protocol: 'https',
        hostname: 'manhwaimperial.site',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'dashboard.olympusbiblioteca.com',
        pathname: '/storage/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Desactivar optimización de imágenes externas en desarrollo
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // No modificar webpack devtool - Next.js lo maneja automáticamente
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(!isDevelopment
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
          // Bloquear acceso desde dominios externos a recursos (CORP)
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          // Evitar ataques Spectre entre ventanas (COOP)
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // Bloquear carga de recursos Flash/PDF de dominios externos
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          // Permissions-Policy ampliado: bloquear APIs invasivas y FLoC/Topics
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'payment=(self "https://www.paypal.com")',
              'display-capture=()',
              'encrypted-media=()',
              'fullscreen=(self)',
              'screen-wake-lock=()',
            ].join(', '),
          },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
              "script-src-elem 'self' 'unsafe-inline' https://accounts.google.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline' https:",
              "img-src * data: blob:",
              "font-src 'self' data: https:",
              `connect-src 'self' https: wss:${isDevelopment ? ' http://localhost:3000 http://127.0.0.1:3000' : ''}`,
              "frame-src 'self' https://accounts.google.com https://*.google.com https://www.paypal.com https://*.paypal.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://www.paypal.com https://*.paypal.com",
              "worker-src 'self'",
              // Bloquear mixed content (HTTP dentro de HTTPS) solo en producción.
              ...(!isDevelopment ? ['upgrade-insecure-requests'] : []),
              // Reportar violaciones CSP (opcional: apunta a tu endpoint)
              // "report-uri /api/csp-report",
            ].join('; '),
          },
        ],
      },
      {
        // CRÍTICO: sw.js NUNCA debe cachearse con immutable.
        // Next.js aplica TODAS las reglas que coinciden en orden, la última gana.
        // Por eso cambiamos el patrón genérico a /_next/static/ en lugar de /(.*)\.(js|...)
        // para que sw.js (en la raíz) no sea afectado por la regla de assets.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // Los chunks de desarrollo no deben quedar cacheados mientras HMR los reemplaza.
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDevelopment ? 'no-store, must-revalidate' : 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache para assets públicos estáticos (imágenes, iconos, fuentes en /public)
        // que NO sean sw.js (ya cubierto arriba con no-cache).
        source: '/(.*)\\.(woff|woff2|ttf|eot|ico|png|jpg|jpeg|webp|avif|svg)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/populares', destination: '/biblioteca', permanent: true },
      { source: '/en/popular', destination: '/en/library', permanent: true },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/sitemap-chapters-:page.xml',
        destination: '/sitemap-chapters/:page',
      },
      {
        source: '/manhwa',
        destination: '/404',
      },
      {
        source: '/discord',
        destination: '/404',
      },
      {
        source: '/contacto',
        destination: '/404',
      },
    ]
  },
  experimental: {
    optimizePackageImports: [
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/notifications',
      '@tabler/icons-react',
      'lucide-react',
      'recharts',
      'dayjs',
    ],
  },
}

export default nextConfig
