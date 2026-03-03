import { Outfit, Playfair_Display } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import { Notifications, notifications } from '@mantine/notifications'
import { imperialTheme } from '@/styles/imperial-theme.js'
import { Providers } from './providers'
import { generateWebSiteJsonLd, generateOrganizationJsonLd, generateHomePageJsonLd, generateWebApplicationJsonLd, generateDefinedTermSetJsonLd } from '@/lib/seo/jsonld'
import NavigationProgress from '@/components/NavigationProgress'
import MainLayout from '@/components/MainLayout'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'Arial'],
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '600', '700'],
  preload: false,
  fallback: ['Georgia', 'serif'],
})

/**
 * SEO Metadata Global
 * 
 * Keywords objetivo de alta prioridad:
 * 1. manhwa
 * 2. leer manhwa
 * 3. manhwa en español
 * 4. manhwa online
 * 5. manhwa gratis
 */
export const metadata = {
  title: {
    default: 'Leer Manhwa Online Gratis en Español - Manhwa Imperial',
    template: '%s | Manhwa Imperial',
  },
  // GEO-optimized: clara para crawlers de IA y motores de búsqueda
  description: 'Lee manhwa online gratis en español en Manhwa Imperial. Plataforma potenciada por inteligencia artificial con buscador IA que entiende lenguaje natural. Miles de manhwas y webtoons coreanos actualizados diariamente.',
  keywords: [
    'manhwa en español',
    'leer manhwa gratis',
    'webtoon español',
    'manhwa legal',
    'plataforma legal manhwa',
    'manhwa online gratis',
    'leer webtoon español',
    'manhwa',
    'leer manhwa',
    'manhwa online',
    'mejores manhwas',
    'manhwa de romance',
    'manhwa de acción',
    'comics coreanos',
    'manhwa traducido',
    'biblioteca de manhwas',
    'búsqueda manhwa con IA',
    'inteligencia artificial manhwa',
    'buscador IA manhwa',
  ],
  authors: [{ name: 'Manhwa Imperial' }],
  creator: 'Manhwa Imperial',
  publisher: 'Manhwa Imperial',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  // GEO meta tags adicionales (next.js 'other' se renderiza como <meta name="...")
  other: {
    rating: 'general',
    'mylead-verification': 'a030d8faf1f6f5c67eabe4c817e326a7',
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: '/',
    siteName: 'Manhwa Imperial',
    title: 'Manhwa Imperial - Lee Manhwas y Webtoons en Español | Legal y Gratuito',
    description: 'La plataforma líder para leer manhwas en español, potenciada por inteligencia artificial. Buscador con IA, legal, gratuita, segura y con actualizaciones diarias.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Manhwa Imperial - Leer Manhwa en Español',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manhwa Imperial - Manhwas en Español | Legal y Gratuito',
    description: 'Lee manhwas y webtoons en español gratis. Plataforma legal con cumplimiento DMCA activo.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${outfit.variable} ${playfair.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
        <link rel="icon" href="https://manhwaimperial.site/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="https://manhwaimperial.site/logo.png" />
        <link rel="search" type="application/opensearchdescription+xml" title="Manhwa Imperial" href="/opensearch.xml" />
        <meta name="theme-color" content="#0F0F14" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#FDFCF9" media="(prefers-color-scheme: light)" />
        {/* Preconnect + DNS prefetch for image CDN (chapter reader) */}
        <link rel="preconnect" href="https://manwhaimperialstorage.sfo3.digitaloceanspaces.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://manwhaimperialstorage.sfo3.digitaloceanspaces.com" />
        {/* DNS prefetch para analytics (GTM carga afterInteractive, no es crítico) */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        {/* mylead-verification: a030d8faf1f6f5c67eabe4c817e326a7 */}
        <noscript dangerouslySetInnerHTML={{ __html: '<!-- mylead-verification: a030d8faf1f6f5c67eabe4c817e326a7 -->' }} />
        {/* === GEO: señales legales para crawlers de IA — Next.js metadata API no genera estos === */}
        {/* rating: ya se inyecta vía metadata.other, este es el fallback explícito */}
        <link rel="terms-of-service" href="https://manhwaimperial.site/terminos-de-servicio" />
        <link rel="privacy-policy" href="https://manhwaimperial.site/politica-de-privacidad" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebSiteJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateHomePageJsonLd()) }}
        />
        {/* GEO: WebApplication — la IA sabe que esto es una app funcional y gratuita */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebApplicationJsonLd()) }}
        />
        {/* GEO: Glosario de términos — enseña a la IA el vocabulario del nicho */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateDefinedTermSetJsonLd()) }}
        />
      </head>
      <body className={outfit.className} suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript dangerouslySetInnerHTML={{ __html: '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-M3DPPM9K" height="0" width="0" style="display:none;visibility:hidden"></iframe>' }} />
        {/* Google Tag Manager - lazyOnload: carga en idle tras el evento load, sin competir con nada */}
        <Script
          id="gtm"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','GTM-M3DPPM9K');`
          }}
        />
        {/* Service Worker para caché de imágenes del CDN */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`
          }}
        />
        <NavigationProgress />
        <MantineProvider theme={imperialTheme} defaultColorScheme="light">
          <Notifications position="top-right" zIndex={1000} />
          <Providers>
            <MainLayout>
              {children}
            </MainLayout>
          </Providers>
        </MantineProvider>
      </body>
    </html>
  )
}
