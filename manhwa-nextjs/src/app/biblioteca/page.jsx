import { SERVER_API_BASE, SITE_URL } from '../../config'
import { META_TEMPLATES } from '@/lib/seo/constants'
import BibliotecaClient from './BibliotecaClient'
import { filterAvailableSeries } from '@/utils/adultContent'
// SEO: JSON-LD para CollectionPage y breadcrumbs
import { generateBreadcrumbJsonLd, generateWebPageJsonLd } from '@/lib/seo/jsonld'

export const metadata = {
  title: META_TEMPLATES.biblioteca.title,
  description: META_TEMPLATES.biblioteca.description,
  keywords: META_TEMPLATES.biblioteca.keywords,
  // SEO: canonical relativo para consistencia con el resto del sitio (metadataBase lo resuelve)
  alternates: {
    canonical: '/biblioteca',
  },
  openGraph: {
    title: META_TEMPLATES.biblioteca.title,
    description: META_TEMPLATES.biblioteca.description,
    type: 'website',
    url: '/biblioteca',
    siteName: 'Manhwa Imperial',
    locale: 'es_ES',
    // SEO: og:image obligatoria para CTR en redes sociales
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Biblioteca de Manhwas en Español - Manhwa Imperial',
    }],
  },
  // SEO: Twitter Card faltante — necesaria para compartir en Twitter/X
  twitter: {
    card: 'summary_large_image',
    title: META_TEMPLATES.biblioteca.title,
    description: META_TEMPLATES.biblioteca.description,
    images: ['/og-image.png'],
  },
}

// ============================================================================
// SERVER COMPONENT — Precarga los datos SSR para crawlers sin JS
//
// Los crawlers de OpenAI, Perplexity y otros no ejecutan JavaScript.
// Al hacer el fetch aquí (en el servidor), el HTML inicial ya incluye
// el catálogo completo de manhwas, lo que garantiza indexación correcta.
//
// ISR: revalidate=300 → reconstruye la página máximo cada 5 minutos.
// El cliente recibe `initialSeries` y puede refrescar con client-side hooks.
// ============================================================================

export const revalidate = 300

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

async function getInitialSeries() {
  try {
    const res = await fetch(`${SERVER_API_BASE}/spaces/manhwas`, {
      headers: {
        'Accept': 'application/json',
        'Origin': SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 300 }, // ISR: revalidar cada 5 minutos
    })
    if (!res.ok) return []
    const result = await res.json()
    return result.data?.series || result.series || []
  } catch {
    return []
  }
}

export default async function BibliotecaPage() {
  // Fetch ejecutado en el servidor → está en el HTML inicial
  // Filtrar contenido adulto desde el servidor para que no aparezca en el SSR HTML
  const initialSeries = filterAvailableSeries(await getInitialSeries())

  // SEO: JSON-LD schemas para crawlers
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Inicio', url: '/home' },
    { name: 'Biblioteca de Manhwas', url: '/biblioteca' },
  ])
  const webPageJsonLd = generateWebPageJsonLd(
    'CollectionPage',
    'Biblioteca de Manhwas en Español - Catálogo Completo',
    'Explora nuestra biblioteca completa de manhwas en español. Miles de manhwas disponibles para leer gratis.',
    '/biblioteca'
  )

  return (
    <>
      {/* SEO: Schema BreadcrumbList para migas de pan en Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* SEO: Schema CollectionPage para identificar la biblioteca como colección */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <BibliotecaClient initialSeries={initialSeries} />
    </>
  )
}