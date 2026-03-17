/**
 * DUAL-SEO: Detector de Quick Wins Unificado (GSC + BWT)
 *
 * Extiende el detector de Quick Wins original fusionando datos de ambos motores.
 * FULL OUTER JOIN por query + page para máxima cobertura.
 *
 * VENTAJA BWT: Queries NO anonimizadas → más datos accionables.
 * VENTAJA DUAL: Detecta discrepancias de posición entre motores.
 *
 * Lógica de fusión:
 *   - query en ambos con posición diferente → analizar discrepancia
 *   - query solo en BWT → oportunidad en Bing (mercado desktop)
 *   - query solo en GSC → optimizar para Google
 */

const { queryAllRows, dateOffset } = require('./gscClient')
const { getQueryStats, getPageStats, normalizeBwtRow } = require('./bwtClient')

// DUAL-SEO: Clasificar prioridad según posición + impresiones combinadas
function classifyPriority(posGoogle, posBing, impGoogle, impBing) {
  const bestPos = Math.min(posGoogle || 100, posBing || 100)
  const totalImp = (impGoogle || 0) + (impBing || 0)

  if (bestPos <= 8 && totalImp > 300) return 'ALTA'
  if (bestPos <= 12 && totalImp > 150) return 'MEDIA'
  if (totalImp > 100) return 'BAJA'
  return null
}

// DUAL-SEO: Generar acción específica según fuente y posiciones
function generateAction(query, fuente, posGoogle, posBing) {
  const bestPos = Math.min(posGoogle || 100, posBing || 100)

  if (fuente === 'solo_bing') {
    return `Keyword exclusiva de Bing: "${query}". Insertar en contenido para capturar tráfico desktop/Copilot.`
  }
  if (fuente === 'solo_google') {
    return `Solo en Google. Insertar "${query}" en H2 o primer párrafo. Considerar optimización para Bing también.`
  }

  // Ambas fuentes — analizar discrepancia
  const diff = Math.abs((posGoogle || 0) - (posBing || 0))
  if (diff > 5) {
    const mejor = (posGoogle || 100) < (posBing || 100) ? 'Google' : 'Bing'
    const peor = mejor === 'Google' ? 'Bing' : 'Google'
    return `Discrepancia de ${diff.toFixed(1)} posiciones. Mejor en ${mejor} (${mejor === 'Google' ? posGoogle : posBing}). Optimizar para ${peor}: revisar title tags y estructura.`
  }

  if (bestPos <= 8) {
    return `Insertar "${query}" en H1/H2 o primer párrafo. Reforzar con internal links.`
  }
  if (bestPos <= 12) {
    return `Añadir sección con H2 que contenga "${query}". Mejorar meta description.`
  }
  return `Crear contenido adicional (FAQ, sección) que responda a "${query}". Link building interno.`
}

async function detectQuickWinsUnificado() {
  console.log('⚡ Analizando Quick Wins Unificados (GSC + BWT)...')

  // DUAL-SEO: Obtener datos de GSC (últimos 90 días)
  console.log('  → Consultando Google Search Console...')
  const gscRows = await queryAllRows({
    startDate: dateOffset(90),
    endDate: dateOffset(3),
    dimensions: ['query', 'page'],
  })

  // DUAL-SEO: Obtener datos de BWT
  console.log('  → Consultando Bing Webmaster Tools...')
  let bwtQueryRows = []
  let bwtPageRows = []
  try {
    const [queryData, pageData] = await Promise.all([
      getQueryStats(),
      getPageStats(),
    ])
    bwtQueryRows = queryData.map(normalizeBwtRow)
    bwtPageRows = pageData.map(normalizeBwtRow)
  } catch (err) {
    // BWT-CRÍTICO ⚠: Si BWT falla, continuar solo con GSC
    console.warn(`  ⚠ BWT no disponible: ${err.message}. Continuando solo con GSC.`)
  }

  // DUAL-SEO: Indexar datos de GSC por query (lowercase)
  const gscMap = new Map()
  for (const row of gscRows) {
    const query = row.keys[0].toLowerCase()
    const page = row.keys[1]
    const key = `${query}|||${page}`

    if (!gscMap.has(key)) {
      gscMap.set(key, {
        query: row.keys[0],
        page,
        position: row.position,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
      })
    }
  }

  // DUAL-SEO: Indexar datos de BWT por query
  // BWT no da page+query juntos, así que creamos un mapa por query
  const bwtQueryMap = new Map()
  for (const row of bwtQueryRows) {
    if (!row.query) continue
    const key = row.query.toLowerCase()
    if (!bwtQueryMap.has(key) || row.impressions > bwtQueryMap.get(key).impressions) {
      bwtQueryMap.set(key, row)
    }
  }

  // DUAL-SEO: FULL OUTER JOIN — fusionar datos de ambas fuentes
  const mergedMap = new Map()

  // Agregar datos de GSC
  for (const [key, gsc] of gscMap) {
    const queryLower = gsc.query.toLowerCase()
    const bwt = bwtQueryMap.get(queryLower)

    mergedMap.set(key, {
      page: gsc.page,
      query: gsc.query,
      posicion_google: Math.round(gsc.position * 10) / 10,
      posicion_bing: bwt ? Math.round(bwt.position * 10) / 10 : null,
      impresiones_google: gsc.impressions,
      impresiones_bing: bwt ? bwt.impressions : 0,
      clics_google: gsc.clicks,
      clics_bing: bwt ? bwt.clicks : 0,
      ctr_google: Math.round(gsc.ctr * 10000) / 10000,
      ctr_bing: bwt ? Math.round(bwt.ctr * 10000) / 10000 : null,
      copilot_impressions: bwt ? bwt.copilotImpressions : 0,
      fuente: bwt ? 'ambas' : 'solo_google',
    })
  }

  // Agregar queries exclusivas de BWT (no presentes en GSC)
  for (const [queryLower, bwt] of bwtQueryMap) {
    // Verificar si ya existe en el merge
    const existsInGsc = [...gscMap.keys()].some(k => k.startsWith(queryLower + '|||'))
    if (existsInGsc) continue

    // BWT-SEO: Query exclusiva de Bing — oportunidad ignorada por competidores
    const bestPage = bwtPageRows.length > 0
      ? bwtPageRows.sort((a, b) => b.impressions - a.impressions)[0]?.page || ''
      : ''

    const key = `${queryLower}|||${bestPage}`
    mergedMap.set(key, {
      page: bestPage,
      query: bwt.query,
      posicion_google: null,
      posicion_bing: Math.round(bwt.position * 10) / 10,
      impresiones_google: 0,
      impresiones_bing: bwt.impressions,
      clics_google: 0,
      clics_bing: bwt.clicks,
      ctr_google: null,
      ctr_bing: Math.round(bwt.ctr * 10000) / 10000,
      copilot_impressions: bwt.copilotImpressions,
      fuente: 'solo_bing',
    })
  }

  // DUAL-SEO: Filtrar Quick Wins y clasificar
  const quickWins = []
  for (const entry of mergedMap.values()) {
    const posGoogle = entry.posicion_google
    const posBing = entry.posicion_bing
    const bestPos = Math.min(posGoogle || 100, posBing || 100)

    // Filtro: posición entre 4 y 15 en al menos un motor
    if (bestPos < 4.0 || bestPos > 15.0) continue
    // Filtro: impresiones mínimas combinadas
    if ((entry.impresiones_google + entry.impresiones_bing) < 100) continue

    const prioridad = classifyPriority(posGoogle, posBing, entry.impresiones_google, entry.impresiones_bing)
    if (!prioridad) continue

    const accion = generateAction(entry.query, entry.fuente, posGoogle, posBing)

    quickWins.push({
      ...entry,
      accion,
      prioridad,
    })
  }

  // DUAL-SEO: Ordenar por prioridad y luego por impresiones totales descendente
  const prioridadOrden = { ALTA: 0, MEDIA: 1, BAJA: 2 }
  quickWins.sort((a, b) => {
    if (prioridadOrden[a.prioridad] !== prioridadOrden[b.prioridad]) {
      return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]
    }
    return (b.impresiones_google + b.impresiones_bing) - (a.impresiones_google + a.impresiones_bing)
  })

  console.log(`  → ${quickWins.length} Quick Wins unificados detectados`)
  return quickWins
}

module.exports = { detectQuickWinsUnificado }
