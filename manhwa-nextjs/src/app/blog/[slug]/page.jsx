import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getAllSlugs, getRecentPosts, CATEGORY_LABELS } from '@/lib/blog/posts'
import { SITE_URL, SITE_NAME } from '@/config'
import styles from './BlogPost.module.css'

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const related = getRecentPosts(4).filter((p) => p.slug !== post.slug).slice(0, 3)
  const category = CATEGORY_LABELS[post.category] || { label: post.category, color: '#6B7280' }

  // JSON-LD schemas
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description,
    keywords: [post.target_keyword, ...post.secondary_keywords].join(', '),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    url: `${SITE_URL}/blog/${post.slug}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
  }

  const faqJsonLd = post.faq_schema?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faq_schema.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      }
    : null

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  }

  return (
    <>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className={styles.pageWrapper}>
        <div className={styles.layout}>
          {/* ── Article ─────────────────────────────────────────────────────── */}
          <article className={styles.article}>
            {/* Breadcrumb */}
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/home">Inicio</Link>
              <span aria-hidden>›</span>
              <Link href="/blog">Blog</Link>
              <span aria-hidden>›</span>
              <span>{post.title}</span>
            </nav>

            {/* Header */}
            <header className={styles.articleHeader}>
              <span
                className={styles.categoryBadge}
                style={{ backgroundColor: category.color + '22', color: category.color, borderColor: category.color + '44' }}
              >
                {category.label}
              </span>

              <h1 className={styles.articleTitle}>{post.title}</h1>

              <div className={styles.articleMeta}>
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>·</span>
                <span>{post.reading_time_minutes} min de lectura</span>
                <span>·</span>
                <span>~{post.word_count.toLocaleString()} palabras</span>
              </div>

              <p className={styles.articleExcerpt}>{post.meta_description}</p>

              {/* Tags */}
              {post.tags?.length > 0 && (
                <div className={styles.tagsList}>
                  {post.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}
            </header>

            {/* Body */}
            <div
              className={styles.articleBody}
              dangerouslySetInnerHTML={{ __html: post.html_content }}
            />

            {/* FAQ Section */}
            {post.faq_schema?.length > 0 && (
              <section className={styles.faqSection}>
                <h2 className={styles.faqTitle}>Preguntas Frecuentes</h2>
                <div className={styles.faqList}>
                  {post.faq_schema.map((item, i) => (
                    <details key={i} className={styles.faqItem}>
                      <summary className={styles.faqQuestion}>{item.question}</summary>
                      <p className={styles.faqAnswer}>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Back to Blog */}
            <div className={styles.backLink}>
              <Link href="/blog">← Volver al Blog</Link>
            </div>
          </article>

          {/* ── Sidebar ─────────────────────────────────────────────────────── */}
          <aside className={styles.sidebar}>
            {/* Quick Links */}
            <div className={styles.sidebarCard}>
              <h3 className={styles.sidebarTitle}>Explorar Manhwas</h3>
              <nav className={styles.sidebarNav}>
                <Link href="/biblioteca" className={styles.sidebarLink}>📚 Biblioteca completa</Link>
                <Link href="/populares" className={styles.sidebarLink}>🔥 Más populares</Link>
                <Link href="/home" className={styles.sidebarLink}>🆕 Últimas actualizaciones</Link>
              </nav>
            </div>

            {/* Related Posts */}
            {related.length > 0 && (
              <div className={styles.sidebarCard}>
                <h3 className={styles.sidebarTitle}>Artículos Relacionados</h3>
                <div className={styles.relatedList}>
                  {related.map((p) => (
                    <Link key={p.slug} href={`/blog/${p.slug}`} className={styles.relatedItem}>
                      <span className={styles.relatedTitle}>{p.title}</span>
                      <span className={styles.relatedTime}>{p.reading_time_minutes} min</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  )
}
