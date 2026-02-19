import { PAGE_KEYWORDS } from '@/lib/seo/constants'

/**
 * SEO Metadata para la página de Populares
 * 
 * Keywords objetivo:
 * - manhwa populares
 * - top manhwa
 * - mejores manhwas
 * - ranking manhwa
 */
export const metadata = {
  title: 'Manhwas Populares - Rankings y Top Series en Español | Manhwa Imperial',
  description: 'Descubre los manhwas más populares y mejor valorados para leer gratis. Rankings actualizados de los mejores manhwas en español. Top manhwas trending y recomendaciones.',
  keywords: PAGE_KEYWORDS.populares,
  alternates: {
    canonical: '/populares',
  },
  openGraph: {
    title: 'Manhwas Populares - Rankings y Top Manhwas',
    description: 'Los manhwas más populares y mejor valorados en español. Rankings actualizados diariamente.',
    type: 'website',
    url: '/populares',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top Manhwas Populares | Manhwa Imperial',
    description: 'Ranking de los mejores manhwas en español. Descubre los más populares y trending.',
  },
}

export default function PopularesLayout({ children }) {
  return children
}
