const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=1800, s-maxage=1800, stale-while-revalidate=21600',
}

export function xmlResponse(xml) {
  return new Response(xml, { headers: XML_HEADERS })
}

// Escapa caracteres especiales para XML. Las URLs con &, <, >, ", ' romperían
// el sitemap si no se escapan (ej. slugs con `&` o queries con `?x=1&y=2`).
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildUrlset(urls, { withXhtml = false } = {}) {
  const xhtmlNs = withXhtml ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xhtmlNs}>\n${urls.join('\n')}\n</urlset>`
}

export function buildSitemapIndex(sitemaps, lastmod) {
  const entries = sitemaps.map(loc =>
    `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`
}

export function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
}

/**
 * URL con alternativas hreflang (SEO bilingüe).
 * `alternates` = [{ hreflang: 'es', href: '…' }, { hreflang: 'en', href: '…' },
 *                 { hreflang: 'x-default', href: '…' }]
 *
 * Según Google, cada URL del grupo debe listarse a sí misma en sus alternates
 * (auto-referencia), y TODAS las URLs del grupo deben repetir el mismo set.
 * Esta función asume que se llama una vez por cada URL del grupo.
 */
export function urlEntryWithAlternates(loc, lastmod, changefreq, priority, alternates = []) {
  const altLines = alternates
    .filter(a => a && a.hreflang && a.href)
    .map(a => `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}" />`)
    .join('\n')
  const altBlock = altLines ? `\n${altLines}` : ''
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${altBlock}\n  </url>`
}
