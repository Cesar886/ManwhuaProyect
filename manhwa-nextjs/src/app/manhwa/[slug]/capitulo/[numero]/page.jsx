import { fetchSeriesForSEO, fetchChapterRatingForSEO } from '@/lib/seo/fetchSeries'
import { generateChapterJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { generateChapterKeywords } from '@/lib/seo/keywords'
import { META_TEMPLATES, getImageAlt } from '@/lib/seo/constants'
import ChapterReader from './ChapterReaderClient'

const SITE_NAME = 'Manhwa Imperial'

/**
 * SEO Metadata para páginas de capítulo
 * 
 * Keywords objetivo:
 * - [título] capítulo [n]
 * - leer [título] capitulo [n]
 * - manhwa [título]
 * - leer manhwa online
 */
export async function generateMetadata({ params }) {
  const { slug, numero } = await params

  const series = await fetchSeriesForSEO(slug)

  const title = series?.title || slug.replace(/-/g, ' ')
  const titleFormatted = title.charAt(0).toUpperCase() + title.slice(1)
  const coverUrl = series?.coverUrl || series?.cover || null

  if (!series) {
    return {
      title: `Capítulo ${numero} - ${titleFormatted} | Leer Manhwa Online`,
      description: `Lee ${titleFormatted} Capítulo ${numero} manhwa en español gratis en ${SITE_NAME}. El mejor sitio para leer manhwas online.`,
      robots: { index: true, follow: true },
    }
  }

  // Usar template de meta tags optimizado
  const metaData = META_TEMPLATES.chapter(series, numero)

  return {
    title: metaData.title,
    description: metaData.description,
    keywords: generateChapterKeywords(series, numero),
    alternates: {
      canonical: `/manhwa/${slug}/capitulo/${numero}`,
    },
    openGraph: {
      title: metaData.title,
      description: metaData.description,
      type: 'article',
      url: `/manhwa/${slug}/capitulo/${numero}`,
      siteName: SITE_NAME,
      locale: 'es_ES',
      ...(coverUrl && {
        images: [{
          url: coverUrl,
          width: 460,
          height: 640,
          alt: getImageAlt.chapterPage(titleFormatted, numero, 1),
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

export default async function ChapterReaderPage({ params }) {
  const { slug, numero } = await params

  // Fetch series y rating del capítulo en paralelo
  const [series, chapterRating] = await Promise.all([
    fetchSeriesForSEO(slug),
    fetchChapterRatingForSEO(slug, numero),
  ])

  const title = series?.title || slug.replace(/-/g, ' ')
  // Pasar rating específico del capítulo (null si no hay votos → no incluye aggregateRating)
  const chapterJsonLd = generateChapterJsonLd(series || { slug, title }, numero, null, chapterRating)
  // Breadcrumbs SEO optimizados con "Manhwa" incluido
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Inicio', url: '/home' },
    { name: `${title} Manhwa`, url: `/manhwa/${slug}` },
    { name: `Capítulo ${numero}` },
  ])

  return (
    <>
      {/* Schema.org: ComicIssue */}
      {chapterJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(chapterJsonLd) }}
        />
      )}
      {/* Schema.org: BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ChapterReader />
    </>
  )
}
