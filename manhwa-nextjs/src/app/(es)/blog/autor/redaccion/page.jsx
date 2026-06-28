import Link from 'next/link'
import { getAllPosts, CATEGORY_LABELS } from '@/lib/blog/posts'
import { SITE_URL, SITE_NAME } from '@/config'
import Header from '@/components/Header'
import styles from './AuthorPage.module.css'

export const metadata = {
  title: `Redacción Manhwa Imperial — Equipo Editorial | ${SITE_NAME}`,
  description:
    'El equipo editorial de Manhwa Imperial especializado en manhwa, webtoon coreano y cultura pop asiática. Guías, comparativas y recomendaciones en español.',
  alternates: {
    canonical: `${SITE_URL}/blog/autor/redaccion`,
  },
}

const AUTHOR_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Redacción Manhwa Imperial',
  url: `${SITE_URL}/blog/autor/redaccion`,
  description:
    'Equipo editorial de Manhwa Imperial especializado en manhwa coreano, webtoon y cultura asiática. Publican guías, comparativas y recomendaciones en español desde 2024.',
  worksFor: {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
  },
  knowsAbout: [
    'Manhwa',
    'Webtoon',
    'Cómic coreano',
    'Cultura pop asiática',
    'Plataformas de lectura digital',
    'Literatura gráfica en español',
  ],
  sameAs: [
    'https://x.com/manhwaimperial',
    'https://instagram.com/manhwaimperial',
  ],
}

export default function AuthorPage() {
  const posts = getAllPosts()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(AUTHOR_JSONLD) }}
      />
      <Header />
      <main className={styles.page}>
        <div className={styles.content}>
          {/* Author profile */}
          <header className={styles.profile}>
            <div className={styles.avatar} aria-hidden="true">RI</div>
            <div className={styles.profileInfo}>
              <h1 className={styles.name}>Redacción Manhwa Imperial</h1>
              <p className={styles.role}>Equipo Editorial · {SITE_NAME}</p>
              <p className={styles.bio}>
                Somos el equipo editorial de Manhwa Imperial, especializados en manhwa coreano,
                webtoon y cultura pop asiática. Desde 2024 publicamos guías, comparativas y
                recomendaciones para ayudar a lectores hispanohablantes a descubrir lo mejor del
                cómic coreano digital.
              </p>
              <p className={styles.bio}>
                Nuestro equipo lee y analiza cientos de títulos al año para ofrecer
                recomendaciones honestas, comparativas detalladas entre plataformas y guías de
                inicio pensadas para lectores de todos los niveles.
              </p>
              <nav className={styles.authorLinks} aria-label="Redes sociales">
                <a href="https://x.com/manhwaimperial" className={styles.socialLink} target="_blank" rel="noopener noreferrer">
                  Twitter / X
                </a>
                <a href="https://instagram.com/manhwaimperial" className={styles.socialLink} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              </nav>
            </div>
          </header>

          {/* Expertise areas */}
          <section className={styles.expertise}>
            <h2 className={styles.sectionTitle}>Áreas de especialización</h2>
            <ul className={styles.expertiseList}>
              {[
                'Manhwa de acción e isekai',
                'Romance coreano y manhwa BL/GL',
                'Comparativas de plataformas de lectura',
                'Historia y evolución del manhwa',
                'Recomendaciones por perfil de lector',
                'Adaptaciones de manhwa a K-dramas y anime',
              ].map(area => (
                <li key={area} className={styles.expertiseItem}>{area}</li>
              ))}
            </ul>
          </section>

          {/* Articles */}
          <section>
            <h2 className={styles.sectionTitle}>Artículos publicados</h2>
            <div className={styles.postGrid}>
              {posts.map(post => {
                const category = CATEGORY_LABELS[post.category] || { label: post.category, color: '#6B7280' }
                return (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className={styles.postCard}>
                    <span
                      className={styles.categoryBadge}
                      style={{ color: category.color, borderColor: category.color + '44', background: category.color + '18' }}
                    >
                      {category.label}
                    </span>
                    <h3 className={styles.postTitle}>{post.title}</h3>
                    <div className={styles.postMeta}>
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </time>
                      <span>· {post.reading_time_minutes} min</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <p className={styles.back}>
            <Link href="/blog">← Volver al Blog</Link>
          </p>
        </div>
      </main>
    </>
  )
}
