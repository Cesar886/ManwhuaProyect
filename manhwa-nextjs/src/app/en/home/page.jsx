import HomeClient from '../../(es)/home/HomeClient'
import { endpoint, SITE_URL } from '../../../config'
import { generateFAQJsonLdForHome } from '@/lib/seo/jsonld'
import { filterAvailableSeries } from '@/utils/adultContent'

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

const defaultHeaders = {
  'Accept': 'application/json',
  'Origin': SITE_URL,
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
}

async function getInitialSeries() {
  try {
    const res = await fetch(endpoint('spaces', 'manhwas'), {
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
  title: 'Home - Read Manhwa Online Free',
  description: 'Discover the best manhwa and webtoons in English. AI-powered search, daily updates, and thousands of titles available for free.',
  alternates: {
    canonical: '/en/home',
    languages: {
      es: '/home',
      en: '/en/home',
    },
  },
}

export default async function EnHome() {
  const initialSeries = filterAvailableSeries(await getInitialSeries())

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQJsonLdForHome('en')) }}
      />
      <HomeClient initialSeries={initialSeries} lang="en" />
    </>
  )
}
