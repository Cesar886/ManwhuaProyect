import { PAGE_KEYWORDS } from '@/lib/seo/constants'

/**
 * SEO Metadata para la página de Ranking de Racha
 */
export const metadata = {
  title: 'Ranking de Racha - Top Lectores | Manhwa Imperial',
  description: 'Descubre quiénes son los lectores más constantes de Manhwa Imperial. Ranking de rachas de lectura actualizado en tiempo real.',
  keywords: PAGE_KEYWORDS.populares,
  alternates: {
    canonical: '/ranking',
    languages: {
      es: '/ranking',
      en: '/en/ranking',
    },
  },
  openGraph: {
    title: 'Ranking de Racha - Top Lectores',
    description: 'Los lectores más dedicados de Manhwa Imperial. ¡Mantén tu racha para escalar posiciones!',
    type: 'website',
    url: '/ranking',
    locale: 'es_ES',
    siteName: 'Manhwa Imperial',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Ranking de Racha - Top Lectores | Manhwa Imperial',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ranking de Racha | Manhwa Imperial',
    description: 'Los lectores más constantes de la plataforma. ¡Lee cada día y sube en el ranking!',
    images: ['/og-image.png'],
  },
}

export default function RankingLayout({ children }) {
  return children
}

