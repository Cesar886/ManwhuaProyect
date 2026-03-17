/**
 * BWT-SEO: Detector de Copilot/AI Cannibalization
 *
 * EXCLUSIVO BWT: Bing incluye métricas de Copilot y Chat en su API.
 *
 * Señal: posición < 4 pero CTR < 1.5% en Bing
 * = tu contenido aparece en respuestas de Copilot sin generar clics
 *
 * Esto es diferente del AI Overview de Google detectado en aiOverview.js:
 *   - aiOverview.js → detecta canibalización por Google AI Overview (solo GSC)
 *   - copilotCannibalization.js → detecta canibalización por Microsoft Copilot (BWT)
 */

const { getQueryStats, getPageStats, getRankAndTrafficStats, normalizeBwtRow } = require('./bwtClient')
const { BWT } = require('../config/apis')

async function detectCopilotCannibalization() {
  console.log('🤖 Detectando canibalización por Copilot/AI (exclusivo BWT)...')

  if (!BWT.API_KEY) {
    console.warn('  ⚠ BWT_API_KEY no configurada. Saltando análisis de Copilot.')
    return []
  }

  // BWT-SEO: Obtener stats de queries y ranking de Bing
  console.log('  → Consultando BWT query stats y ranking...')
  let queryRows = []
  let rankRows = []

  try {
    const [queryData, rankData] = await Promise.all([
      getQueryStats(),
      getRankAndTrafficStats(),
    ])
    queryRows = queryData.map(normalizeBwtRow)
    rankRows = rankData.map(normalizeBwtRow)
  } catch (err) {
    console.warn(`  ⚠ Error consultando BWT: ${err.message}`)
    return []
  }

  // BWT-SEO: Combinar datos de queries y ranking
  const queryMap = new Map()

  for (const row of queryRows) {
    if (!row.query) continue
    const key = row.query.toLowerCase()

    if (!queryMap.has(key)) {
      queryMap.set(key, {
        query: row.query,
        impressions: 0,
        clicks: 0,
        position: 0,
        copilotImpressions: 0,
        copilotClicks: 0,
        positionCount: 0,
      })
    }

    const entry = queryMap.get(key)
    entry.impressions += row.impressions
    entry.clicks += row.clicks
    entry.copilotImpressions += row.copilotImpressions || 0
    entry.copilotClicks += row.copilotClicks || 0
    if (row.position > 0) {
      entry.position += row.position
      entry.positionCount++
    }
  }

  // BWT-SEO: Enriquecer con datos de ranking
  for (const row of rankRows) {
    if (!row.query) continue
    const key = row.query.toLowerCase()
    const entry = queryMap.get(key)
    if (entry && row.copilotImpressions > 0) {
      entry.copilotImpressions = Math.max(entry.copilotImpressions, row.copilotImpressions)
      entry.copilotClicks = Math.max(entry.copilotClicks, row.copilotClicks)
    }
  }

  // BWT-SEO: Obtener mapping de páginas para asociar queries con URLs
  let pageMap = new Map()
  try {
    const pageData = await getPageStats()
    for (const row of pageData.map(normalizeBwtRow)) {
      if (row.page && row.impressions > 0) {
        pageMap.set(row.page, row)
      }
    }
  } catch { /* usar datos sin páginas */ }

  const sospechosos = []

  for (const [, data] of queryMap) {
    // Calcular posición promedio
    const avgPosition = data.positionCount > 0
      ? data.position / data.positionCount
      : 0

    // BWT-SEO: Señal de Copilot Cannibalization:
    // posición < 4 pero CTR < 1.5%
    if (avgPosition >= 4.0 || avgPosition <= 0) continue

    const ctr = data.impressions > 0 ? data.clicks / data.impressions : 0
    if (ctr >= 0.015) continue

    // Mínimo de impresiones para relevancia estadística
    if (data.impressions < 30) continue

    // BWT-SEO: Detectar si hay impresiones de Copilot/Chat
    const apareceCopilot = data.copilotImpressions > 0

    // BWT-SEO: CTR esperado por posición en Bing
    let ctrEsperado
    if (avgPosition <= 1.5) ctrEsperado = 0.25
    else if (avgPosition <= 2.5) ctrEsperado = 0.13
    else ctrEsperado = 0.07

    const deficitPuntos = Math.round((ctrEsperado - ctr) * 10000) / 100

    // Encontrar la página más probable para esta query
    // (BWT no da query+page juntos, usamos la página con más impresiones)
    const bestPage = pageMap.size > 0
      ? [...pageMap.entries()].sort((a, b) => b[1].impressions - a[1].impressions)[0]?.[0] || ''
      : ''

    // BWT-SEO: Generar acción específica
    let accion
    if (apareceCopilot) {
      accion = `Confirmado en Copilot (${data.copilotImpressions} imp.). ` +
        `Optimizar title con CTA directo ("Lee ahora", "Guía completa") para incentivar clic sobre respuesta AI. ` +
        `Considerar contenido interactivo que Copilot no pueda resumir.`
    } else if (ctr < 0.005) {
      accion = `CTR casi nulo (${(ctr * 100).toFixed(2)}%). Alta probabilidad de Copilot/AI cannibalization. ` +
        `Añadir datos exclusivos, tablas comparativas o herramientas interactivas.`
    } else {
      accion = `CTR bajo (${(ctr * 100).toFixed(2)}% vs ${(ctrEsperado * 100).toFixed(0)}% esperado). ` +
        `Posible cannibalization por Copilot. Mejorar meta description con propuesta de valor única.`
    }

    sospechosos.push({
      page: bestPage,
      query: data.query,
      posicion_bing: Math.round(avgPosition * 10) / 10,
      ctr_bing: Math.round(ctr * 10000) / 10000,
      ctr_esperado: ctrEsperado,
      deficit_puntos: deficitPuntos,
      impresiones_bing: data.impressions,
      clics_bing: data.clicks,
      copilot_impressions: data.copilotImpressions,
      copilot_clicks: data.copilotClicks,
      aparece_en_copilot: apareceCopilot,
      accion,
    })
  }

  // BWT-SEO: Ordenar por mayor déficit de CTR
  sospechosos.sort((a, b) => b.deficit_puntos - a.deficit_puntos)

  console.log(`  → ${sospechosos.length} posibles canibalizaciones por Copilot detectadas`)
  console.log(`  → ${sospechosos.filter(s => s.aparece_en_copilot).length} confirmadas en Copilot`)
  return sospechosos
}

module.exports = { detectCopilotCannibalization }
