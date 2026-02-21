import { SERVER_API_BASE, SITE_URL } from '../../config'
import { META_TEMPLATES } from '@/lib/seo/constants'
import BibliotecaClient from './BibliotecaClient'

export const metadata = {
  title: META_TEMPLATES.biblioteca.title,
  description: META_TEMPLATES.biblioteca.description,
  keywords: META_TEMPLATES.biblioteca.keywords,
  alternates: {
    canonical: `${SITE_URL}/biblioteca`,
  },
  openGraph: {
    title: META_TEMPLATES.biblioteca.title,
    description: META_TEMPLATES.biblioteca.description,
    type: 'website',
    url: '/biblioteca',
    siteName: 'Manhwa Imperial',
    locale: 'es_ES',
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
  const initialSeries = await getInitialSeries()

  return <BibliotecaClient initialSeries={initialSeries} />
}