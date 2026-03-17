/**
 * GSC-SEO: Análisis de CTR por Tipo de Página
 *
 * Agrupa URLs por patrón de slug y calcula CTR promedio por tipo.
 * Identifica qué tipo de contenido genera mejor rendimiento orgánico,
 * lo que guía la estrategia de creación de contenido.
 *
 * Tipos detectados:
 *   - "obra individual" (manhwa slug)
 *   - "capítulo" (manhwa slug + capitulo)
 *   - "listado" (blog, populares)
 *   - "taxonomía" (genero)
 *   - "biblioteca"
 *   - "home"
 *   - "legal" (terminos, politica, dmca, aviso)
 *   - "otro" (cualquier otra ruta)
 */

const { queryAllRows, dateOffset } = require('./gscClient')

// GSC-SEO: Clasificar URL por tipo de contenido según patrón de slug
function classifyUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase()

    // Orden importa: patrones más específicos primero
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

async function analyzeCTR() {
  console.log('📊 Analizando CTR por tipo de página...')

  // GSC-SEO: Últimos 90 días por URL
  const rows = await queryAllRows({
    startDate: dateOffset(90),
    endDate: dateOffset(3),
    dimensions: ['page'],
  })

  // GSC-SEO: Agrupar métricas por tipo de contenido
  const tipoMap = new Map()

  for (const row of rows) {
    const page = row.keys[0]
    const tipo = classifyUrl(page)

    if (!tipoMap.has(tipo)) {
      tipoMap.set(tipo, {
        totalClicks: 0,
        totalImpressions: 0,
        pages: new Set(),
        positions: [],
      })
    }

    const entry = tipoMap.get(tipo)
    entry.totalClicks += row.clicks
    entry.totalImpressions += row.impressions
    entry.positions.push(row.position)
    entry.pages.add(page)
  }

  // GSC-SEO: Calcular métricas agregadas por tipo
  const resultados = []

  for (const [tipo, data] of tipoMap) {
    const ctrPromedio = data.totalImpressions > 0
      ? data.totalClicks / data.totalImpressions
      : 0
    const posicionPromedio = data.positions.length > 0
      ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
      : 0

    resultados.push({
      tipo,
      ctr_promedio: Math.round(ctrPromedio * 10000) / 10000,
      clics_totales: data.totalClicks,
      impresiones_totales: data.totalImpressions,
      posicion_promedio: Math.round(posicionPromedio * 10) / 10,
      paginas_analizadas: data.pages.size,
      recomendacion: '', // Se llena abajo
    })
  }

  // GSC-SEO: Ordenar por CTR descendente
  resultados.sort((a, b) => b.ctr_promedio - a.ctr_promedio)

  // GSC-SEO: Generar recomendaciones basadas en comparación de tipos
  const listadoCTR = resultados.find(r => r.tipo === 'listado')?.ctr_promedio || 0
  const obraCTR = resultados.find(r => r.tipo === 'obra individual')?.ctr_promedio || 0
  const capituloCTR = resultados.find(r => r.tipo === 'capítulo')?.ctr_promedio || 0
  const taxonomiaCTR = resultados.find(r => r.tipo === 'taxonomía')?.ctr_promedio || 0

  for (const r of resultados) {
    switch (r.tipo) {
      case 'listado':
        if (listadoCTR > obraCTR) {
          r.recomendacion = 'CTR de listados supera al de obras individuales. Priorizar creación de páginas tipo "Top X", "Mejores manhwas de [género]".'
        } else {
          r.recomendacion = 'CTR aceptable. Mejorar titles con números y año (ej: "Top 15 Manhwas de Acción 2026").'
        }
        break
      case 'obra individual':
        if (obraCTR < 0.03) {
          r.recomendacion = 'CTR bajo para obras. Optimizar meta titles con verbos ("Lee", "Descubre") y estado ("Completo", "Cap. 150+").'
        } else {
          r.recomendacion = 'CTR saludable. Mantener optimización actual y reforzar con rich snippets (FAQ, rating).'
        }
        break
      case 'capítulo':
        r.recomendacion = capituloCTR < 0.02
          ? 'CTR bajo en capítulos (esperado). Mejorar title con "[Título] Cap N - Leer Gratis en Español".'
          : 'CTR de capítulos dentro de rango normal para contenido de lectura.'
        break
      case 'taxonomía':
        r.recomendacion = taxonomiaCTR < 0.03
          ? 'Género pages con CTR bajo. Añadir conteo de obras y actualización reciente en meta description.'
          : 'Buen CTR para taxonomías. Considerar expandir con más géneros de nicho.'
        break
      case 'home':
        r.recomendacion = 'Revisar que el sitelinks search box aparezca correctamente en Google.'
        break
      default:
        r.recomendacion = 'Monitorear tendencia.'
    }
  }

  console.log(`  → ${resultados.length} tipos de página analizados`)
  return resultados
}

module.exports = { analyzeCTR }
