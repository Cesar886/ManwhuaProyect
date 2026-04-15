import { SITE_URL, CHAPTERS_PER_SITEMAP } from '@/config'
import { fetchAllChaptersFromSpaces } from '@/lib/seo/fetchChaptersFromSpaces'
import { buildUrlset, urlEntryWithAlternates, xmlResponse } from '@/lib/seo/xml'

// force-dynamic: los chapter sitemaps siempre se generan en runtime con datos frescos
export const dynamic = 'force-dynamic'

// Construye el bloque de alternates hreflang para un capítulo.
// Solo incluye idiomas en los que la serie realmente está disponible.
// Si la serie es bilingüe (ES+EN), ambas URLs se listan como alternativas y se
// marca `x-default` apuntando al español (idioma principal del sitio).
function buildChapterAlternates(seriesSlug, chapterNumber, languages = []) {
  const alt = []
  if (languages.includes('es')) {
    alt.push({
      hreflang: 'es',
      href: `${SITE_URL}/manhwa/${seriesSlug}/capitulo/${chapterNumber}`,
    })
  }
  if (languages.includes('en')) {
    alt.push({
      hreflang: 'en',
      href: `${SITE_URL}/en/manhwa/${seriesSlug}/chapter/${chapterNumber}`,
    })
  }
  if (alt.length > 0) {
    // x-default: el fallback que ve Google cuando no puede decidir idioma.
    // Preferimos ES por ser la audiencia principal; si la serie solo está en
    // EN, usamos esa.
    const def = alt.find(a => a.hreflang === 'es') || alt[0]
    alt.push({ hreflang: 'x-default', href: def.href })
  }
  return alt
}

export async function GET(request, { params }) {
  const { page } = await params
  const pageNum = parseInt(page, 10) || 1
  const { allChapters } = await fetchAllChaptersFromSpaces()

  const start = (pageNum - 1) * CHAPTERS_PER_SITEMAP
  const pageChapters = allChapters.slice(start, start + CHAPTERS_PER_SITEMAP)

  const urls = []

  for (const ch of pageChapters) {
    const lastmod = ch.lastModified
      ? new Date(ch.lastModified).toISOString()
      : new Date().toISOString()

    // Prioridad y frecuencia según recencia del capítulo
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

    const languages = Array.isArray(ch.languages) && ch.languages.length > 0
      ? ch.languages
      : ['es'] // fallback defensivo

    const alternates = buildChapterAlternates(ch.seriesSlug, ch.chapterNumber, languages)

    // Emitir una entrada <url> por cada idioma en que la serie está disponible.
    // Cada entrada referencia a todos los alternates (incluida a sí misma),
    // como exige Google para hreflang en sitemap.
    if (languages.includes('es')) {
      urls.push(urlEntryWithAlternates(
        `${SITE_URL}/manhwa/${ch.seriesSlug}/capitulo/${ch.chapterNumber}`,
        lastmod, changefreq, priority, alternates,
      ))
    }
    if (languages.includes('en')) {
      urls.push(urlEntryWithAlternates(
        `${SITE_URL}/en/manhwa/${ch.seriesSlug}/chapter/${ch.chapterNumber}`,
        lastmod, changefreq, priority, alternates,
      ))
    }
  }

  return xmlResponse(buildUrlset(urls, { withXhtml: true }))
}
