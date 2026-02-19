import { SITE_URL, CHAPTERS_PER_SITEMAP } from '@/config'
import { fetchAllChaptersFromSpaces } from '@/lib/seo/fetchChaptersFromSpaces'
import { buildUrlset, urlEntry, xmlResponse } from '@/lib/seo/xml'

export const revalidate = 1800

export async function GET(request, { params }) {
  const { page } = await params
  const pageNum = parseInt(page, 10) || 1
  const { allChapters } = await fetchAllChaptersFromSpaces()

  const start = (pageNum - 1) * CHAPTERS_PER_SITEMAP
  const pageChapters = allChapters.slice(start, start + CHAPTERS_PER_SITEMAP)

  const urls = pageChapters.map(ch => {
    const lastmod = ch.lastModified
      ? new Date(ch.lastModified).toISOString()
      : new Date().toISOString()

    // Prioridad y frecuencia según recencia del capítulo:
    // - isLatest: último capítulo de serie actualizada recientemente → máxima prioridad
    // - isRecent: serie activa (últimos 14 días) → prioridad media
    // - resto: capítulos antiguos → prioridad baja
    let priority, changefreq
    if (ch.isLatest) {
      priority = '0.9'
      changefreq = 'daily'
    } else if (ch.isRecent) {
      priority = '0.8'
      changefreq = 'weekly'
    } else {
      priority = '0.7'
      changefreq = 'monthly'
    }

    return urlEntry(
      `${SITE_URL}/manhwa/${ch.seriesSlug}/capitulo/${ch.chapterNumber}`,
      lastmod,
      changefreq,
      priority,
    )
  })

  return xmlResponse(buildUrlset(urls))
}
