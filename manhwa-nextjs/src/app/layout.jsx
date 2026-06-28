import { Outfit, Playfair_Display } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.layer.css'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { imperialTheme } from '@/styles/imperial-theme.js'
import { Providers } from './providers'
import { generateWebSiteJsonLd, generateOrganizationJsonLd, generateWebApplicationJsonLd, generateDefinedTermSetJsonLd } from '@/lib/seo/jsonld'
import NavigationProgress from '@/components/NavigationProgress'
import MainLayout from '@/components/MainLayout'
import HtmlLangSync from '@/components/HtmlLangSync'

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
  preload: true,
  fallback: ['Georgia', 'serif'],
})

/**
 * SEO Metadata Global
 *
 * La metadata raíz cubre el idioma ES (raíz del sitio). Cuando el usuario
 * navega a /en/*, el layout anidado `/en/layout.jsx` sobreescribe title,
 * description, openGraph, twitter y alternates con la versión en inglés.
 * Sólo lo común (authors, metadataBase, robots, verification, etc.) vive aquí.
 */
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FDFCF9' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F14' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Manhwa Imperial',
  },
  title: {
    default: 'Leer Manhwa Online Gratis en Español - Manhwa Imperial',
    template: '%s | Manhwa Imperial',
  },
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
    languages: {
      'x-default': '/',
      'es': '/',
      'es-419': '/',
      'en': '/en',
      'en-US': '/en',
    },
  },
  other: {
    rating: 'general',
    'mylead-verification': 'a030d8faf1f6f5c67eabe4c817e326a7',
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: '/',
    siteName: 'Manhwa Imperial · By AI Imperial',
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
  // Verification: se lee desde env var para poder rotar sin re-deploy y no exponer secretos en el repo.
  // Configurar NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION en el entorno de prod.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
      verification: {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        ...(process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION && { yandex: process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION }),
        ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION && { other: { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }),
      },
    }
    : {}),
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${playfair.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head suppressHydrationWarning>
        {/* Sincronizar <html lang> de forma síncrona antes de cualquier render.
            Evita el flash de idioma incorrecto en páginas /en/* y el CLS
            que ocurriría si solo usáramos HtmlLangSync (asíncrono).
            HtmlLangSync sigue siendo necesario para navegación SPA posterior. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=location.pathname.startsWith('/en')?'en':'es';document.documentElement.lang=l;})()`
          }}
        />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="search" type="application/opensearchdescription+xml" title="Manhwa Imperial" href="/opensearch.xml" />
        {/* Mantine y cambios manuales: Actualizar dinámicamente el theme-color al cambiar de tema para la barra del navegador (PWA) */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){
              function updateThemeColor() {
                var isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';
                if (!isDark && !document.documentElement.hasAttribute('data-mantine-color-scheme')) {
                  isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                }
                var color = isDark ? '#0F0F14' : '#FDFCF9';
                var metaList = document.querySelectorAll('meta[name="theme-color"]');
                if (metaList.length === 0) {
                  var meta = document.createElement('meta');
                  meta.name = 'theme-color';
                  meta.content = color;
                  document.head.appendChild(meta);
                } else {
                  metaList.forEach(function(m) { 
                    // Limpiamos la query media del viewport y seteamos el nuevo color fijo
                    m.removeAttribute('media');
                    m.content = color; 
                  });
                }
              }
              var observer = new MutationObserver(function() { updateThemeColor(); });
              if(document.documentElement) {
                observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mantine-color-scheme', 'class'] });
              }
              window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeColor);
            })();`
          }}
        />
        <meta name="impact-site-verification" content="a62d51e4-8267-4442-bba4-45de72b6c992" />
        <meta name="referrer" content="no-referrer-when-downgrade" />
{/* hreflang: se inyecta automáticamente vía metadata.alternates.languages */}
        {/* Preconnect + DNS prefetch for image CDN (chapter reader) */}
        <link rel="preconnect" href="https://manwhaimperialstorage.sfo3.digitaloceanspaces.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://manwhaimperialstorage.sfo3.digitaloceanspaces.com" />
        {/* DNS prefetch para analytics (GTM carga afterInteractive, no es crítico) */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        {/* mylead-verification ya se inyecta vía metadata.other */}
        {/* === GEO: señales legales para crawlers de IA — Next.js metadata API no genera estos === */}
        {/* rating: ya se inyecta vía metadata.other, este es el fallback explícito */}
        <link rel="terms-of-service" href="https://manhwaimperial.site/terminos-de-servicio" />
        <link rel="privacy-policy" href="https://manhwaimperial.site/politica-de-privacidad" />
        <script
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebSiteJsonLd()) }}
        />
        <script
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationJsonLd()) }}
        />
        {/* GEO: WebApplication — la IA sabe que esto es una app funcional y gratuita */}
        <script
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebApplicationJsonLd()) }}
        />
        {/* GEO: Glosario de términos — enseña a la IA el vocabulario del nicho */}
        <script
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateDefinedTermSetJsonLd()) }}
        />
        {/* Breadcrumb raíz: Google muestra este name en vez de la URL */}
        <script
          suppressHydrationWarning
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [{
                "@type": "ListItem",
                "position": 1,
                "name": "Manhwa, Manga & Webtoons",
                "item": "https://manhwaimperial.site"
              }]
            })
          }}
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
        <HtmlLangSync />
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
