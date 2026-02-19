import { Outfit, Playfair_Display } from 'next/font/google'
import './globals.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { MantineProvider, ColorSchemeScript } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { imperialTheme } from '@/styles/imperial-theme.js'
import { Providers } from './providers'
import { generateWebSiteJsonLd } from '@/lib/seo/jsonld'
import EzoicAds from '@/components/EzoicAds'
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
    default: 'Manhwa Imperial - Leer Manhwa en Español Online Gratis',
    template: '%s | Manhwa Imperial',
  },
  description: 'Lee los mejores manhwas en español gratis. Miles de manhwas, webtoons y comics coreanos traducidos. Actualizaciones diarias. Tu biblioteca de manhwas #1 para leer manhwa online.',
  keywords: [
    'manhwa',
    'leer manhwa',
    'manhwa en español',
    'manhwa online',
    'manhwa gratis',
    'mejores manhwas',
    'manhwa de romance',
    'manhwa de acción',
    'manhwa web',
    'webtoon español',
    'leer manhwa online',
    'biblioteca de manhwas',
    'comics coreanos',
    'manhwa traducido',
  ],
  authors: [{ name: 'Manhwa Imperial' }],
  creator: 'Manhwa Imperial',
  publisher: 'Manhwa Imperial',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: '/',
    siteName: 'Manhwa Imperial',
    title: 'Manhwa Imperial - Leer Manhwa en Español Online Gratis',
    description: 'Lee los mejores manhwas en español gratis. Miles de títulos disponibles, actualizaciones diarias. La mejor biblioteca para leer manhwa online.',
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
    title: 'Manhwa Imperial - Leer Manhwa Online Gratis',
    description: 'Lee los mejores manhwas en español gratis. Tu biblioteca de manhwas #1.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
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
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="search" type="application/opensearchdescription+xml" title="Manhwa Imperial" href="/opensearch.xml" />
        <meta name="theme-color" content="#0F0F14" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#FDFCF9" media="(prefers-color-scheme: light)" />
        {/* Preconnect to image CDN (critical for LCP) */}
        <link rel="preconnect" href="https://manwhaimperialstorage.sfo3.digitaloceanspaces.com" crossOrigin="anonymous" />
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.ezojs.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(generateWebSiteJsonLd()) }}
        />
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-M3DPPM9K');`
        }} />
        {/* End Google Tag Manager */}
      </head>
      <body className={outfit.className}>
        {/* Google Tag Manager (noscript) */}
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-M3DPPM9K"
          height="0" width="0" style={{display:'none',visibility:'hidden'}}></iframe></noscript>
        {/* End Google Tag Manager (noscript) */}
        <NavigationProgress />
        <EzoicAds />
        <MantineProvider theme={imperialTheme} defaultColorScheme="dark">
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
