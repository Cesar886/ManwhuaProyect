import { SERVER_API_BASE, SITE_URL } from '../../../config'
import { filterAvailableSeriesForLang } from '@/utils/adultContent'
import { generateBreadcrumbJsonLd, generateWebPageJsonLd } from '@/lib/seo/jsonld'
import BibliotecaClient from '../../(es)/biblioteca/BibliotecaClient'

export const revalidate = 300

const API_KEY = process.env.INTERNAL_API_KEY || ''

const defaultHeaders = {
  Accept: 'application/json',
  Origin: SITE_URL,
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
}

async function getInitialSeries() {
  try {
    const res = await fetch(`${SERVER_API_BASE}/spaces/manhwas`, {
      headers: defaultHeaders,
      next: { revalidate: 300 },
    })

    if (!res.ok) return []

    const result = await res.json()
    return result.data?.series || result.series || []
  } catch {
    return []
  }
}

export const metadata = {
  title: 'Manhwa Library - Complete English Catalog | Manhwa Imperial',
  description: 'Explore the complete manhwa library in English. Thousands of free manhwa titles updated daily.',
  alternates: {
    canonical: '/en/library',
    languages: {
      es: '/biblioteca',
      en: '/en/library',
    },
  },
  openGraph: {
    title: 'Manhwa Library - Complete English Catalog | Manhwa Imperial',
    description: 'Explore the complete manhwa library in English. Thousands of free manhwa titles updated daily.',
    type: 'website',
    url: '/en/library',
    siteName: 'Manhwa Imperial',
    locale: 'en_US',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Manhwa Library in English - Manhwa Imperial',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manhwa Library | Manhwa Imperial',
    description: 'Thousands of manhwa titles in English, free to read and updated daily.',
    images: ['/og-image.png'],
  },
}

export default async function LibraryEnPage() {
  const initialSeries = filterAvailableSeriesForLang(await getInitialSeries(), 'en')

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/en/home' },
    { name: 'Manhwa Library', url: '/en/library' },
  ], 'en')

  const webPageJsonLd = generateWebPageJsonLd(
    'CollectionPage',
    'Manhwa Library - Complete English Catalog',
    'Explore the complete manhwa library in English. Thousands of free manhwa titles updated daily.',
    '/en/library'
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <BibliotecaClient initialSeries={initialSeries} lang="en" />
    </>
  )
}