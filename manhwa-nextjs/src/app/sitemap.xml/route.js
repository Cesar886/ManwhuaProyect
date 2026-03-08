import { SITE_URL } from '@/config'
import { fetchAllSeriesForSitemap } from '@/lib/seo/fetchSeries'
import { buildUrlset, urlEntry, xmlResponse } from '@/lib/seo/xml'
import { filterAvailableSeries } from '@/utils/adultContent'

// force-dynamic: el sitemap siempre se genera en runtime con datos frescos
// Evita que el build pre-renderice con datos vacíos (API no disponible en build local)
export const dynamic = 'force-dynamic'

export async function GET() {
  const series = filterAvailableSeries(await fetchAllSeriesForSitemap())
  const now = new Date().toISOString()

  const staticPages = [
    // / se excluye del sitemap porque redirige a /home (evitar señales duplicadas)
    { path: '/home',        priority: '1.0', freq: 'daily'   },
    { path: '/populares',   priority: '0.9', freq: 'daily'   },
    { path: '/biblioteca',  priority: '0.8', freq: 'daily'   },
    { path: '/colecciones', priority: '0.7', freq: 'weekly'  },
  ]

  const urls = [
    ...staticPages.map(p => urlEntry(`${SITE_URL}${p.path}`, now, p.freq, p.priority)),
    ...series.map(s => {
      const lastmod = new Date(s.lastUpdated || s.updatedAt || s.updated_at || Date.now()).toISOString()
      return urlEntry(`${SITE_URL}/manhwa/${s.slug}`, lastmod, 'daily', '0.9')
    }),
  ]

  return xmlResponse(buildUrlset(urls))
}
