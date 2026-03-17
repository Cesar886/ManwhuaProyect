/**
 * GSC-SEO: Detector de Content Gaps (páginas que faltan)
 *
 * Identifica queries con impresiones significativas que NO tienen
 * una URL dedicada con esa keyword en el slug. Esto revela demanda
 * de búsqueda sin oferta de contenido.
 *
 * Clasifica automáticamente el tipo de página recomendado:
 *   - "lista" → si la query contiene "mejores", "top", "lista", "ranking"
 *   - "obra"  → si parece un nombre de obra específica
 *   - "reseña" → si contiene "reseña", "review", "vale la pena", "opinión"
 */

const { queryAllRows, dateOffset } = require('./gscClient')

// GSC-SEO: Palabras que indican intención de lista/ranking
const LISTA_SIGNALS = ['mejores', 'top', 'lista', 'ranking', 'recomendados', 'parecidos', 'similares']
// GSC-SEO: Palabras que indican intención de reseña
const RESENA_SIGNALS = ['reseña', 'review', 'vale la pena', 'opinión', 'opinion', 'análisis', 'analisis']

function classifyPageType(query) {
  const q = query.toLowerCase()
  if (LISTA_SIGNALS.some(s => q.includes(s))) return 'lista'
  if (RESENA_SIGNALS.some(s => q.includes(s))) return 'reseña'
  return 'obra'
}

// GSC-SEO: Genera un slug a partir de la query para la URL sugerida
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

async function detectContentGaps() {
  console.log('📝 Analizando Content Gaps (queries sin página dedicada)...')

  // GSC-SEO: Obtener todas las queries con impresiones > 0 de los últimos 90 días
  const rows = await queryAllRows({
    startDate: dateOffset(90),
    endDate: dateOffset(3),
    dimensions: ['query', 'page'],
  })

  // GSC-SEO: Agrupar impresiones por query y recopilar las URLs donde aparece
  const queryMap = new Map()

  for (const row of rows) {
    const query = row.keys[0]
    const page = row.keys[1]

    if (!queryMap.has(query)) {
      queryMap.set(query, {
        totalImpressions: 0,
        totalClicks: 0,
        positions: [],
        pages: new Set(),
      })
    }

    const entry = queryMap.get(query)
    entry.totalImpressions += row.impressions
    entry.totalClicks += row.clicks
    entry.positions.push(row.position)
    entry.pages.add(page)
  }

  const contentGaps = []

  for (const [query, data] of queryMap) {
    // GSC-SEO: Filtro mínimo de impresiones para que sea relevante
    if (data.totalImpressions < 50) continue

    // GSC-SEO: Verificar si alguna URL contiene la keyword en el slug
    const querySlug = queryToSlug(query)
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)

    // Una URL "dedicada" tiene al menos el 60% de las palabras clave en su path
    const hasDedicatedPage = [...data.pages].some(pageUrl => {
      const pagePath = new URL(pageUrl).pathname.toLowerCase()
      const matchingWords = queryWords.filter(w => pagePath.includes(w))
      return matchingWords.length >= Math.ceil(queryWords.length * 0.6)
    })

    if (hasDedicatedPage) continue

    // GSC-SEO: Calcular posición promedio
    const avgPosition = data.positions.reduce((a, b) => a + b, 0) / data.positions.length

    // GSC-SEO: Clasificar tipo de página y generar URL sugerida
    const tipoPagina = classifyPageType(query)
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

    contentGaps.push({
      query,
      impresiones: data.totalImpressions,
      clics: data.totalClicks,
      posicion_promedio: Math.round(avgPosition * 10) / 10,
      accion: `Crear página en ${rutaSugerida}`,
      tipo_pagina: tipoPagina,
      urls_actuales: [...data.pages].slice(0, 3),
    })
  }

  // GSC-SEO: Ordenar por impresiones descendente (mayor demanda primero)
  contentGaps.sort((a, b) => b.impresiones - a.impresiones)

  console.log(`  → ${contentGaps.length} Content Gaps detectados`)
  return contentGaps
}

module.exports = { detectContentGaps }
