import { fetchSeriesForSEO } from '@/lib/seo/fetchSeries'
import { generateComicSeriesJsonLd, generateBreadcrumbJsonLd, generateFAQJsonLd, generateSpeakableArticleJsonLd } from '@/lib/seo/jsonld'
import { generateSeriesKeywords } from '@/lib/seo/keywords'
import { META_TEMPLATES, getImageAlt } from '@/lib/seo/constants'
import ManhwaDetail from './ManhwaDetailClient'
import { notFound } from 'next/navigation'
import { isAdultSeries, matchesLanguage } from '@/utils/adultContent'
import Link from 'next/link'
import ssrStyles from './ManhwaSSR.module.css'

export const revalidate = 3600

function getGenreNames(series) {
  const genres = Array.isArray(series?.genres) ? series.genres : []
  return genres.map(g => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean).slice(0, 5)
}

function getChaptersPreview(series) {
  const chapters = Array.isArray(series?.chapters) ? series.chapters : []
  return chapters.slice().sort((a, b) => Number(a.number) - Number(b.number)).slice(0, 10)
}

function getStatusLabel(status) {
  if (status === 'completed' || status === 'finalizado') return 'finalizado'
  if (status === 'ongoing' || status === 'en curso') return 'en emisión activa'
  return 'disponible en la plataforma'
}

function buildWhyReasons(series) {
  const genres = getGenreNames(series)
  const chapterCount = series?.chapterCount ?? series?.chaptersCount ?? 0
  const status = getStatusLabel(series?.status)
  const reasons = []

  if (genres.length > 0) {
    reasons.push(`Género${genres.length > 1 ? 's' : ''}: ${genres.join(', ')} — ideal si disfrutas este tipo de historias.`)
  }
  if (chapterCount >= 50) {
    reasons.push(`Más de ${chapterCount} capítulos disponibles — horas de contenido para leer sin parar.`)
  } else if (chapterCount > 0) {
    reasons.push(`${chapterCount} capítulo${chapterCount !== 1 ? 's' : ''} disponible${chapterCount !== 1 ? 's' : ''} para leer ahora mismo.`)
  }
  reasons.push(`Historia ${status} y traducida al español.`)
  reasons.push('Lectura gratuita sin registro — solo abre el capítulo y empieza.')
  return reasons
}

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

  if (isAdultSeries(series)) {
    notFound()
  }

  // Gate por idioma: la ruta (es) solo debe mostrar series en español.
  // Series sin `language` se tratan como 'es' (legacy), así que pasan.
  if (!matchesLanguage(series, 'es')) {
    notFound()
  }

  // Usar template de meta tags optimizado para SEO
  const metaData = META_TEMPLATES.manhwa(series)
  const title = series.title || slug.replace(/-/g, ' ')
  const coverUrl = series.coverUrl || series.cover || null

  return {
    title: { absolute: metaData.title },
    description: metaData.description,
    keywords: generateSeriesKeywords(series),
    alternates: {
      canonical: `https://manhwaimperial.site/manhwa/${slug}`,
      languages: {
        'es': `https://manhwaimperial.site/manhwa/${slug}`,
        'en': `https://manhwaimperial.site/en/manhwa/${slug}`,
        'x-default': `https://manhwaimperial.site/manhwa/${slug}`,
      },
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

  if (isAdultSeries(series)) {
    notFound()
  }

  // Gate por idioma: la ruta (es) solo debe mostrar series en español.
  // Series sin `language` se tratan como 'es' (legacy), así que pasan.
  if (!matchesLanguage(series, 'es')) {
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
  // Speakable Article schema para búsqueda por voz (Gemini, Google Assistant, Perplexity)
  const speakableJsonLd = generateSpeakableArticleJsonLd(series)

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
      {/* Schema.org: Speakable Article - Para SEO conversacional y búsqueda por voz */}
      {speakableJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableJsonLd) }}
        />
      )}
      <ManhwaDetail initialSeries={series} />

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* SSR editorial sections — visible to AI crawlers & text parsers  */}
      {/* Positioned after the interactive client component               */}
      {/* ──────────────────────────────────────────────────────────────── */}

      {/* Por qué leer este manhwa */}
      <section className={ssrStyles.ssrSection} id="por-que-leer" aria-label={`Por qué leer ${series?.title}`}>
        <h2 className={ssrStyles.sectionTitle}>¿Por qué leer {series?.title}?</h2>
        <ul className={ssrStyles.whyList}>
          {buildWhyReasons(series).map((reason, i) => (
            <li key={i} className={ssrStyles.whyItem}>{reason}</li>
          ))}
        </ul>
        {getGenreNames(series).length > 0 && (
          <nav className={ssrStyles.genreTags} aria-label="Géneros">
            {getGenreNames(series).map(g => (
              <Link
                key={g}
                href={`/genero/${g.toLowerCase().replace(/\s+/g, '-')}`}
                className={ssrStyles.genreTag}
              >
                {g}
              </Link>
            ))}
          </nav>
        )}
      </section>

      {/* Primeros capítulos — ayuda a los crawlers a descubrir URLs de capítulos */}
      {getChaptersPreview(series).length > 0 && (
        <section className={ssrStyles.ssrSection} aria-label="Capítulos disponibles">
          <h2 className={ssrStyles.sectionTitle}>Primeros capítulos de {series?.title}</h2>
          <ol className={ssrStyles.chapterList}>
            {getChaptersPreview(series).map(ch => (
              <li key={ch.number}>
                <Link
                  href={`/manhwa/${slug}/capitulo/${ch.number}`}
                  className={ssrStyles.chapterLink}
                >
                  {ch.title ? `Cap. ${ch.number}: ${ch.title}` : `Capítulo ${ch.number}`}
                </Link>
              </li>
            ))}
          </ol>
          {(series?.chapterCount ?? 0) > 10 && (
            <Link href={`/manhwa/${slug}`} className={ssrStyles.viewAllLink}>
              Ver todos los capítulos →
            </Link>
          )}
        </section>
      )}
    </>
  )
}
