import { SITE_URL, CHAPTERS_PER_SITEMAP } from '@/config'
import { fetchAllChaptersFromSpaces } from '@/lib/seo/fetchChaptersFromSpaces'
import { buildSitemapIndex, xmlResponse } from '@/lib/seo/xml'

export const revalidate = 1800 // 30 minutos — permite ISR y fetch-level revalidation

export async function GET() {
  const { totalChapters } = await fetchAllChaptersFromSpaces()
  const totalPages = Math.ceil(totalChapters / CHAPTERS_PER_SITEMAP) || 1
  const now = new Date().toISOString()

  const sitemaps = [`${SITE_URL}/sitemap.xml`]
  for (let i = 1; i <= totalPages; i++) {
    sitemaps.push(`${SITE_URL}/sitemap-chapters-${i}.xml`)
  }

  return xmlResponse(buildSitemapIndex(sitemaps, now))
}
