/**
 * IMPERIAL-AGENT v3: Modulo 5 — Content Gaps Detector Cross-Motor
 *
 * Queries con > 50 impresiones sin pagina en DB.
 * Usa queries exactas de BWT (no anonimizadas).
 *
 * Clasificacion:
 *   "mejores","top","lista","ranking" -> lista
 *   nombre de obra especifica         -> obra
 *   "resena","review","opinion"       -> resena
 *   Sin clasificacion clara           -> lista
 *
 * Prioridad: ALTA > 400 imp | MEDIA 150-400 | BAJA < 150
 * Tomar top 5 ALTA (o MEDIA si no hay ALTA).
 */

const { queryAllRows, dateOffset } = require('./gscClient')
const { getQueryStats, normalizeBwtRow } = require('./bwtClient')
const { wasGapProcessedRecently } = require('../core/agentMemory')
const { AGENT } = require('../config/agentConfig')

const LISTA_SIGNALS = ['mejores', 'top', 'lista', 'ranking', 'recomendados', 'parecidos', 'similares']
const RESENA_SIGNALS = ['resena', 'review', 'vale la pena', 'opinion', 'analisis']

function classifyPageType(query) {
  const q = query.toLowerCase()
  if (LISTA_SIGNALS.some(s => q.includes(s))) return 'lista'
  if (RESENA_SIGNALS.some(s => q.includes(s))) return 'resena'
  return 'obra'
}

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

// v2: Prioridad basada en spec exacta
function classifyPriority(totalImp) {
  if (totalImp >= AGENT.FILTERS.CG_ALTA_MIN_IMP) return 'ALTA'
  if (totalImp >= AGENT.FILTERS.CG_MEDIA_MIN_IMP) return 'MEDIA'
  return 'BAJA'
}

async function detectContentGapsCross() {
  console.log('  [M5] Analizando Content Gaps Cross-Motor (GSC + BWT)...')

  // GSC: ultimos 90 dias (Rango C)
  const gscRows = await queryAllRows({
    startDate: dateOffset(90),
    endDate: dateOffset(3),
    dimensions: ['query', 'page'],
  })

  // BWT: queries NO anonimizadas
  let bwtRows = []
  try {
    const queryData = await getQueryStats()
    bwtRows = queryData.map(normalizeBwtRow)
    console.log(`  [M5] BWT: ${bwtRows.length} queries obtenidas`)
  } catch (err) {
    console.warn(`  [M5] BWT no disponible: ${err.message}. Solo GSC.`)
  }

  // Agrupar GSC por query
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

  // Agrupar BWT por query
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

  // Unificar queries
  const allQueries = new Set([...gscQueryMap.keys(), ...bwtQueryMap.keys()])
  const contentGaps = []

  for (const queryLower of allQueries) {
    const gscData = gscQueryMap.get(queryLower)
    const bwtData = bwtQueryMap.get(queryLower)

    const impGoogle = gscData?.totalImpressions || 0
    const impBing = bwtData?.totalImpressions || 0
    const totalImp = impGoogle + impBing

    if (totalImp < AGENT.FILTERS.CG_MIN_IMPRESSIONS) continue

    const query = gscData?.originalQuery || bwtData?.originalQuery || queryLower

    // v2: No procesar gaps ya procesados en ultimas 2 semanas
    if (wasGapProcessedRecently(query, 14)) continue

    // Verificar si hay pagina dedicada
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

    const avgPosGoogle = gscData?.positions.length
      ? gscData.positions.reduce((a, b) => a + b, 0) / gscData.positions.length
      : null
    const avgPosBing = bwtData?.positions.length
      ? bwtData.positions.reduce((a, b) => a + b, 0) / bwtData.positions.length
      : null

    const exclusivoBing = !gscData && !!bwtData
    const tipoPagina = classifyPageType(query)
    const querySlug = queryToSlug(query)

    let rutaSugerida
    switch (tipoPagina) {
      case 'lista': rutaSugerida = `/listas/${querySlug}`; break
      case 'resena': rutaSugerida = `/blog/resena-${querySlug}`; break
      default: rutaSugerida = `/manhwa/${querySlug}`
    }

    // v2: Prioridad segun spec
    let prioridadContenido = classifyPriority(totalImp)
    if (exclusivoBing && impBing > 50) prioridadContenido = 'ALTA'

    contentGaps.push({
      query,
      impresiones_google: impGoogle,
      impresiones_bing: impBing,
      posicion_promedio_google: avgPosGoogle ? Math.round(avgPosGoogle * 10) / 10 : null,
      posicion_promedio_bing: avgPosBing ? Math.round(avgPosBing * 10) / 10 : null,
      exclusivo_bing: exclusivoBing,
      tipo_pagina: tipoPagina,
      prioridad_contenido: prioridadContenido,
      accion: `Crear ${rutaSugerida}`,
      ruta_sugerida: rutaSugerida,
      urls_actuales: [...pages].slice(0, 3),
    })
  }

  // Ordenar por prioridad y impresiones
  const prioridadOrden = { ALTA: 0, MEDIA: 1, BAJA: 2 }
  contentGaps.sort((a, b) => {
    if (prioridadOrden[a.prioridad_contenido] !== prioridadOrden[b.prioridad_contenido]) {
      return prioridadOrden[a.prioridad_contenido] - prioridadOrden[b.prioridad_contenido]
    }
    return (b.impresiones_google + b.impresiones_bing) - (a.impresiones_google + a.impresiones_bing)
  })

  console.log(`  [M5] ${contentGaps.length} Content Gaps detectados`)
  console.log(`  [M5] ${contentGaps.filter(g => g.prioridad_contenido === 'ALTA').length} ALTA, ${contentGaps.filter(g => g.prioridad_contenido === 'MEDIA').length} MEDIA`)
  return contentGaps
}

module.exports = { detectContentGapsCross }
