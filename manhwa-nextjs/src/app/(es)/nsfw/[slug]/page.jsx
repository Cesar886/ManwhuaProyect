import { fetchSeriesForSEO } from '@/lib/seo/fetchSeries'
import { notFound } from 'next/navigation'
import { isAdultSeries } from '@/utils/adultContent'
import ManhwaDetail from '../../manhwa/[slug]/ManhwaDetailClient'

export const revalidate = 3600

export async function generateMetadata({ params }) {
  const { slug } = await params
  const series = await fetchSeriesForSEO(slug)

  if (!series || !isAdultSeries(series)) {
    notFound()
  }

  return {
    title: `${series.title} | Contenido +18`,
    description: `Lee ${series.title} en la sección para adultos (+18).`,
    alternates: {
      canonical: `/nsfw/${slug}`,
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        'max-image-preview': 'none',
        'max-snippet': -1,
      },
    },
  }
}

export default async function NsfwDetailPage({ params }) {
  const { slug } = await params
  const series = await fetchSeriesForSEO(slug)

  if (!series || !isAdultSeries(series)) {
    notFound()
  }

  return <ManhwaDetail initialSeries={series} basePath="/nsfw" />
}
