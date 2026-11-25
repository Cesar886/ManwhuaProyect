import { GENRE_SEO, META_TEMPLATES, SEO_CONTENT, getAnchorText } from '@/lib/seo/constants'
import { generateCollectionPageJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { filterAvailableSeriesForLang } from '@/utils/adultContent'
import Link from 'next/link'
import { extractSeries, fetchInternalJson } from '@/lib/seo/serverFetch'
import ManhwaCover from '@/components/ManhwaCover'

export const dynamic = 'force-dynamic'
import styles from './GenrePage.module.css'

const SITE_NAME = 'Manhwa Imperial'

export const revalidate = 3600

function normText(str) {
  return String(str || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/-/g, ' ').trim()
}

function getChapters(s) {
  return s?.chapterCount ?? s?.chaptersCount ?? s?.chapters_count ?? s?.totalChapters ?? 0
}

async function getSeriesByGenre(genreSlug) {
  const result = await fetchInternalJson('/spaces/manhwas', { revalidate: 3600, requireNonEmpty: true })
    const all = extractSeries(result)
    const safe = filterAvailableSeriesForLang(all, 'es')
    const target = normText(genreSlug)
    return safe
      .filter(s => {
        const genres = Array.isArray(s.genres) ? s.genres : []
        return genres.some(g => {
          const name = normText(typeof g === 'string' ? g : g?.name)
          return name === target || name.includes(target)
        })
      })
      .slice(0, 20)
}

// Las páginas de género se generan bajo demanda para que el build no dependa
// de que PostgreSQL/API estén disponibles en la máquina que compila Next.js.
export const dynamicParams = true

/**
 * SEO Metadata para páginas de género
 * 
 * Keywords objetivo:
 * - manhwa de [género]
 * - manhwa [género] español
 * - mejores manhwas de [género]
 */
export async function generateMetadata({ params }) {
  const { genre } = await params
  
  // Convertir slug a nombre legible
  const genreName = genre
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
  
  // Obtener datos SEO del género
  const metaData = META_TEMPLATES.genre(genreName)
  
  return {
    title: metaData.title,
    description: metaData.description,
    alternates: {
      canonical: `https://manhwaimperial.site/genero/${genre}`,
      languages: {
        'es': `https://manhwaimperial.site/genero/${genre}`,
        'en': `https://manhwaimperial.site/en/genre/${genre}`,
        'x-default': `https://manhwaimperial.site/genero/${genre}`,
      },
    },
    openGraph: {
      title: metaData.title,
      description: metaData.description,
      type: 'website',
      url: `/genero/${genre}`,
      siteName: SITE_NAME,
      locale: 'es_ES',
      // SEO: og:image obligatoria para CTR en redes sociales
      images: [{
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `Manhwa de ${genreName} en Español - ${SITE_NAME}`,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Manhwa de ${genreName} | ${SITE_NAME}`,
      description: metaData.description,
      // SEO: Twitter image obligatoria
      images: ['/og-image.png'],
    },
  }
}

/**
 * Página de Género - Lista de manhwas por género
 * Contenido SEO optimizado para "manhwa de [género]"
 */
export default async function GenrePage({ params }) {
  const { genre } = await params

  const genreName = genre
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

  const genreData = GENRE_SEO[genre.replace(/-/g, ' ').toLowerCase()] || {}
  const series = await getSeriesByGenre(genre)

  const collectionJsonLd = generateCollectionPageJsonLd(genreName, series, series.length)
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Inicio', url: '/home' },
    { name: 'Biblioteca de Manhwas', url: '/biblioteca' },
    { name: `Manhwa de ${genreName}`, url: `/genero/${genre}` },
  ])

  return (
    <>
      {/* Schema.org: CollectionPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      {/* Schema.org: BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      
      <main className={styles.pageWrapper}>
        <div className={styles.content}>
          {/* SEO H1: Manhwa de [Género] en Español */}
          <h1 className={styles.pageTitle}>
            {SEO_CONTENT.genre.getH1(genreName)}
          </h1>
          
          {/* SEO: Párrafo introductorio con keywords */}
          <p className={styles.introText}>
            {SEO_CONTENT.genre.getDescription(genreName, genreData.description)}
          </p>
          
          {/* SEO: Sección ¿Qué es un Manhwa de [Género]? */}
          <section className={styles.infoSection}>
            <h2 className={styles.sectionTitle}>
              {SEO_CONTENT.genre.getWhatIs(genreName)}
            </h2>
            <p className={styles.infoText}>
              {SEO_CONTENT.genre.getWhatIsText(genreName, genreData.description)}
            </p>
          </section>
          
          {/* Sección: Todos los Manhwas de [Género] */}
          <section className={styles.manhwaSection}>
            <h2 className={styles.sectionTitle}>
              {SEO_CONTENT.genre.getAllGenre(genreName)}
            </h2>
            
            <div className={styles.manhwaGrid}>
              {series.length > 0 ? series.map(s => (
                <Link
                  key={s.slug}
                  href={`/manhwa/${s.slug}`}
                  className={styles.seriesCard}
                  title={s.title}
                >
                  <div className={styles.coverWrapper}>
                    <ManhwaCover src={s} slug={s.slug} alt={s.title} className={styles.coverImage} />
                  </div>
                  <span className={styles.seriesTitle}>{s.title}</span>
                  {getChapters(s) > 0 && (
                    <span className={styles.chapterCount}>{getChapters(s)} caps</span>
                  )}
                </Link>
              )) : (
                <div className={styles.emptyState}>
                  <p>
                    Próximamente manhwas de {genreName}.{' '}
                    <Link href="/biblioteca" className={styles.link}>
                      Ver biblioteca completa
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </section>
          
          {/* Enlaces a otros géneros */}
          <section className={styles.relatedSection}>
            <h2 className={styles.sectionTitle}>Explora Otros Géneros de Manhwa</h2>
            <div className={styles.genreGrid}>
              {Object.entries(GENRE_SEO).slice(0, 10).map(([key, data]) => {
                const genreSlug = key.replace(/\s+/g, '-')
                if (genreSlug === genre) return null
                return (
                  <Link
                    key={key}
                    href={`/genero/${genreSlug}`}
                    className={styles.genreLink}
                    title={getAnchorText.genre(data.title.replace('Manhwa de ', ''))}
                  >
                    {data.title}
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
