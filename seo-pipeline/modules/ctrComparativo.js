/**
 * DUAL-SEO: Análisis CTR Comparativo Google vs Bing por Tipo de Página
 *
 * Extiende el análisis CTR original agregando datos de Bing para comparación.
 *
 * Si CTR de un tipo es alto en Bing pero bajo en Google:
 * → El snippet/schema funciona para Bing pero no para Google
 * → Acción: revisar rich snippets y title tags para ese tipo
 *
 * Agrupa URLs por patrón de slug:
 *   /obra/* → "obra individual"
 *   /lista/* o /top/* → "listado"
 *   /genero/* o /tag/* → "taxonomía"
 *   / → "home"
 */

const { queryAllRows, dateOffset } = require('./gscClient')
const { getPageStats, getQueryStats, normalizeBwtRow } = require('./bwtClient')

// DUAL-SEO: Clasificar URL por tipo de contenido (reutiliza lógica de ctrAnalysis)
function classifyUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase()

    if (/\/manhwa\/[^/]+\/capitulo\//.test(pathname)) return 'capítulo'
    if (/\/nsfw\/[^/]+\/capitulo\//.test(pathname)) return 'capítulo'
    if (/\/manhwa\/[^/]+$/.test(pathname)) return 'obra individual'
    if (/\/nsfw\/[^/]+$/.test(pathname)) return 'obra individual'
    if (/\/genero\//.test(pathname)) return 'taxonomía'
    if (/\/blog\//.test(pathname)) return 'listado'
    if (/\/populares/.test(pathname)) return 'listado'
    if (/\/colecciones/.test(pathname)) return 'listado'
    if (/\/biblioteca/.test(pathname)) return 'biblioteca'
    if (/\/mangas/.test(pathname)) return 'biblioteca'
    if (/^\/(home)?$/.test(pathname)) return 'home'
    if (/\/(terminos|politica|dmca|aviso|acerca)/.test(pathname)) return 'legal'
    if (/\/busqueda-ia\//.test(pathname)) return 'búsqueda IA'

    return 'otro'
  } catch {
    return 'otro'
  }
}

async function analyzeCtrComparativo() {
  console.log('📊 Analizando CTR Comparativo Google vs Bing...')

  // GSC-SEO: Obtener datos de Google por página
  console.log('  → Consultando GSC...')
  const gscRows = await queryAllRows({
    startDate: dateOffset(90),
    endDate: dateOffset(3),
    dimensions: ['page'],
  })

  // BWT-SEO: Obtener datos de Bing por página
  console.log('  → Consultando BWT...')
  let bwtRows = []
  try {
    const pageData = await getPageStats()
    bwtRows = pageData.map(normalizeBwtRow)
  } catch (err) {
    console.warn(`  ⚠ BWT no disponible: ${err.message}. Análisis solo con GSC.`)
  }

  // DUAL-SEO: Agrupar métricas de GSC por tipo
  const tipoMapGoogle = new Map()
  for (const row of gscRows) {
    const page = row.keys[0]
    const tipo = classifyUrl(page)

    if (!tipoMapGoogle.has(tipo)) {
      tipoMapGoogle.set(tipo, {
        totalClicks: 0,
        totalImpressions: 0,
        pages: new Set(),
      })
    }

    const entry = tipoMapGoogle.get(tipo)
    entry.totalClicks += row.clicks
    entry.totalImpressions += row.impressions
    entry.pages.add(page)
  }

  // DUAL-SEO: Agrupar métricas de BWT por tipo
  const tipoMapBing = new Map()
  for (const row of bwtRows) {
    if (!row.page) continue
    const tipo = classifyUrl(row.page)

    if (!tipoMapBing.has(tipo)) {
      tipoMapBing.set(tipo, {
        totalClicks: 0,
        totalImpressions: 0,
        pages: new Set(),
      })
    }

    const entry = tipoMapBing.get(tipo)
    entry.totalClicks += row.clicks
    entry.totalImpressions += row.impressions
    entry.pages.add(row.page)
  }

  // DUAL-SEO: Fusionar resultados de ambos motores
  const allTipos = new Set([...tipoMapGoogle.keys(), ...tipoMapBing.keys()])
  const resultados = []

  for (const tipo of allTipos) {
    const google = tipoMapGoogle.get(tipo)
    const bing = tipoMapBing.get(tipo)

    const ctrGoogle = google && google.totalImpressions > 0
      ? google.totalClicks / google.totalImpressions
      : 0
    const ctrBing = bing && bing.totalImpressions > 0
      ? bing.totalClicks / bing.totalImpressions
      : 0

    const paginasGoogle = google?.pages.size || 0
    const paginasBing = bing?.pages.size || 0
    const paginas = Math.max(paginasGoogle, paginasBing)

    // DUAL-SEO: Generar diagnóstico comparativo
    let diagnostico = ''
    let recomendacion = ''

    const diff = ctrBing - ctrGoogle

    if (ctrBing > 0 && ctrGoogle > 0) {
      if (diff > 0.03) {
        diagnostico = `Bing favorece ${tipo} (CTR +${(diff * 100).toFixed(1)}pp vs Google). Snippet/schema funciona mejor en Bing.`
        recomendacion = `Analizar qué elementos del snippet de Bing funcionan y replicar en meta tags para Google. Considerar optimización específica para Copilot.`
      } else if (diff < -0.03) {
        diagnostico = `Google favorece ${tipo} (CTR +${(Math.abs(diff) * 100).toFixed(1)}pp vs Bing). Snippet optimizado para Google.`
        recomendacion = `Revisar cómo aparecen los snippets en Bing. Optimizar structured data y meta description para Bing.`
      } else {
        diagnostico = `CTR similar en ambos motores para ${tipo}. Estrategia uniforme funciona.`
        recomendacion = `Mantener optimización actual. Monitorear tendencia.`
      }
    } else if (ctrBing > 0 && ctrGoogle === 0) {
      diagnostico = `Tráfico solo en Bing para ${tipo}. Posible issue de indexación en Google.`
      recomendacion = `Verificar indexación en GSC y enviar sitemap actualizado.`
    } else if (ctrGoogle > 0 && ctrBing === 0) {
      diagnostico = `Tráfico solo en Google para ${tipo}. Oportunidad de capturar tráfico de Bing.`
      recomendacion = `Verificar indexación en BWT y enviar via IndexNow.`
    }

    // DUAL-SEO: Recomendaciones específicas por tipo
    if (tipo === 'listado' && ctrBing > ctrGoogle) {
      recomendacion += ' Agregar más listas optimizadas para Bing/Copilot con schema ItemList.'
    }
    if (tipo === 'obra individual' && ctrGoogle < 0.03) {
      recomendacion += ' Optimizar title con verbos de acción y estado de la obra.'
    }

    resultados.push({
      tipo,
      ctr_google: Math.round(ctrGoogle * 10000) / 10000,
      ctr_bing: Math.round(ctrBing * 10000) / 10000,
      clics_google: google?.totalClicks || 0,
      clics_bing: bing?.totalClicks || 0,
      impresiones_google: google?.totalImpressions || 0,
      impresiones_bing: bing?.totalImpressions || 0,
      paginas_analizadas: paginas,
      diagnostico,
      recomendacion,
    })
  }

  // DUAL-SEO: Ordenar por impresiones totales descendente
  resultados.sort((a, b) =>
    (b.impresiones_google + b.impresiones_bing) - (a.impresiones_google + a.impresiones_bing)
  )

  console.log(`  → ${resultados.length} tipos de página analizados comparativamente`)
  return resultados
}

module.exports = { analyzeCtrComparativo }
