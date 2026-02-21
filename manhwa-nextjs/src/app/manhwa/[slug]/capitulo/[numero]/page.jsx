import { fetchSeriesForSEO, fetchChapterRatingForSEO } from '@/lib/seo/fetchSeries'
import { generateChapterJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { generateChapterKeywords } from '@/lib/seo/keywords'
import { META_TEMPLATES, getImageAlt } from '@/lib/seo/constants'
import ChapterReader from './ChapterReaderClient'

// ISR: reconstruye cada 24h (imágenes de capítulos son estáticas, no cambian)
// Sin esto, Next.js devuelve cache-control: private, no-cache, no-store
export const revalidate = 86400

// ============================================================================
// SSR: Pre-fetch de imágenes desde DigitalOcean Spaces
// Garantiza que crawlers sin JS (OpenAI, Perplexity) vean las imágenes
// ============================================================================
async function fetchChapterPages(slug, numero) {
  try {
    const spacesUrl = process.env.NEXT_PUBLIC_DO_SPACES_URL
    if (!spacesUrl) return []
    const paddedChapter = String(numero).padStart(4, '0')
    const imagesJsonUrl = `${spacesUrl}/${slug}/cap-${paddedChapter}/images.json`
    const res = await fetch(imagesJsonUrl, {
      next: { revalidate: 3600 }, // Las imágenes de capítulo son estáticas
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
    title: { absolute: metaData.title },
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

  // Fetch paralelo: series, rating del capítulo e imágenes (SSR)
  const [series, chapterRating, initialPages] = await Promise.all([
    fetchSeriesForSEO(slug),
    fetchChapterRatingForSEO(slug, numero),
    fetchChapterPages(slug, numero),
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
      {/*
        initialPages: imágenes pre-cargadas en el servidor para SSR.
        initialSeries: datos de la serie pre-cargados para el h1 y título.
        Los crawlers sin JS verán el contenido completo del capítulo en el HTML inicial.
      */}
      <ChapterReader initialPages={initialPages} initialSeries={series} />
    </>
  )
}
