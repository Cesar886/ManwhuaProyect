import { fetchSeriesForSEO } from '@/lib/seo/fetchSeries'
import { generateComicSeriesJsonLd, generateBreadcrumbJsonLd, generateFAQJsonLd } from '@/lib/seo/jsonld'
import { generateSeriesKeywords } from '@/lib/seo/keywords'
import { META_TEMPLATES, getImageAlt } from '@/lib/seo/constants'
import ManhwaDetail from './ManhwaDetailClient'
import { notFound } from 'next/navigation'

const SITE_NAME = 'Manhwa Imperial'

/**
 * SEO Metadata para páginas de manhwa individual
 * 
 * Keywords objetivo:
 * - leer [título]
 * - [título] manhwa
 * - [título] en español
 * - manhwa de [género]
 */
export async function generateMetadata({ params }) {
  const { slug } = await params

  const series = await fetchSeriesForSEO(slug)

  if (!series) {
    notFound()
  }

  // Usar template de meta tags optimizado para SEO
  const metaData = META_TEMPLATES.manhwa(series)
  const title = series.title || slug.replace(/-/g, ' ')
  const coverUrl = series.coverUrl || series.cover || null

  return {
    title: metaData.title,
    description: metaData.description,
    keywords: generateSeriesKeywords(series),
    alternates: {
      canonical: `/manhwa/${slug}`,
    },
    openGraph: {
      title: metaData.title,
      description: metaData.description,
      type: 'book',
      url: `/manhwa/${slug}`,
      siteName: SITE_NAME,
      locale: 'es_ES',
      ...(coverUrl && {
        images: [{
          url: coverUrl,
          width: 460,
          height: 640,
          alt: getImageAlt.cover(title),
        }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: metaData.title,
      description: metaData.description,
      ...(coverUrl && { images: [coverUrl] }),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default async function ManhwaDetailPage({ params }) {
  const { slug } = await params

  const series = await fetchSeriesForSEO(slug)

  if (!series) {
    notFound()
  }

  // Generar JSON-LD schemas para SEO
  const comicJsonLd = generateComicSeriesJsonLd(series)
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Inicio', url: '/home' },
    { name: 'Biblioteca de Manhwas', url: '/biblioteca' },
    { name: `${series?.title || slug.replace(/-/g, ' ')} Manhwa`, url: `/manhwa/${slug}` },
  ])
  // FAQPage schema para preguntas frecuentes en Google
  const faqJsonLd = generateFAQJsonLd(series)

  return (
    <>
      {/* Schema.org: ComicSeries */}
      {comicJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(comicJsonLd) }}
        />
      )}
      {/* Schema.org: BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Schema.org: FAQPage - Para aparecer en Google con preguntas */}
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <ManhwaDetail initialSeries={series} />
    </>
  )
}
