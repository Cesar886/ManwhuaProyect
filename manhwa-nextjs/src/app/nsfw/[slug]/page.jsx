import { fetchSeriesForSEO, isSlugAdultSeries } from '@/lib/seo/fetchSeries'
import { notFound } from 'next/navigation'
import { isAdultSeries } from '@/utils/adultContent'
import ManhwaDetail from '../../manhwa/[slug]/ManhwaDetailClient'

export const revalidate = 3600

async function getAdultSeries(slug) {
  const series = await fetchSeriesForSEO(slug)
  if (!series) return null

  // Si el detalle ya trae el flag adulto, usarlo directamente
  if (isAdultSeries(series)) return series

  // Fallback: verificar contra el endpoint de series con filtro adult=only
  const isAdult = await isSlugAdultSeries(slug)
  if (isAdult) return series

  return null
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const series = await getAdultSeries(slug)

  if (!series) {
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
  const series = await getAdultSeries(slug)

  if (!series) {
    notFound()
  }

  return <ManhwaDetail initialSeries={series} basePath="/nsfw" />
}
