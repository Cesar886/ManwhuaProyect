import { SERVER_API_BASE, SITE_URL } from '../../../config'
import { filterAvailableSeriesForLang } from '@/utils/adultContent'
import { generateBreadcrumbJsonLd, generateWebPageJsonLd } from '@/lib/seo/jsonld'
import MangasClient from '../../(es)/mangas/MangasClient'

export const revalidate = 300

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

function isMangaSeries(series) {
  const rawType =
    series?.type ||
    series?.seriesType ||
    series?.series_type ||
    series?.contentType ||
    series?.content_type ||
    series?.format ||
    series?.mediaType ||
    series?.media_type ||
    series?.origin

  if (!rawType || typeof rawType !== 'string') return false
  return rawType.trim().toLowerCase().includes('manga')
}

async function getInitialSeries() {
  try {
    const res = await fetch(`${SERVER_API_BASE}/spaces/manhwas`, {
      headers: {
        Accept: 'application/json',
        Origin: SITE_URL,
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) return []

    const result = await res.json()
    const allSeries = result.data?.series || result.series || []
    return allSeries.filter(isMangaSeries)
  } catch {
    return []
  }
}

export const metadata = {
  title: 'Manga in English - Read Online Free | Manhwa Imperial',
  description: 'Read manga in English for free. Explore the complete catalog of translated Japanese manga, updated daily.',
  alternates: {
    canonical: '/en/manga',
    languages: {
      es: '/mangas',
      en: '/en/manga',
    },
  },
  openGraph: {
    title: 'Manga in English - Read Online Free | Manhwa Imperial',
    description: 'Read manga in English for free. Explore the complete catalog of translated Japanese manga, updated daily.',
    type: 'website',
    url: '/en/manga',
    siteName: 'Manhwa Imperial',
    locale: 'en_US',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Manga in English - Manhwa Imperial',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manga in English | Manhwa Imperial',
    description: 'Thousands of manga titles in English, free to read and updated daily.',
    images: ['/og-image.png'],
  },
}

export default async function MangaEnPage() {
  const initialSeries = filterAvailableSeriesForLang(await getInitialSeries(), 'en')

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/en/home' },
    { name: 'Manga in English', url: '/en/manga' },
  ], 'en')

  const webPageJsonLd = generateWebPageJsonLd(
    'CollectionPage',
    'Manga in English - Complete Catalog',
    'Read manga in English for free. Complete catalog of translated Japanese manga, updated daily.',
    '/en/manga'
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
      <MangasClient initialSeries={initialSeries} lang="en" />
    </>
  )
}