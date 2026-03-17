/**
 * GSC-SEO: Detector de AI Overview Cannibalization
 *
 * Identifica páginas que rankean en top 4 pero tienen CTR anormalmente bajo (<1.5%).
 * Esto es una señal fuerte de que Google muestra el contenido en AI Overviews
 * (antes "SGE") sin generar clics directos al sitio.
 *
 * Acciones recomendadas:
 *   - Optimizar title tag con CTA que incentive el clic directo
 *   - Añadir contenido unique que la IA no pueda resumir fácilmente
 *   - Considerar contenido interactivo (herramientas, quizzes) que requiera visitar el sitio
 */

const { queryAllRows, dateOffset } = require('./gscClient')

async function detectAIOverview() {
  console.log('🤖 Detectando posible canibalización por AI Overview...')

  // GSC-SEO: Últimos 30 días para datos más recientes (AI Overview es tendencia nueva)
  const rows = await queryAllRows({
    startDate: dateOffset(33),
    endDate: dateOffset(3),
    dimensions: ['query', 'page'],
  })

  const sospechosos = []

  for (const row of rows) {
    const query = row.keys[0]
    const page = row.keys[1]
    const position = row.position
    const ctr = row.ctr
    const impressions = row.impressions

    // GSC-SEO: Señal de AI Overview: posición < 4 pero CTR < 1.5%
    if (position >= 4.0) continue
    if (ctr >= 0.015) continue
    // GSC-SEO: Mínimo de impresiones para que sea estadísticamente relevante
    if (impressions < 50) continue

    // GSC-SEO: Calcular CTR esperado por posición (benchmark promedio)
    let ctrEsperado
    if (position <= 1.5) ctrEsperado = 0.28  // Pos 1: ~28% CTR
    else if (position <= 2.5) ctrEsperado = 0.15  // Pos 2: ~15%
    else ctrEsperado = 0.08  // Pos 3: ~8%

    const ctrDeficit = Math.round((ctrEsperado - ctr) * 10000) / 100 // en puntos porcentuales

    // GSC-SEO: Generar acción específica
    let accion
    if (ctr < 0.005) {
      accion = `CTR casi nulo (${(ctr * 100).toFixed(2)}%). Muy probable AI Overview. ` +
        `Optimizar title con CTA directo ("Lee ahora", "Con imágenes HD") y añadir contenido interactivo que no pueda resumirse.`
    } else {
      accion = `CTR inferior al esperado (${(ctr * 100).toFixed(2)}% vs ${(ctrEsperado * 100).toFixed(0)}% esperado). ` +
        `Posible AI Overview. Mejorar meta description con propuesta de valor única y datos exclusivos.`
    }

    sospechosos.push({
      page,
      query,
      posicion: Math.round(position * 10) / 10,
      ctr: Math.round(ctr * 10000) / 10000,
      ctr_esperado: ctrEsperado,
      deficit_puntos: ctrDeficit,
      impresiones: impressions,
      clics: row.clicks,
      accion,
    })
  }

  // GSC-SEO: Ordenar por mayor déficit de CTR (los más canibalizados primero)
  sospechosos.sort((a, b) => b.deficit_puntos - a.deficit_puntos)

  console.log(`  → ${sospechosos.length} posibles canibalizaciones por AI Overview detectadas`)
  return sospechosos
}

module.exports = { detectAIOverview }
