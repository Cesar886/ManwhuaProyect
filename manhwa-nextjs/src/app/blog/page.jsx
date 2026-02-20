import Link from 'next/link'
import { getAllPosts, CATEGORY_LABELS } from '@/lib/blog/posts'
import styles from './Blog.module.css'

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <main className={styles.pageWrapper}>
      <div className={styles.content}>
        {/* SEO Header */}
        <header className={styles.hero}>
          <h1 className={styles.heroTitle}>Blog de Manhwa en Español</h1>
          <p className={styles.heroSubtitle}>
            Guías, comparativas y recomendaciones para disfrutar del mejor manhwa online.
          </p>
        </header>

        {/* Posts Grid */}
        <section>
          <div className={styles.postsGrid}>
            {posts.map((post) => {
              const category = CATEGORY_LABELS[post.category] || { label: post.category, color: '#6B7280' }
              return (
                <article key={post.slug} className={styles.postCard}>
                  <Link href={`/blog/${post.slug}`} className={styles.postLink}>
                    {/* Category Badge */}
                    <span
                      className={styles.categoryBadge}
                      style={{ backgroundColor: category.color + '22', color: category.color, borderColor: category.color + '44' }}
                    >
                      {category.label}
                    </span>

                    {/* Title */}
                    <h2 className={styles.postTitle}>{post.title}</h2>

                    {/* Meta */}
                    <p className={styles.postExcerpt}>{post.meta_description}</p>

                    <div className={styles.postMeta}>
                      <time dateTime={post.publishedAt} className={styles.postDate}>
                        {new Date(post.publishedAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      <span className={styles.readingTime}>{post.reading_time_minutes} min de lectura</span>
                    </div>

                    <span className={styles.readMore}>Leer artículo →</span>
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        {/* SEO Footer Text */}
        <section className={styles.seoSection}>
          <h2 className={styles.seoTitle}>Todo sobre Manhwa en Español</h2>
          <p className={styles.seoText}>
            En el blog de Manhwa Imperial encontrarás guías completas para nuevos lectores,
            comparativas de las mejores plataformas para leer manhwa en español, y
            recomendaciones personalizadas por género. Tanto si eres fan del romance coreano
            como de la acción o la fantasía, tenemos artículos pensados para ti.
          </p>
          <div className={styles.seoLinks}>
            <Link href="/biblioteca" className={styles.seoLink}>Explorar biblioteca de manhwas</Link>
            <Link href="/populares" className={styles.seoLink}>Manhwas más populares</Link>
            <Link href="/home" className={styles.seoLink}>Últimas actualizaciones</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
