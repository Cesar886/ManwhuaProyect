import { notFound } from 'next/navigation'
import { getPostBySlug, getAllSlugs } from '@/lib/blog/posts'
import { SITE_NAME, SITE_URL } from '@/config'

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  const url = `${SITE_URL}/blog/${post.slug}`

  return {
    title: post.title,
    description: post.meta_description,
    keywords: [post.target_keyword, ...post.secondary_keywords, ...post.tags],
    openGraph: {
      type: 'article',
      locale: 'es_ES',
      url,
      siteName: SITE_NAME,
      title: post.title,
      description: post.meta_description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.meta_description,
    },
    alternates: {
      canonical: url,
    },
  }
}

export default function BlogPostLayout({ children }) {
  return children
}
