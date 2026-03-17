/**
 * BWT-SEO: Auditoría Técnica Automática via Bing SEO Scanner
 *
 * EXCLUSIVO BWT: Bing tiene SEO Scanner integrado que GSC no ofrece.
 *
 * Cruza resultados del scanner con datos de indexación de GSC para
 * identificar páginas con errores técnicos en Bing que Google ya indexó.
 *
 * Si una página está indexada en Google pero NO en Bing →
 * marca como BWT-CRÍTICO: Posible bloqueo de Bingbot.
 */

const { queryAllRows, dateOffset } = require('./gscClient')
const { getScanDetails, getPageStats, getUrlInfo, normalizeBwtRow } = require('./bwtClient')

// BWT-SEO: Clasificar severidad del error
function classifySeverity(error, indexadaGoogle, indexadaBing) {
  // Página indexada en Google pero no en Bing = CRÍTICA
  if (indexadaGoogle && !indexadaBing) return 'CRÍTICA'

  // Errores que afectan indexación
  const criticalErrors = [
    'noindex', 'blocked', 'robots.txt', 'canonical',
    'redirect loop', '5xx', 'server error',
  ]
  const errorLower = (error || '').toLowerCase()
  if (criticalErrors.some(e => errorLower.includes(e))) return 'CRÍTICA'

  // Errores de optimización
  const moderateErrors = [
    'meta description', 'title tag', 'heading', 'h1',
    'duplicate', 'slow', 'large', 'image alt',
  ]
  if (moderateErrors.some(e => errorLower.includes(e))) return 'MODERADA'

  return 'BAJA'
}

// BWT-SEO: Generar acción correctiva
function generateAction(error, indexadaGoogle, indexadaBing) {
  const errorLower = (error || '').toLowerCase()

  if (indexadaGoogle && !indexadaBing) {
    return 'Posible bloqueo de Bingbot. Verificar robots.txt, user-agent blocking, y resubmitir via IndexNow.'
  }

  if (errorLower.includes('meta description')) {
    return 'Añadir meta description relevante (150-160 chars) y resubmitir via IndexNow.'
  }
  if (errorLower.includes('title')) {
    return 'Optimizar title tag (50-60 chars, keyword al inicio) y resubmitir.'
  }
  if (errorLower.includes('h1')) {
    return 'Añadir o corregir H1 único y descriptivo en la página.'
  }
  if (errorLower.includes('duplicate')) {
    return 'Resolver contenido duplicado con canonical tags o redirección 301.'
  }
  if (errorLower.includes('slow') || errorLower.includes('large')) {
    return 'Optimizar velocidad: comprimir imágenes, lazy loading, minificar CSS/JS.'
  }
  if (errorLower.includes('image') || errorLower.includes('alt')) {
    return 'Añadir atributos alt descriptivos a las imágenes.'
  }
  if (errorLower.includes('structured') || errorLower.includes('schema')) {
    return 'Corregir errores de structured data (validar en Schema.org validator).'
  }

  return `Corregir: ${error}. Revisar y resubmitir via IndexNow.`
}

async function runAuditoriaTecnica() {
  console.log('🔧 Ejecutando Auditoría Técnica (BWT SEO Scanner)...')

  // BWT-SEO: Obtener resultados del SEO Scanner de Bing
  console.log('  → Consultando BWT SEO Scanner...')
  const scanResults = await getScanDetails()

  // DUAL-SEO: Obtener páginas indexadas en GSC para cruzar datos
  console.log('  → Consultando páginas indexadas en GSC...')
  const gscPages = await queryAllRows({
    startDate: dateOffset(30),
    endDate: dateOffset(3),
    dimensions: ['page'],
  })
  const gscIndexedPages = new Set(gscPages.map(row => row.keys[0]))

  // BWT-SEO: Obtener páginas con tráfico en Bing para determinar indexación
  let bwtIndexedPages = new Set()
  try {
    const bwtPages = await getPageStats()
    const normalized = bwtPages.map(normalizeBwtRow)
    bwtIndexedPages = new Set(normalized.filter(r => r.impressions > 0).map(r => r.page))
  } catch (err) {
    console.warn(`  ⚠ No se pudieron obtener páginas de BWT: ${err.message}`)
  }

  const auditoria = []

  // BWT-SEO: Procesar resultados del SEO Scanner
  if (scanResults.length > 0) {
    for (const result of scanResults) {
      const page = result.Url || result.url || result.Page || ''
      const error = result.Issue || result.Error || result.Description || result.issue || 'Error no especificado'

      if (!page) continue

      const indexadaGoogle = gscIndexedPages.has(page)
      const indexadaBing = bwtIndexedPages.has(page)

      const severidad = classifySeverity(error, indexadaGoogle, indexadaBing)
      const accion = generateAction(error, indexadaGoogle, indexadaBing)

      auditoria.push({
        page,
        error_bing: error,
        indexada_google: indexadaGoogle,
        indexada_bing: indexadaBing,
        accion,
        severidad,
      })
    }
  }

  // DUAL-SEO: Detectar páginas indexadas en Google pero sin tráfico en Bing
  // Esto indica posible bloqueo de Bingbot
  if (bwtIndexedPages.size > 0) {
    for (const page of gscIndexedPages) {
      if (bwtIndexedPages.has(page)) continue

      // Verificar si ya fue reportada por el scanner
      if (auditoria.some(a => a.page === page)) continue

      // BWT-CRÍTICO ⚠: Página indexada en Google pero no en Bing
      auditoria.push({
        page,
        error_bing: 'Página sin impresiones en Bing (indexada en Google)',
        indexada_google: true,
        indexada_bing: false,
        accion: 'Posible bloqueo de Bingbot. Verificar robots.txt y resubmitir via IndexNow.',
        severidad: 'MODERADA',
      })
    }
  }

  // BWT-SEO: Ordenar por severidad
  const severidadOrden = { 'CRÍTICA': 0, 'MODERADA': 1, 'BAJA': 2 }
  auditoria.sort((a, b) => {
    return (severidadOrden[a.severidad] || 3) - (severidadOrden[b.severidad] || 3)
  })

  console.log(`  → ${auditoria.length} issues técnicos detectados`)
  console.log(`  → ${auditoria.filter(a => a.severidad === 'CRÍTICA').length} críticos`)
  return auditoria
}

module.exports = { runAuditoriaTecnica }
