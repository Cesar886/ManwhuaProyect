import { SITE_URL, CHAPTERS_PER_SITEMAP } from '@/config'
import { fetchAllChaptersFromSpaces } from '@/lib/seo/fetchChaptersFromSpaces'
import { buildSitemapIndex, xmlResponse } from '@/lib/seo/xml'

// force-dynamic: el sitemap index siempre se genera en runtime con datos frescos
export const dynamic = 'force-dynamic'

export async function GET() {
  const { totalChapters } = await fetchAllChaptersFromSpaces()
  const totalPages = Math.ceil(totalChapters / CHAPTERS_PER_SITEMAP) || 1
  const now = new Date().toISOString()

  const sitemaps = [`${SITE_URL}/sitemap.xml`]
  for (let i = 1; i <= totalPages; i++) {
    sitemaps.push(`${SITE_URL}/sitemap-chapters/${i}`)
  }

  return xmlResponse(buildSitemapIndex(sitemaps, now))
}
