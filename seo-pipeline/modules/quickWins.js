/**
 * GSC-SEO: Detector de Quick Wins
 *
 * Identifica páginas en posiciones 4-15 con impresiones significativas.
 * Estas son las victorias rápidas: pequeños ajustes de contenido pueden
 * mover estas páginas al top 3, donde el CTR se dispara.
 *
 * Lógica:
 *   - Posición 4-8 + impresiones > 300 → ALTA prioridad
 *   - Posición 8-12 + impresiones > 150 → MEDIA prioridad
 *   - Posición 12-15 + impresiones > 100 → BAJA prioridad
 */

const { queryAllRows, dateOffset } = require('./gscClient')

async function detectQuickWins() {
  console.log('⚡ Analizando Quick Wins (posiciones 4-15)...')

  // GSC-SEO: Consultar últimos 90 días, dimensiones query+page
  const rows = await queryAllRows({
    startDate: dateOffset(90),
    endDate: dateOffset(3), // GSC tiene ~3 días de delay en datos
    dimensions: ['query', 'page'],
  })

  const quickWins = []

  for (const row of rows) {
    const query = row.keys[0]
    const page = row.keys[1]
    const position = row.position
    const impressions = row.impressions
    const ctr = row.ctr
    const clicks = row.clicks

    // GSC-SEO: Filtro de posición entre 4 y 15 (zona de Quick Wins)
    if (position < 4.0 || position > 15.0) continue
    // GSC-SEO: Filtro de impresiones mínimas (ignora keywords irrelevantes)
    if (impressions < 100) continue

    // GSC-SEO: Clasificar prioridad según posición + impresiones
    let prioridad = null
    if (position <= 8 && impressions > 300) {
      prioridad = 'ALTA'
    } else if (position <= 12 && impressions > 150) {
      prioridad = 'MEDIA'
    } else if (impressions > 100) {
      prioridad = 'BAJA'
    }

    if (!prioridad) continue

    // GSC-SEO: Generar acción específica según posición
    let accion
    if (position <= 8) {
      accion = `Insertar "${query}" en el H1/H2 o primer párrafo de la página. Reforzar con internal links.`
    } else if (position <= 12) {
      accion = `Añadir sección con H2 que contenga "${query}". Mejorar meta description con esta keyword.`
    } else {
      accion = `Crear contenido adicional (FAQ, sección) que responda a "${query}". Considerar link building interno.`
    }

    quickWins.push({
      page,
      query,
      posicion: Math.round(position * 10) / 10,
      impresiones: impressions,
      clics: clicks,
      ctr_actual: Math.round(ctr * 10000) / 10000,
      accion,
      prioridad,
    })
  }

  // GSC-SEO: Ordenar por prioridad (ALTA → MEDIA → BAJA) y luego por impresiones descendente
  const prioridadOrden = { ALTA: 0, MEDIA: 1, BAJA: 2 }
  quickWins.sort((a, b) => {
    if (prioridadOrden[a.prioridad] !== prioridadOrden[b.prioridad]) {
      return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]
    }
    return b.impresiones - a.impresiones
  })

  console.log(`  → ${quickWins.length} Quick Wins detectados`)
  return quickWins
}

module.exports = { detectQuickWins }
