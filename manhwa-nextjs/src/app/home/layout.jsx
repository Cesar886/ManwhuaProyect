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
    // SEO: og:site_name y og:image obligatorios para CTR en redes sociales
    siteName: 'Manhwa Imperial',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Manhwa Imperial - Leer Manhwa en Español Online Gratis',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: META_TEMPLATES.home.title,
    description: META_TEMPLATES.home.description,
    // SEO: Twitter image obligatoria para summary_large_image
    images: ['/og-image.png'],
  },
}

export default function HomeLayout({ children }) {
  return children
}
