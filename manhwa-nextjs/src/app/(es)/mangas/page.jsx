import { SERVER_API_BASE, SITE_URL } from '@/config'
import { filterAvailableSeries } from '@/utils/adultContent'
import MangasClient from './MangasClient'
// SEO: JSON-LD para breadcrumbs y WebPage
import { generateBreadcrumbJsonLd, generateWebPageJsonLd } from '@/lib/seo/jsonld'

export const metadata = {
  title: 'Manga en Español - Leer Online Gratis | Manhwa Imperial',
  description: 'Lee manga en español gratis. Explora nuestra colección completa de mangas japoneses traducidos al español, actualizados diariamente. ¡Miles de títulos disponibles!',
  keywords: [
    'manga en español',
    'leer manga online',
    'manga gratis',
    'manga español',
    'manga traducido',
    'manga online gratis',
    'mejores mangas',
    'manga japonés español',
    'leer manga gratis',
    'catálogo manga',
  ],
  alternates: {
    canonical: `${SITE_URL}/mangas`,
    languages: {
      es: '/mangas',
      en: '/en/manga',
    },
  },
  openGraph: {
    title: 'Manga en Español - Leer Online Gratis | Manhwa Imperial',
    description: 'Lee manga en español gratis. Explora nuestra colección completa de mangas japoneses traducidos al español, actualizados diariamente.',
    type: 'website',
    url: '/mangas',
    siteName: 'Manhwa Imperial',
    locale: 'es_ES',
    // SEO: og:image obligatoria
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Manga en Español - Leer Online Gratis | Manhwa Imperial',
    }],
  },
  // SEO: Twitter Card faltante — necesaria para compartir en Twitter/X
  twitter: {
    card: 'summary_large_image',
    title: 'Manga en Español - Leer Online Gratis | Manhwa Imperial',
    description: 'Lee manga en español gratis. Explora nuestra colección completa de mangas japoneses traducidos al español.',
    images: ['/og-image.png'],
  },
}

export const revalidate = 300

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

function isMangaSeries(series) {
  const rawType =
    series?.type ||
    series?.seriesType ||
    series?.series_type ||
    series?.contentType ||
    series?.content_type ||
    series?.format ||
    series?.mediaType ||
    series?.media_type ||
    series?.origin

  if (!rawType || typeof rawType !== 'string') return false
  return rawType.trim().toLowerCase().includes('manga')
}

async function getInitialSeries() {
  try {
    const res = await fetch(`${SERVER_API_BASE}/spaces/manhwas`, {
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const result = await res.json()
    const allSeries = result.data?.series || result.series || []
    return allSeries.filter(isMangaSeries)
  } catch {
    return []
  }
}

export default async function MangasPage() {
  const initialSeries = filterAvailableSeries(await getInitialSeries())

  // SEO: JSON-LD schemas para crawlers
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Inicio', url: '/home' },
    { name: 'Manga en Español', url: '/mangas' },
  ])
  const webPageJsonLd = generateWebPageJsonLd(
    'CollectionPage',
    'Manga en Español - Catálogo Completo de Mangas Japoneses',
    'Lee manga en español gratis. Colección completa de mangas japoneses traducidos, actualizados diariamente.',
    '/mangas'
  )

  return (
    <>
      {/* SEO: Schema BreadcrumbList para migas de pan en SERPs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* SEO: Schema CollectionPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <MangasClient initialSeries={initialSeries} />
    </>
  )
}
