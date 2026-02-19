import { SITE_URL } from '@/config'
import { fetchAllSeriesForSitemap } from '@/lib/seo/fetchSeries'
import { buildUrlset, urlEntry, xmlResponse } from '@/lib/seo/xml'

export const revalidate = 3600

export async function GET() {
  const series = await fetchAllSeriesForSitemap()
  const now = new Date().toISOString()

  const staticPages = [
    { path: '/',            priority: '1.0', freq: 'daily'   },
    { path: '/home',        priority: '1.0', freq: 'daily'   },
    { path: '/populares',   priority: '0.9', freq: 'daily'   },
    { path: '/colecciones', priority: '0.7', freq: 'weekly'  },
    { path: '/biblioteca',  priority: '0.6', freq: 'weekly'  },
    { path: '/pedidos',     priority: '0.5', freq: 'monthly' },
    { path: '/register',    priority: '0.3', freq: 'monthly' },
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
