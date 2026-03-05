import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
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
        hostname: 'manwhaimperialstorage.sfo3.digitaloceanspaces.com',
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
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://accounts.google.com https://apis.google.com https://static.cloudflareinsights.com https://challenges.cloudflare.com https://www.paypal.com https://www.paypalobjects.com",
              "style-src 'self' 'unsafe-inline' https://www.paypalobjects.com",
              "img-src * data: blob:",
              "font-src 'self' data: https://www.paypalobjects.com",
              "connect-src 'self' http://localhost:3000 http://localhost:3001 https://manwhaimperialstorage.sfo3.digitaloceanspaces.com https://www.googletagmanager.com https://accounts.google.com https://apis.google.com https://www.google-analytics.com https://manhwaimperial.site https://ai.manhwaimperial.site https://cloudflareinsights.com https://www.paypal.com https://api-m.paypal.com https://*.paypal.com",
              "frame-src 'self' https://accounts.google.com https://challenges.cloudflare.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://www.paypal.com https://*.paypal.com",
              "worker-src 'self'",
              // Bloquear mixed content (HTTP dentro de HTTPS)
              'upgrade-insecure-requests',
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
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // Cache agresivo SOLO para los chunks internos de Next.js (/_next/static/).
        // NUNCA usa /(.*)\.(js|...) porque eso también matchea /sw.js y lo sobreescribe.
        // Todos los JS/CSS/fonts compilados por Next.js van a /_next/static/ automáticamente.
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
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
    webpackBuildWorker: true,
  },
}

export default nextConfig
