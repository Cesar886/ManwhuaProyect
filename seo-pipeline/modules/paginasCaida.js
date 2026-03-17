/**
 * GSC-SEO: Monitor de Páginas en Caída
 *
 * Compara rendimiento de los últimos 7 días vs los 7 días anteriores por URL.
 * Detecta caídas significativas en clics o impresiones que requieren atención.
 *
 * Niveles de alerta:
 *   - CRÍTICO: caída de clics > 40%
 *   - MODERADO: caída de clics entre 20-40%
 *
 * También alerta si impresiones caen > 30% (posible deindexación o cambio algorítmico).
 */

const { queryAllRows, dateOffset } = require('./gscClient')

async function detectPaginasCaida() {
  console.log('📉 Analizando páginas en caída (7d vs 7d anterior)...')

  // GSC-SEO: Periodo reciente (últimos 7 días, con 3 días de delay de GSC)
  const recentRows = await queryAllRows({
    startDate: dateOffset(10), // 3 días delay + 7 días
    endDate: dateOffset(3),
    dimensions: ['page'],
  })

  // GSC-SEO: Periodo anterior (los 7 días antes del periodo reciente)
  const previousRows = await queryAllRows({
    startDate: dateOffset(17),
    endDate: dateOffset(10),
    dimensions: ['page'],
  })

  // GSC-SEO: Indexar datos por URL
  const recentMap = new Map()
  for (const row of recentRows) {
    recentMap.set(row.keys[0], {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    })
  }

  const previousMap = new Map()
  for (const row of previousRows) {
    previousMap.set(row.keys[0], {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    })
  }

  const paginasCaida = []

  // GSC-SEO: Comparar cada URL que existía en el periodo anterior
  for (const [page, prev] of previousMap) {
    const recent = recentMap.get(page)

    // Si la página desapareció completamente, es una caída del 100%
    const clicsAhora = recent?.clicks ?? 0
    const impresionesAhora = recent?.impressions ?? 0

    // GSC-SEO: Ignorar páginas con muy pocos datos (ruido estadístico)
    if (prev.clicks < 5 && prev.impressions < 30) continue

    // Calcular porcentajes de caída
    const caidaClics = prev.clicks > 0
      ? Math.round(((prev.clicks - clicsAhora) / prev.clicks) * 100)
      : 0
    const caidaImpresiones = prev.impressions > 0
      ? Math.round(((prev.impressions - impresionesAhora) / prev.impressions) * 100)
      : 0

    // GSC-SEO: Filtrar solo caídas significativas
    const clicksDrop = caidaClics > 20
    const impressionsDrop = caidaImpresiones > 30

    if (!clicksDrop && !impressionsDrop) continue

    // GSC-SEO: Determinar nivel de alerta
    let nivelAlerta
    if (caidaClics > 40) {
      nivelAlerta = 'CRÍTICO'
    } else {
      nivelAlerta = 'MODERADO'
    }

    // GSC-SEO: Generar acción específica según tipo de caída
    let accion
    if (caidaImpresiones > 50) {
      accion = 'Posible deindexación o penalización. Verificar en GSC > Cobertura y en URL Inspection.'
    } else if (caidaImpresiones > 30 && caidaClics > 20) {
      accion = 'Revisar cambio de algoritmo reciente. Refrescar contenido y mejorar title tag para CTR.'
    } else if (caidaClics > 40) {
      accion = 'CTR en picada. Optimizar meta title y description con verbos de acción y CTA implícito.'
    } else {
      accion = 'Caída moderada. Refrescar contenido, añadir datos recientes y mejorar internal linking.'
    }

    paginasCaida.push({
      page,
      clics_antes: prev.clicks,
      clics_ahora: clicsAhora,
      caida_clics_porcentaje: caidaClics,
      impresiones_antes: prev.impressions,
      impresiones_ahora: impresionesAhora,
      caida_impresiones_porcentaje: caidaImpresiones,
      posicion_antes: Math.round(prev.position * 10) / 10,
      posicion_ahora: recent ? Math.round(recent.position * 10) / 10 : null,
      accion,
      nivel_alerta: nivelAlerta,
    })
  }

  // GSC-SEO: Ordenar por severidad (CRÍTICO primero) y luego por mayor caída de clics
  paginasCaida.sort((a, b) => {
    if (a.nivel_alerta !== b.nivel_alerta) {
      return a.nivel_alerta === 'CRÍTICO' ? -1 : 1
    }
    return b.caida_clics_porcentaje - a.caida_clics_porcentaje
  })

  console.log(`  → ${paginasCaida.length} páginas en caída detectadas`)
  return paginasCaida
}

module.exports = { detectPaginasCaida }
