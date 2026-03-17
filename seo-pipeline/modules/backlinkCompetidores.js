/**
 * BWT-SEO: Análisis de Backlinks de Competidores
 *
 * EXCLUSIVO BWT: Permite ver backlinks de CUALQUIER dominio,
 * no solo el tuyo. GSC solo muestra los tuyos.
 *
 * Para cada competidor:
 *   - Top dominios referentes (referring domains)
 *   - Anchor text más usado
 *   - Páginas más enlazadas
 *
 * Cruza con tus propios backlinks para detectar:
 *   - Dominios que enlazan a competidores pero NO a ti = oportunidades
 */

const { getLinkCounts, getUrlLinks } = require('./bwtClient')
const { COMPETITORS, BWT } = require('../config/apis')

/**
 * BWT-SEO: Obtener backlinks de un dominio
 *
 * @param {string} domain - Dominio a analizar
 * @returns {Promise<Object>} Datos de backlinks del dominio
 */
async function getBacklinksForDomain(domain) {
  const url = domain.startsWith('http') ? domain : `https://${domain}`

  // BWT-SEO: Obtener conteo total de links
  const linkCounts = await getLinkCounts(url)

  // BWT-SEO: Obtener URLs enlazantes (primera página)
  const links = await getUrlLinks(url, 0)

  return {
    domain,
    linkCounts,
    links,
  }
}

/**
 * BWT-SEO: Extraer dominios referentes de los links
 */
function extractReferringDomains(links) {
  const domains = new Map()

  for (const link of links) {
    const sourceUrl = link.SourceUrl || link.Url || link.sourceUrl || link.url || ''
    if (!sourceUrl) continue

    try {
      const domain = new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`).hostname
      if (!domains.has(domain)) {
        domains.set(domain, {
          domain,
          count: 0,
          anchors: new Set(),
          targetPages: new Set(),
        })
      }
      const entry = domains.get(domain)
      entry.count++

      const anchor = link.AnchorText || link.anchorText || link.anchor || ''
      if (anchor) entry.anchors.add(anchor)

      const targetUrl = link.TargetUrl || link.targetUrl || ''
      if (targetUrl) entry.targetPages.add(targetUrl)
    } catch { /* URL inválida, ignorar */ }
  }

  return [...domains.values()]
    .map(d => ({
      ...d,
      anchors: [...d.anchors],
      targetPages: [...d.targetPages],
    }))
    .sort((a, b) => b.count - a.count)
}

async function analyzeBacklinkCompetidores() {
  console.log('🔗 Analizando Backlinks de Competidores (exclusivo BWT)...')

  if (!BWT.API_KEY) {
    console.warn('  ⚠ BWT_API_KEY no configurada. Saltando análisis de backlinks.')
    return []
  }

  // BWT-SEO: Obtener nuestros propios backlinks primero
  console.log('  → Obteniendo backlinks propios...')
  const ownBacklinks = await getBacklinksForDomain(BWT.SITE_URL)
  const ownReferringDomains = new Set(
    extractReferringDomains(ownBacklinks.links).map(d => d.domain)
  )

  console.log(`  → ${ownReferringDomains.size} dominios referentes propios encontrados`)

  // BWT-SEO: Analizar cada competidor
  const oportunidades = []

  for (const competitor of COMPETITORS) {
    console.log(`  → Analizando competidor: ${competitor}...`)

    try {
      const competitorData = await getBacklinksForDomain(competitor)
      const competitorDomains = extractReferringDomains(competitorData.links)

      for (const refDomain of competitorDomains) {
        // BWT-SEO: Si este dominio enlaza al competidor pero NO a nosotros
        const enlazaANosotros = ownReferringDomains.has(refDomain.domain)

        // Ignorar dominios que ya nos enlazan
        if (enlazaANosotros) continue

        // Ignorar el propio competidor
        if (refDomain.domain === competitor) continue

        // Ignorar dominios irrelevantes (redes sociales, plataformas genéricas)
        const ignoreList = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
          'reddit.com', 'wikipedia.org', 'google.com', 'bing.com', 't.co']
        if (ignoreList.some(ig => refDomain.domain.includes(ig))) continue

        oportunidades.push({
          dominio_referente: refDomain.domain,
          enlaza_a_competidor: competitor,
          enlaza_a_manhwaimperial: false,
          links_al_competidor: refDomain.count,
          anchor_text_comun: refDomain.anchors.slice(0, 5).join(', ') || 'N/A',
          paginas_enlazadas: refDomain.targetPages.slice(0, 3),
          accion: `Contactar ${refDomain.domain} para solicitar mención o guest post. ` +
            `Anchor text frecuente: "${refDomain.anchors[0] || 'manhwa'}"`,
        })
      }
    } catch (err) {
      console.warn(`  ⚠ Error analizando ${competitor}: ${err.message}`)
    }
  }

  // BWT-SEO: Deduplicar por dominio referente (puede aparecer en varios competidores)
  const deduplicado = new Map()
  for (const op of oportunidades) {
    const existing = deduplicado.get(op.dominio_referente)
    if (!existing || op.links_al_competidor > existing.links_al_competidor) {
      deduplicado.set(op.dominio_referente, op)
    }
  }

  const resultado = [...deduplicado.values()]
    .sort((a, b) => b.links_al_competidor - a.links_al_competidor)

  console.log(`  → ${resultado.length} oportunidades de link building detectadas`)
  return resultado
}

module.exports = { analyzeBacklinkCompetidores }
