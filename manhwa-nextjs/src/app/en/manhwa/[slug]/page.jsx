import { fetchSeriesForSEO } from '@/lib/seo/fetchSeries'
import { generateComicSeriesJsonLd, generateBreadcrumbJsonLd, generateFAQJsonLd, generateSpeakableArticleJsonLd } from '@/lib/seo/jsonld'
import { generateSeriesKeywords } from '@/lib/seo/keywords'
import { getImageAlt } from '@/lib/seo/constants'
import ManhwaDetail from '../../../(es)/manhwa/[slug]/ManhwaDetailClient'
import { notFound } from 'next/navigation'
import { isAdultSeries, matchesLanguage } from '@/utils/adultContent'

export const revalidate = 3600

const SITE_NAME = 'Manhwa Imperial'

export async function generateMetadata({ params }) {
  const { slug } = await params

  const series = await fetchSeriesForSEO(slug)

  if (!series) {
    notFound()
  }

  if (isAdultSeries(series)) {
    notFound()
  }

  // Gate por idioma: /en solo debe mostrar series en inglés.
  // Series legacy sin `language` se asumen 'es', así que quedan fuera aquí.
  if (!matchesLanguage(series, 'en')) {
    notFound()
  }

  const title = series.title || slug.replace(/-/g, ' ')
  const coverUrl = series.coverUrl || series.cover || null

  // SEO-agent: priorizar meta_title/meta_description escritos por IMPERIAL-AGENT en BD.
  // Fallback a plantilla auto-generada si la BD no tiene valor.
  const dbMetaTitle = series.metaTitle || series.meta_title || null
  const dbMetaDescription = series.metaDescription || series.meta_description || null

  // English metadata
  const description = dbMetaDescription ?? series.descriptionEn ?? series.description ?? `Read ${title} manhwa online free in English. Updated daily with new chapters.`
  const metaTitle = dbMetaTitle ?? `${title} - Read Online | Manhwa Imperial`

  return {
    title: { absolute: metaTitle },
    description: description,
    keywords: generateSeriesKeywords(series, 'en'),
    alternates: {
      canonical: `https://manhwaimperial.site/en/manhwa/${slug}`,
      languages: {
        'es': `https://manhwaimperial.site/manhwa/${slug}`,
        'en': `https://manhwaimperial.site/en/manhwa/${slug}`,
        'x-default': `https://manhwaimperial.site/manhwa/${slug}`,
      },
    },
    openGraph: {
      title: metaTitle,
      description: description,
      type: 'book',
      url: `/en/manhwa/${slug}`,
      siteName: SITE_NAME,
      locale: 'en_US',
      ...(coverUrl && {
        images: [{
          url: coverUrl,
          width: 460,
          height: 640,
          alt: getImageAlt.cover(title, 'en'),
        }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: description,
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

export default async function EnManhwaDetailPage({ params }) {
  const { slug } = await params

  const series = await fetchSeriesForSEO(slug)

  if (!series) {
    notFound()
  }

  if (isAdultSeries(series)) {
    notFound()
  }

  // Gate por idioma: /en solo debe mostrar series en inglés.
  // Series legacy sin `language` se asumen 'es', así que quedan fuera aquí.
  if (!matchesLanguage(series, 'en')) {
    notFound()
  }

  // Generate JSON-LD schemas for SEO (English version)
  const comicJsonLd = generateComicSeriesJsonLd(series, 'en')
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/en/home' },
    { name: 'Manhwa Library', url: '/en/library' },
    { name: `${series?.title || slug.replace(/-/g, ' ')} Manhwa`, url: `/en/manhwa/${slug}` },
  ], 'en')
  const faqJsonLd = generateFAQJsonLd(series, 'en')
  const speakableJsonLd = generateSpeakableArticleJsonLd(series, 'en')

  return (
    <>
      {comicJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(comicJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      {speakableJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableJsonLd) }}
        />
      )}
      <ManhwaDetail initialSeries={series} lang="en" basePath="/en/manhwa" />
    </>
  )
}
