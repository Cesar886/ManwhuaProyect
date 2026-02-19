import { PAGE_KEYWORDS, META_TEMPLATES } from '@/lib/seo/constants'

/**
 * SEO Metadata para la página principal (Home)
 * 
 * Keywords objetivo:
 * 1. manhwa
 * 2. leer manhwa
 * 3. manhwa en español
 * 4. manhwa online
 * 5. manhwa gratis
 */
export const metadata = {
  title: META_TEMPLATES.home.title,
  description: META_TEMPLATES.home.description,
  keywords: PAGE_KEYWORDS.home,
  alternates: {
    canonical: '/home',
  },
  openGraph: {
    title: META_TEMPLATES.home.title,
    description: META_TEMPLATES.home.description,
    type: 'website',
    url: '/home',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: META_TEMPLATES.home.title,
    description: META_TEMPLATES.home.description,
  },
}

export default function HomeLayout({ children }) {
  return children
}
