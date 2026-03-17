/**
 * IMPERIAL-AGENT v3: Modulo 2 — Monitor de Caida de Trafico Dual (GSC + BWT)
 *
 * Compara Rango A (ultimos 7 dias) vs Rango B (7 dias anteriores) por URL.
 *
 * Niveles de alerta:
 *   Caida > 40% en Google Y Bing -> CRITICO
 *   Caida > 20% solo en Google   -> MODERADO (Core Update)
 *   Caida > 20% solo en Bing     -> MODERADO (Bingbot)
 *   Caida Google + subida Bing   -> INFORMATIVO
 *
 * v2: GPT-4o diagnostica cada URL en alerta con causa raiz y accion.
 */

const { queryAllRows, dateOffset } = require('./gscClient')
const { getPageStats, getQueryStats, normalizeBwtRow } = require('./bwtClient')
const { gptCall } = require('../core/gptClient')
const trafficPrompt = require('../prompts/trafficMonitor.prompt')

// Clasificar nivel de alerta segun v2 spec
function classifyAlert(caidaGoogle, caidaBing) {
  if (caidaGoogle > 40 && caidaBing > 40) return 'CRITICO'
  if (caidaGoogle > 40 || caidaBing > 40) return 'CRITICO'
  if (caidaGoogle > 20 && caidaBing > 20) return 'CRITICO'
  if (caidaGoogle > 20 && caidaBing <= 0) return 'MODERADO'
  if (caidaBing > 20 && caidaGoogle <= 0) return 'MODERADO'
  if (caidaGoogle > 20 && caidaBing < -10) return 'INFORMATIVO'
  return 'MODERADO'
}

async function detectMonitorCaidaDual() {
  console.log('  [M2] Monitoreando caidas de trafico dual (GSC + BWT)...')

  // GSC: Rango A (ultimos 7 dias, con 3 dias de delay) vs Rango B (7 anteriores)
  const [gscRecent, gscPrevious] = await Promise.all([
    queryAllRows({
      startDate: dateOffset(10),
      endDate: dateOffset(3),
      dimensions: ['page'],
    }),
    queryAllRows({
      startDate: dateOffset(17),
      endDate: dateOffset(10),
      dimensions: ['page'],
    }),
  ])

  // Indexar GSC por pagina
  const gscRecentMap = new Map()
  for (const row of gscRecent) {
    gscRecentMap.set(row.keys[0], {
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    })
  }
  const gscPreviousMap = new Map()
  for (const row of gscPrevious) {
    gscPreviousMap.set(row.keys[0], {
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    })
  }

  // BWT: Obtener stats de paginas
  let bwtPageMap = new Map()
  try {
    const bwtPages = await getPageStats()
    const normalized = bwtPages.map(normalizeBwtRow)
    for (const row of normalized) {
      if (row.page) {
        bwtPageMap.set(row.page, {
          clicks: row.clicks,
          impressions: row.impressions,
        })
      }
    }
  } catch (err) {
    console.warn(`  [M2] BWT no disponible: ${err.message}. Analisis solo con GSC.`)
  }

  const paginasCaida = []
  const allPages = new Set([...gscPreviousMap.keys(), ...gscRecentMap.keys()])

  for (const page of allPages) {
    const gscPrev = gscPreviousMap.get(page)
    const gscNow = gscRecentMap.get(page)

    if ((!gscPrev || gscPrev.clicks < 5) && (!gscNow || gscNow.clicks < 5)) continue

    const g_antes = gscPrev?.clicks || 0
    const g_ahora = gscNow?.clicks || 0
    const gpos_antes = gscPrev?.position || 0
    const gpos_ahora = gscNow?.position || 0
    const gimp_antes = gscPrev?.impressions || 0
    const gimp_ahora = gscNow?.impressions || 0

    const caidaGooglePct = g_antes > 0
      ? Math.round(((g_antes - g_ahora) / g_antes) * 100)
      : 0

    // BWT: datos disponibles (sin comparacion temporal por limitacion API)
    const bwtData = bwtPageMap.get(page)
    const b_ahora = bwtData?.clicks || 0
    const bimp_ahora = bwtData?.impressions || 0
    // Sin datos historicos de BWT, estimamos 0% de caida
    const caidaBingPct = 0

    // Solo reportar si hay caida significativa
    if (caidaGooglePct < 20) continue

    const nivelAlerta = classifyAlert(caidaGooglePct, caidaBingPct)

    paginasCaida.push({
      page,
      g_antes, g_ahora, g_pct: -caidaGooglePct,
      gpos_antes: Math.round(gpos_antes * 10) / 10,
      gpos_ahora: Math.round(gpos_ahora * 10) / 10,
      gimp_antes, gimp_ahora,
      b_antes: 0, b_ahora, b_pct: -caidaBingPct,
      bpos_antes: 0, bpos_ahora: 0,
      bimp_antes: 0, bimp_ahora,
      nivel_alerta: nivelAlerta,
    })
  }

  // Ordenar por severidad
  const alertaOrden = { 'CRITICO': 0, 'MODERADO': 1, 'INFORMATIVO': 2 }
  paginasCaida.sort((a, b) => {
    if (alertaOrden[a.nivel_alerta] !== alertaOrden[b.nivel_alerta]) {
      return alertaOrden[a.nivel_alerta] - alertaOrden[b.nivel_alerta]
    }
    return Math.abs(a.g_pct) - Math.abs(b.g_pct)
  })

  // v2: GPT-4o diagnostica cada URL en alerta
  const diagnosed = []
  for (const entry of paginasCaida.slice(0, 10)) { // Max 10 diagnosticos por ejecucion
    try {
      const result = await gptCall(
        trafficPrompt.getSystemPrompt(),
        trafficPrompt.getUserPrompt({
          url: entry.page,
          g_antes: entry.g_antes,
          g_ahora: entry.g_ahora,
          g_pct: entry.g_pct,
          gpos_antes: entry.gpos_antes,
          gpos_ahora: entry.gpos_ahora,
          b_antes: entry.b_antes,
          b_ahora: entry.b_ahora,
          b_pct: entry.b_pct,
          bpos_antes: entry.bpos_antes,
          bpos_ahora: entry.bpos_ahora,
          gimp_antes: entry.gimp_antes,
          gimp_ahora: entry.gimp_ahora,
          bimp_antes: entry.bimp_antes,
          bimp_ahora: entry.bimp_ahora,
        }),
        { moduleNumber: 2 }
      )

      if (result.budget_blocked) {
        console.warn('  [M2] Presupuesto bloqueado, omitiendo diagnosticos GPT.')
        diagnosed.push({ ...entry, diagnostico_ia: null })
        break
      }

      diagnosed.push({
        ...entry,
        diagnostico_ia: result.parsed || null,
      })
    } catch (err) {
      diagnosed.push({ ...entry, diagnostico_ia: null, error: err.message })
    }
  }

  // Agregar los no diagnosticados
  for (const entry of paginasCaida.slice(10)) {
    diagnosed.push({ ...entry, diagnostico_ia: null })
  }

  console.log(`  [M2] ${paginasCaida.length} paginas en caida detectadas`)
  console.log(`  [M2] ${paginasCaida.filter(p => p.nivel_alerta === 'CRITICO').length} criticas`)
  return diagnosed
}

module.exports = { detectMonitorCaidaDual }
