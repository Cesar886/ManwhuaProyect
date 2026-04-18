import { fetchSeriesForSEO, fetchChapterRatingForSEO } from '@/lib/seo/fetchSeries'
import { generateChapterJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { generateChapterKeywords } from '@/lib/seo/keywords'
import { getImageAlt } from '@/lib/seo/constants'
import ChapterReader from '../../../../../(es)/manhwa/[slug]/capitulo/[numero]/ChapterReaderClient'
import { notFound } from 'next/navigation'
import { isAdultSeries, matchesLanguage } from '@/utils/adultContent'

export const revalidate = 86400

async function fetchChapterPages(slug, numero) {
  try {
    const spacesUrl = process.env.NEXT_PUBLIC_DO_SPACES_URL
    if (!spacesUrl) return []
    const paddedChapter = String(numero).padStart(4, '0')
    const imagesJsonUrl = `${spacesUrl}/${slug}/cap-${paddedChapter}/images.json`
    const res = await fetch(imagesJsonUrl, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const imagesList = await res.json()
    if (!Array.isArray(imagesList)) return []
    return imagesList.map((url, idx) => ({ url, number: idx + 1 }))
  } catch {
    return []
  }
}

const SITE_NAME = 'Manhwa Imperial'

export async function generateMetadata({ params }) {
  const { slug, numero } = await params

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
  const titleFormatted = title.charAt(0).toUpperCase() + title.slice(1)
  const coverUrl = series.coverUrl || series.cover || null

  const description = series.descriptionEn ?? series.description ?? `Read ${titleFormatted} Chapter ${numero} online free in English.`
  const metaTitle = `${titleFormatted} Chapter ${numero} - Read Online | ${SITE_NAME}`

  return {
    title: { absolute: metaTitle },
    description: description,
    keywords: generateChapterKeywords(series, numero, 'en'),
    alternates: {
      canonical: `https://manhwaimperial.site/en/manhwa/${slug}/chapter/${numero}`,
      languages: {
        'es': `https://manhwaimperial.site/manhwa/${slug}/capitulo/${numero}`,
        'en': `https://manhwaimperial.site/en/manhwa/${slug}/chapter/${numero}`,
        'x-default': `https://manhwaimperial.site/manhwa/${slug}/capitulo/${numero}`,
      },
    },
    openGraph: {
      title: metaTitle,
      description: description,
      type: 'article',
      url: `/en/manhwa/${slug}/chapter/${numero}`,
      siteName: SITE_NAME,
      locale: 'en_US',
      ...(coverUrl && {
        images: [{
          url: coverUrl,
          width: 460,
          height: 640,
          alt: getImageAlt.chapterPage(titleFormatted, numero, 1, 'en'),
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

export default async function EnChapterReaderPage({ params }) {
  const { slug, numero } = await params

  const [series, chapterRating, initialPages] = await Promise.all([
    fetchSeriesForSEO(slug),
    fetchChapterRatingForSEO(slug, numero),
    fetchChapterPages(slug, numero),
  ])

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
  const chapterJsonLd = generateChapterJsonLd(series, numero, null, chapterRating, 'en')
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/en/home' },
    { name: `${title} Manhwa`, url: `/en/manhwa/${slug}` },
    { name: `Chapter ${numero}` },
  ], 'en')

  return (
    <>
      {chapterJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(chapterJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ChapterReader
        slug={slug}
        numero={numero}
        initialPages={initialPages}
        lang="en"
        seriesBasePath="/en/manhwa"
      />
    </>
  )
}
