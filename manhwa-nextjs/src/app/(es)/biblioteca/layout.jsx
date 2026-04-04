import { PAGE_KEYWORDS, SEO_CONTENT } from '@/lib/seo/constants'

/**
 * SEO Metadata para la página de Biblioteca
 * 
 * Keywords objetivo:
 * - biblioteca manhwa
 * - catálogo manhwa
 * - buscar manhwa
 * - manhwa español completo
 */
export const metadata = {
  title: 'Biblioteca de Manhwas - Catálogo Completo en Español | Manhwa Imperial',
  description: SEO_CONTENT.biblioteca.introText,
  keywords: PAGE_KEYWORDS.biblioteca,
  alternates: {
    canonical: '/biblioteca',
    languages: {
      es: '/biblioteca',
      en: '/en/library',
    },
  },
  openGraph: {
    title: 'Biblioteca de Manhwas - Catálogo Completo en Español',
    description: 'Explora nuestra biblioteca completa de manhwas en español gratis. Miles de manhwas disponibles para leer online.',
    type: 'website',
    url: '/biblioteca',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biblioteca de Manhwas | Manhwa Imperial',
    description: 'Miles de manhwas en español para leer gratis. Catálogo completo actualizado diariamente.',
  },
}

export default function BibliotecaLayout({ children }) {
  return children
}
