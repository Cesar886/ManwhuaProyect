import { SITE_NAME, SITE_URL } from '@/config'

export const metadata = {
  title: 'Blog de Manhwa - Guías, Comparativas y Recomendaciones',
  description: 'Blog sobre manhwa en español: guías para principiantes, comparativas de plataformas, recomendaciones por género y noticias del mundo manhwa y webtoon.',
  keywords: [
    'blog manhwa',
    'guías manhwa español',
    'sitios para leer manhwa en español',
    'tapas webtoon en español',
    'manga vs manhwa',
    'manhwas recomendados',
    'mejores manhwas',
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
