import { fetchSeriesForSEO, fetchChapterRatingForSEO } from '@/lib/seo/fetchSeries'
import { generateChapterJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import ChapterReader from '../../../../manhwa/[slug]/capitulo/[numero]/ChapterReaderClient'
import { notFound } from 'next/navigation'
import { isAdultSeries } from '@/utils/adultContent'

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

export async function generateMetadata({ params }) {
  const { slug, numero } = await params
  const series = await fetchSeriesForSEO(slug)

  if (!series || !isAdultSeries(series)) {
    notFound()
  }

  return {
    title: `${series.title} Capítulo ${numero} | +18`,
    description: `Lee ${series.title} capítulo ${numero} en la sección para adultos (+18).`,
    alternates: {
      canonical: `/nsfw/${slug}/capitulo/${numero}`,
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        'max-image-preview': 'none',
        'max-snippet': -1,
      },
    },
  }
}

export default async function NsfwChapterReaderPage({ params }) {
  const { slug, numero } = await params

  const [series, chapterRating, initialPages] = await Promise.all([
    fetchSeriesForSEO(slug),
    fetchChapterRatingForSEO(slug, numero),
    fetchChapterPages(slug, numero),
  ])

  if (!series || !isAdultSeries(series)) {
    notFound()
  }

  const title = series?.title || slug.replace(/-/g, ' ')
  const chapterJsonLd = generateChapterJsonLd(series || { slug, title }, numero, null, chapterRating)
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Inicio', url: '/home' },
    { name: 'Contenido +18', url: '/nsfw' },
    { name: `${title} +18`, url: `/nsfw/${slug}` },
    { name: `Capítulo ${numero}` },
  ])

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
      <ChapterReader initialPages={initialPages} initialSeries={series} seriesBasePath="/nsfw" />
    </>
  )
}
