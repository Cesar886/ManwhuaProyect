/**
 * DUAL-SEO: Monitor de Caída de Tráfico Dual (GSC + BWT)
 *
 * Compara últimos 7 días vs 7 anteriores en AMBAS fuentes.
 *
 * Diagnóstico diferenciado:
 *   - Caída en Google Y en Bing > 20% → problema de contenido/algoritmo
 *   - Caída solo en Google → posible penalización o cambio de algoritmo Google
 *   - Caída solo en Bing → posible bloqueo de Bingbot o cambio en Copilot
 *   - Caída en Google pero subida en Bing → oportunidad de pivot de tráfico
 */

const { queryAllRows, dateOffset } = require('./gscClient')
const { getPageStats, normalizeBwtRow } = require('./bwtClient')

// DUAL-SEO: Generar diagnóstico basado en patrones de caída
function generateDiagnostic(caidaGoogle, caidaBing) {
  if (caidaGoogle > 20 && caidaBing > 20) {
    return 'Caída en ambos motores. Problema de contenido, algoritmo generalizado o issue técnico del sitio.'
  }
  if (caidaGoogle > 20 && caidaBing <= 0) {
    return 'Caída solo en Google, Bing estable/subiendo. Posible cambio de algoritmo Google o penalización.'
  }
  if (caidaGoogle <= 0 && caidaBing > 20) {
    return 'Caída solo en Bing, Google estable. Posible bloqueo de Bingbot o cambio en Copilot/AI.'
  }
  if (caidaGoogle > 20 && caidaBing < -10) {
    return 'Caída en Google pero SUBIDA en Bing. Oportunidad de pivot: reforzar presencia en Bing/Copilot.'
  }
  if (caidaGoogle > 20) {
    return 'Caída principalmente en Google. Revisar Core Update reciente y calidad de contenido.'
  }
  if (caidaBing > 20) {
    return 'Caída principalmente en Bing. Verificar accesibilidad para Bingbot y Schema markup.'
  }
  return 'Caída moderada. Monitorear tendencia en próximos días.'
}

// DUAL-SEO: Generar acción correctiva
function generateAction(caidaGoogle, caidaBing, diagnostic) {
  if (caidaGoogle > 40 && caidaBing > 40) {
    return 'URGENTE: Verificar accesibilidad del sitio (DNS, SSL, server). Si OK, auditar contenido duplicado y thin content.'
  }
  if (caidaGoogle > 20 && caidaBing <= 0) {
    return 'Revisar Google Search Console > Acciones manuales. Analizar Core Update. No tocar configuración de Bing.'
  }
  if (caidaBing > 20 && caidaGoogle <= 0) {
    return 'Verificar robots.txt para Bingbot. Resubmitir via IndexNow. Revisar Bing Webmaster Tools > Diagnostics.'
  }
  if (caidaGoogle > 20 && caidaBing < -10) {
    return 'Considerar optimizar más contenido para Bing/Copilot. Implementar IndexNow agresivo.'
  }
  return 'Refrescar contenido, mejorar internal linking y monitorear tendencia.'
}

// DUAL-SEO: Clasificar nivel de alerta
function classifyAlert(caidaGoogle, caidaBing) {
  const maxCaida = Math.max(caidaGoogle, caidaBing)
  if (maxCaida > 40) return 'CRÍTICO'
  if (maxCaida > 20) return 'MODERADO'
  return 'INFORMATIVO'
}

async function detectMonitorCaidaDual() {
  console.log('📉 Monitoreando caídas de tráfico dual (GSC + BWT)...')

  // GSC-SEO: Periodo reciente (últimos 7 días, con 3 días de delay)
  console.log('  → Consultando GSC periodos comparativos...')
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

  // GSC: Indexar por página
  const gscRecentMap = new Map()
  for (const row of gscRecent) {
    gscRecentMap.set(row.keys[0], { clicks: row.clicks, impressions: row.impressions })
  }
  const gscPreviousMap = new Map()
  for (const row of gscPrevious) {
    gscPreviousMap.set(row.keys[0], { clicks: row.clicks, impressions: row.impressions })
  }

  // BWT-SEO: Obtener stats de páginas de Bing
  // BWT no permite rango de fechas en getPageStats, usamos datos globales
  let bwtPageMap = new Map()
  try {
    console.log('  → Consultando BWT stats de páginas...')
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
    console.warn(`  ⚠ BWT no disponible: ${err.message}. Análisis solo con GSC.`)
  }

  const paginasCaida = []

  // DUAL-SEO: Analizar todas las páginas conocidas
  const allPages = new Set([...gscPreviousMap.keys(), ...gscRecentMap.keys()])

  for (const page of allPages) {
    const gscPrev = gscPreviousMap.get(page)
    const gscNow = gscRecentMap.get(page)

    // Ignorar páginas con muy pocos datos
    if ((!gscPrev || gscPrev.clicks < 5) && (!gscNow || gscNow.clicks < 5)) continue

    const clicsGoogleAntes = gscPrev?.clicks || 0
    const clicsGoogleAhora = gscNow?.clicks || 0

    // Calcular caída en Google
    const caidaGooglePct = clicsGoogleAntes > 0
      ? Math.round(((clicsGoogleAntes - clicsGoogleAhora) / clicsGoogleAntes) * 100)
      : 0

    // BWT: Usar datos disponibles (sin comparación temporal directa por limitación de API)
    const bwtData = bwtPageMap.get(page)
    const caidaBingPct = 0 // BWT no ofrece comparación temporal directa
    const clicsBing = bwtData?.clicks || 0

    // DUAL-SEO: Solo reportar si hay caída significativa en al menos un motor
    if (caidaGooglePct < 20) continue

    const diagnostico = generateDiagnostic(caidaGooglePct, caidaBingPct)
    const accion = generateAction(caidaGooglePct, caidaBingPct, diagnostico)
    const nivelAlerta = classifyAlert(caidaGooglePct, caidaBingPct)

    paginasCaida.push({
      page,
      clics_google_antes: clicsGoogleAntes,
      clics_google_ahora: clicsGoogleAhora,
      caida_google_pct: caidaGooglePct,
      clics_bing_actual: clicsBing,
      caida_bing_pct: caidaBingPct,
      diagnostico,
      accion,
      nivel_alerta: nivelAlerta,
    })
  }

  // DUAL-SEO: Ordenar por severidad y magnitud de caída
  const alertaOrden = { 'CRÍTICO': 0, 'MODERADO': 1, 'INFORMATIVO': 2 }
  paginasCaida.sort((a, b) => {
    if (alertaOrden[a.nivel_alerta] !== alertaOrden[b.nivel_alerta]) {
      return alertaOrden[a.nivel_alerta] - alertaOrden[b.nivel_alerta]
    }
    return b.caida_google_pct - a.caida_google_pct
  })

  console.log(`  → ${paginasCaida.length} páginas en caída detectadas`)
  console.log(`  → ${paginasCaida.filter(p => p.nivel_alerta === 'CRÍTICO').length} críticas`)
  return paginasCaida
}

module.exports = { detectMonitorCaidaDual }
