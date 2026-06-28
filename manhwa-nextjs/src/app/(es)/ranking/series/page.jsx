import Link from 'next/link'
import { SERVER_API_BASE, SITE_URL } from '@/config'
import { filterAvailableSeriesForLang } from '@/utils/adultContent'
import {
  generateItemListJsonLd,
  generateBreadcrumbJsonLd,
  generateWebPageJsonLd,
} from '@/lib/seo/jsonld'
import styles from './RankingSeries.module.css'

export const revalidate = 3600

const API_KEY = process.env.INTERNAL_API_KEY || ''

export const metadata = {
  title: 'Los Mejores Manhwas en Español 2025 | Manhwa Imperial',
  description:
    'Descubre los mejores manhwas en español ordenados por puntuación de lectores. Top manhwas de acción, romance, fantasía e isekai actualizados diariamente.',
  keywords: [
    'mejores manhwas',
    'top manhwas en español',
    'manhwas más populares',
    'ranking manhwas',
    'mejores manhwas de acción',
    'mejores manhwas romance',
    'mejores webtoons en español',
  ],
  alternates: {
    canonical: `${SITE_URL}/ranking/series`,
    languages: {
      es: `${SITE_URL}/ranking/series`,
      'x-default': `${SITE_URL}/ranking/series`,
    },
  },
  openGraph: {
    title: 'Los Mejores Manhwas en Español 2025 | Manhwa Imperial',
    description:
      'Top manhwas ordenados por puntuación. Acción, romance, fantasía, isekai y más — todo gratis en español.',
    type: 'website',
    url: `${SITE_URL}/ranking/series`,
    siteName: 'Manhwa Imperial',
    locale: 'es_ES',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Mejores Manhwas en Español' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Los Mejores Manhwas en Español 2025',
    description: 'Top manhwas por puntuación de lectores — gratis, en español.',
    images: ['/og-image.png'],
  },
}

function getCover(s) {
  return s?.cover || s?.coverUrl || s?.cover_url || s?.coverUrlWeb || s?.cover_url_web || ''
}

function getChapters(s) {
  return s?.chapterCount ?? s?.chaptersCount ?? s?.chapters_count ?? s?.totalChapters ?? 0
}

function getScore(s) {
  const rating = parseFloat(s?.rating) || 0
  const count = parseInt(s?.ratingCount) || 0
  if (rating > 0 && count >= 3) return rating
  return 0
}

function getStatusLabel(status) {
  if (status === 'completed' || status === 'finalizado') return 'Finalizado'
  if (status === 'ongoing' || status === 'en curso') return 'En curso'
  return null
}

async function getTopSeries() {
  try {
    const res = await fetch(`${SERVER_API_BASE}/spaces/manhwas`, {
      headers: {
        Accept: 'application/json',
        Origin: SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const result = await res.json()
    const all = result.data?.series || result.series || []
    const safe = filterAvailableSeriesForLang(all, 'es')

    // Sort: rated series first (by score desc), then by chapter count
    const rated = safe
      .filter(s => getScore(s) > 0)
      .sort((a, b) => getScore(b) - getScore(a))

    const unrated = safe
      .filter(s => getScore(s) === 0)
      .sort((a, b) => getChapters(b) - getChapters(a))

    return [...rated, ...unrated].slice(0, 50)
  } catch {
    return []
  }
}

export default async function RankingSeriesPage() {
  const series = await getTopSeries()

  const itemListJsonLd = generateItemListJsonLd(
    'Los Mejores Manhwas en Español',
    series.map(s => ({ title: s.title, slug: s.slug, cover: getCover(s) })),
    'ranking'
  )
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Inicio', url: '/home' },
    { name: 'Ranking', url: '/ranking' },
    { name: 'Mejores Series', url: '/ranking/series' },
  ])
  const webPageJsonLd = generateWebPageJsonLd(
    'CollectionPage',
    'Los Mejores Manhwas en Español 2025',
    'Top manhwas ordenados por puntuación de lectores. Acción, romance, fantasía, isekai y más.',
    '/ranking/series'
  )

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />

      <main className={styles.page}>
        <div className={styles.content}>
          <h1 className={styles.title} id="ranking-title">
            Los Mejores Manhwas en Español
          </h1>
          <p className={styles.intro} id="ranking-intro">
            Ranking editorial de los manhwas mejor valorados por los lectores de Manhwa Imperial.
            Actualizado diariamente con miles de puntuaciones reales. Encuentra tu próxima lectura
            entre los títulos de acción, romance, fantasía e isekai más destacados del catálogo.
          </p>

          {series.length === 0 ? (
            <p className={styles.empty}>No hay series disponibles en este momento.</p>
          ) : (
            <ol className={styles.list}>
              {series.map((s, i) => {
                const score = getScore(s)
                const chapters = getChapters(s)
                const cover = getCover(s)
                const status = getStatusLabel(s.status)
                const rank = i + 1

                return (
                  <li key={s.slug} className={styles.item}>
                    <span className={`${styles.rank} ${rank <= 3 ? styles.rankTop : ''}`}>
                      {rank}
                    </span>

                    <Link href={`/manhwa/${s.slug}`} className={styles.card} title={s.title}>
                      <div className={styles.cover}>
                        {cover ? (
                          <img src={cover} alt={s.title} loading={rank <= 6 ? 'eager' : 'lazy'} decoding="async" />
                        ) : (
                          <div className={styles.coverFallback} />
                        )}
                      </div>

                      <div className={styles.info}>
                        <span className={styles.seriesTitle}>{s.title}</span>
                        <div className={styles.meta}>
                          {score > 0 && (
                            <span className={styles.score}>
                              ★ {(score / 2).toFixed(1)}
                            </span>
                          )}
                          {chapters > 0 && (
                            <span className={styles.chapters}>{chapters} capítulos</span>
                          )}
                          {status && (
                            <span className={`${styles.status} ${status === 'Finalizado' ? styles.completed : styles.ongoing}`}>
                              {status}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}

          <p className={styles.footnote}>
            Puntuaciones basadas en valoraciones reales de lectores. El ranking se actualiza cada hora.
            ¿Buscas un género específico?{' '}
            <Link href="/biblioteca" className={styles.link}>Explora la biblioteca completa</Link>.
          </p>
        </div>
      </main>
    </>
  )
}
