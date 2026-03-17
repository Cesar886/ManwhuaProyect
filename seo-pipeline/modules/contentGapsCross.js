/**
 * DUAL-SEO: Detector de Content Gaps Cross-Motor (GSC + BWT)
 *
 * Extiende el detector original fusionando queries de ambos motores.
 *
 * VENTAJA ÚNICA: Bing no anonimiza queries → detectas términos exactos
 * que Google oculta bajo "(not provided)".
 *
 * Queries que aparecen SOLO en Bing = oportunidad ignorada por la mayoría
 * de competidores que solo usan GSC.
 */

const { queryAllRows, dateOffset } = require('./gscClient')
const { getQueryStats, normalizeBwtRow } = require('./bwtClient')

// DUAL-SEO: Palabras que indican intención de lista/ranking
const LISTA_SIGNALS = ['mejores', 'top', 'lista', 'ranking', 'recomendados', 'parecidos', 'similares']
// DUAL-SEO: Palabras que indican intención de reseña
const RESENA_SIGNALS = ['reseña', 'review', 'vale la pena', 'opinión', 'opinion', 'análisis', 'analisis']

function classifyPageType(query) {
  const q = query.toLowerCase()
  if (LISTA_SIGNALS.some(s => q.includes(s))) return 'lista'
  if (RESENA_SIGNALS.some(s => q.includes(s))) return 'reseña'
  return 'obra'
}

// DUAL-SEO: Genera un slug a partir de la query para la URL sugerida
function queryToSlug(query) {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60)
}

async function detectContentGapsCross() {
  console.log('📝 Analizando Content Gaps Cross-Motor (GSC + BWT)...')

  // DUAL-SEO: Obtener queries de GSC
  console.log('  → Consultando Google Search Console...')
  const gscRows = await queryAllRows({
    startDate: dateOffset(90),
    endDate: dateOffset(3),
    dimensions: ['query', 'page'],
  })

  // DUAL-SEO: Obtener queries de BWT
  console.log('  → Consultando Bing Webmaster Tools...')
  let bwtRows = []
  try {
    const queryData = await getQueryStats()
    bwtRows = queryData.map(normalizeBwtRow)
  } catch (err) {
    console.warn(`  ⚠ BWT no disponible: ${err.message}. Continuando solo con GSC.`)
  }

  // DUAL-SEO: Agrupar datos de GSC por query
  const gscQueryMap = new Map()
  for (const row of gscRows) {
    const query = row.keys[0].toLowerCase()
    const page = row.keys[1]

    if (!gscQueryMap.has(query)) {
      gscQueryMap.set(query, {
        originalQuery: row.keys[0],
        totalImpressions: 0,
        totalClicks: 0,
        positions: [],
        pages: new Set(),
      })
    }

    const entry = gscQueryMap.get(query)
    entry.totalImpressions += row.impressions
    entry.totalClicks += row.clicks
    entry.positions.push(row.position)
    entry.pages.add(page)
  }

  // DUAL-SEO: Agrupar datos de BWT por query
  const bwtQueryMap = new Map()
  for (const row of bwtRows) {
    if (!row.query) continue
    const queryLower = row.query.toLowerCase()
    if (!bwtQueryMap.has(queryLower)) {
      bwtQueryMap.set(queryLower, {
        originalQuery: row.query,
        totalImpressions: 0,
        totalClicks: 0,
        positions: [],
      })
    }
    const entry = bwtQueryMap.get(queryLower)
    entry.totalImpressions += row.impressions
    entry.totalClicks += row.clicks
    if (row.position > 0) entry.positions.push(row.position)
  }

  // DUAL-SEO: Unificar todas las queries de ambas fuentes
  const allQueries = new Set([...gscQueryMap.keys(), ...bwtQueryMap.keys()])

  const contentGaps = []

  for (const queryLower of allQueries) {
    const gscData = gscQueryMap.get(queryLower)
    const bwtData = bwtQueryMap.get(queryLower)

    const impGoogle = gscData?.totalImpressions || 0
    const impBing = bwtData?.totalImpressions || 0
    const totalImp = impGoogle + impBing

    // DUAL-SEO: Filtro mínimo de impresiones combinadas
    if (totalImp < 50) continue

    const query = gscData?.originalQuery || bwtData?.originalQuery || queryLower

    // DUAL-SEO: Verificar si alguna URL contiene la keyword en el slug
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const pages = gscData?.pages || new Set()

    const hasDedicatedPage = [...pages].some(pageUrl => {
      try {
        const pagePath = new URL(pageUrl).pathname.toLowerCase()
        const matchingWords = queryWords.filter(w => pagePath.includes(w))
        return matchingWords.length >= Math.ceil(queryWords.length * 0.6)
      } catch { return false }
    })

    if (hasDedicatedPage) continue

    // Calcular posiciones promedio
    const avgPosGoogle = gscData?.positions.length
      ? gscData.positions.reduce((a, b) => a + b, 0) / gscData.positions.length
      : null
    const avgPosBing = bwtData?.positions.length
      ? bwtData.positions.reduce((a, b) => a + b, 0) / bwtData.positions.length
      : null

    // DUAL-SEO: Determinar exclusividad
    const exclusivoBing = !gscData && !!bwtData
    const exclusivoGoogle = !!gscData && !bwtData

    // DUAL-SEO: Clasificar tipo de página y generar URL sugerida
    const tipoPagina = classifyPageType(query)
    const querySlug = queryToSlug(query)
    let rutaSugerida
    switch (tipoPagina) {
      case 'lista':
        rutaSugerida = `/blog/${querySlug}`
        break
      case 'reseña':
        rutaSugerida = `/blog/resena-${querySlug}`
        break
      default:
        rutaSugerida = `/manhwa/${querySlug}`
    }

    // DUAL-SEO: Prioridad basada en impresiones y exclusividad
    let prioridadContenido
    if (totalImp > 500 || exclusivoBing) prioridadContenido = 'ALTA'
    else if (totalImp > 200) prioridadContenido = 'MEDIA'
    else prioridadContenido = 'BAJA'

    // DUAL-SEO: Queries exclusivas de Bing tienen prioridad elevada (oportunidad ignorada)
    if (exclusivoBing && impBing > 50) prioridadContenido = 'ALTA'

    contentGaps.push({
      query,
      impresiones_google: impGoogle,
      impresiones_bing: impBing,
      posicion_promedio_google: avgPosGoogle ? Math.round(avgPosGoogle * 10) / 10 : null,
      posicion_promedio_bing: avgPosBing ? Math.round(avgPosBing * 10) / 10 : null,
      exclusivo_bing: exclusivoBing,
      exclusivo_google: exclusivoGoogle,
      accion: `Crear ${rutaSugerida}`,
      tipo_pagina: tipoPagina,
      prioridad_contenido: prioridadContenido,
      urls_actuales: [...pages].slice(0, 3),
    })
  }

  // DUAL-SEO: Ordenar por prioridad y luego por impresiones totales
  const prioridadOrden = { ALTA: 0, MEDIA: 1, BAJA: 2 }
  contentGaps.sort((a, b) => {
    if (prioridadOrden[a.prioridad_contenido] !== prioridadOrden[b.prioridad_contenido]) {
      return prioridadOrden[a.prioridad_contenido] - prioridadOrden[b.prioridad_contenido]
    }
    return (b.impresiones_google + b.impresiones_bing) - (a.impresiones_google + a.impresiones_bing)
  })

  console.log(`  → ${contentGaps.length} Content Gaps cross-motor detectados`)
  console.log(`  → ${contentGaps.filter(g => g.exclusivo_bing).length} exclusivos de Bing`)
  return contentGaps
}

module.exports = { detectContentGapsCross }
