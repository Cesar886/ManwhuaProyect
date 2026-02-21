import { SITE_NAME, SITE_URL } from '@/config'

export const metadata = {
  title: 'Blog de Manhwa - Guías, Comparativas y Recomendaciones 2026',
  description: 'Blog sobre manhwa en español: guías para principiantes, comparativas de plataformas, los 20 mejores manhwas 2026, ranking mensual y todo sobre k-dramas adaptados.',
  keywords: [
    'blog manhwa',
    'guías manhwa español',
    'mejores manhwas 2026',
    'qué es un manhwa',
    'manhwa vs webtoon',
    'sitios para leer manhwa en español',
    'manhwas adaptados k-dramas',
    'ranking manhwa febrero 2026',
    'mejores manhwas acción',
    'cómo empezar a leer manhwa',
    'manga vs manhwa manhua',
    'manhwas recomendados',
    'leer manhwa online gratis',
    'webtoon español',
    'manhwa para principiantes',
  ],
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
    title: 'Blog de Manhwa — Guías, Comparativas y Recomendaciones | Manhwa Imperial',
    description: 'Blog sobre manhwa en español: guías para principiantes, comparativas de plataformas y recomendaciones por género.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
}

export default function BlogLayout({ children }) {
  return children
}
