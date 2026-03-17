/**
 * AUTO-EXEC: Motor de Ejecución Autónoma — Capa 3 del Agente SEO
 *
 * Decide si publicar directamente o guardar como draft basándose en
 * el confidence_score de la IA.
 *
 * Funcionalidades:
 *   - Publicar contenido en CMS vía API
 *   - Guardar drafts en disco cuando confidence < umbral
 *   - Log maestro de todas las acciones
 *   - Notificación de drafts pendientes
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')

const LOGS_DIR = path.resolve(__dirname, '..', 'logs')
const DRAFTS_DIR = path.resolve(__dirname, '..', 'drafts')
const LOG_MAESTRO_PATH = path.join(LOGS_DIR, 'log_maestro.json')
const LOG_OPTIMIZACIONES_PATH = path.join(LOGS_DIR, 'log_optimizaciones.json')
const LOG_PAGINAS_PATH = path.join(LOGS_DIR, 'log_paginas_creadas.json')
const DRAFTS_TITLES_PATH = path.join(DRAFTS_DIR, 'drafts_titles.json')
const DRAFTS_PAGINAS_PATH = path.join(DRAFTS_DIR, 'drafts_paginas.json')

// AUTO-EXEC: Asegurar que directorios existen
function ensureDirs() {
  for (const dir of [LOGS_DIR, DRAFTS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

// AUTO-EXEC: Leer archivo JSON de forma segura
function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch { /* archivo corrupto o vacío */ }
  return []
}

// AUTO-EXEC: Escribir archivo JSON con escritura atómica
function writeJsonAtomic(filePath, data) {
  ensureDirs()
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

// AUTO-EXEC: Anadir entrada al log maestro
// v2: Soporta logAction('name', data) y logAction(entry)
function logAction(nameOrEntry, data) {
  ensureDirs()
  const log = readJsonSafe(LOG_MAESTRO_PATH)
  let entry
  if (typeof nameOrEntry === 'string') {
    entry = { accion: nameOrEntry, ...(data || {}) }
  } else {
    entry = nameOrEntry
  }
  log.push({
    timestamp: new Date().toISOString(),
    ...entry,
  })
  // Mantener solo últimos 500 registros
  if (log.length > 500) log.splice(0, log.length - 500)
  writeJsonAtomic(LOG_MAESTRO_PATH, log)
}

/**
 * AUTO-EXEC: Actualizar title y meta description en el CMS
 *
 * @param {string} url - URL de la página
 * @param {string} slug - Slug de la serie
 * @param {Object} data - { title, meta_description }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateTitleInCMS(url, slug, data) {
  if (!AGENT.CMS_API_KEY) {
    return { success: false, error: 'CMS_API_KEY no configurada' }
  }

  try {
    // AUTO-EXEC: Actualizar serie vía API del CMS
    const response = await axios.patch(
      `${AGENT.CMS_API_BASE}/series/${slug}`,
      {
        meta_title: data.title,
        meta_description: data.meta_description,
      },
      {
        headers: {
          'x-api-key': AGENT.CMS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    )

    return { success: response.status >= 200 && response.status < 300 }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * AUTO-EXEC: Publicar nueva página en el CMS
 *
 * @param {Object} pageData - Datos de la página generada por IA
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function publishPageInCMS(pageData) {
  if (!AGENT.CMS_API_KEY) {
    return { success: false, error: 'CMS_API_KEY no configurada' }
  }

  try {
    // AUTO-EXEC: Determinar endpoint según tipo de contenido
    const endpoint = pageData.slug?.startsWith('/blog')
      ? `${AGENT.CMS_API_BASE}/blog`
      : `${AGENT.CMS_API_BASE}/pages`

    const response = await axios.post(endpoint, {
      slug: pageData.slug,
      title: pageData.meta_title,
      meta_title: pageData.meta_title,
      meta_description: pageData.meta_description,
      h1: pageData.h1,
      content: pageData.contenido_html,
      schema_jsonld: pageData.schema_jsonld,
      status: 'published',
      source: 'seo-agent-autonomous',
    }, {
      headers: {
        'x-api-key': AGENT.CMS_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    const publishedUrl = `${AGENT.SITE_URL}${pageData.slug}`
    return { success: response.status >= 200 && response.status < 300, url: publishedUrl }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * AUTO-EXEC: Ejecutar optimización de title/meta con lógica de confianza
 *
 * Si confidence_score >= umbral → actualizar en CMS + log
 * Si confidence_score < umbral → guardar en drafts + notificar
 *
 * @param {Object} params
 * @param {string} params.url - URL de la página
 * @param {string} params.slug - Slug para CMS API
 * @param {string} params.query - Query original
 * @param {Object} params.aiResult - Resultado de la IA { title, meta_description, razon, confidence_score }
 * @param {number} params.tokensUsed - Tokens consumidos
 * @param {number} params.costUsd - Costo en USD
 * @returns {Promise<{action: string, success: boolean}>}
 */
async function executeTitleOptimization({ url, slug, query, aiResult, tokensUsed, costUsd }) {
  const { confidence_score } = aiResult

  if (confidence_score >= AGENT.CONFIDENCE_THRESHOLD) {
    // AUTO-EXEC: Publicar directamente
    console.log(`    ✅ Score ${confidence_score} ≥ ${AGENT.CONFIDENCE_THRESHOLD} → Publicando title para ${slug}`)
    const cmsResult = await updateTitleInCMS(url, slug, aiResult)

    const logEntry = {
      modulo: 'quickWinsOptimizer',
      accion: cmsResult.success ? 'title_actualizado' : 'title_fallo_cms',
      url_afectada: url,
      query,
      confidence_score,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
      resultado: cmsResult.success ? 'exitoso' : 'fallido',
      razon_ia: aiResult.razon,
      nuevo_title: aiResult.title,
      nueva_meta: aiResult.meta_description,
      error_cms: cmsResult.error || null,
    }
    logAction(logEntry)

    // AUTO-EXEC: Registrar en log de optimizaciones
    const optLog = readJsonSafe(LOG_OPTIMIZACIONES_PATH)
    optLog.push({ ...logEntry, timestamp: new Date().toISOString() })
    writeJsonAtomic(LOG_OPTIMIZACIONES_PATH, optLog)

    return { action: 'published', success: cmsResult.success }
  } else {
    // DRAFT: Score bajo → guardar como draft
    console.log(`    📝 Score ${confidence_score} < ${AGENT.CONFIDENCE_THRESHOLD} → Guardando como draft`)
    const drafts = readJsonSafe(DRAFTS_TITLES_PATH)
    drafts.push({
      timestamp: new Date().toISOString(),
      url,
      slug,
      query,
      ...aiResult,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
    })
    writeJsonAtomic(DRAFTS_TITLES_PATH, drafts)

    logAction({
      modulo: 'quickWinsOptimizer',
      accion: 'draft_creado',
      url_afectada: url,
      query,
      confidence_score,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
      resultado: 'draft',
      razon_ia: `Score ${confidence_score} < umbral ${AGENT.CONFIDENCE_THRESHOLD}. ${aiResult.razon}`,
    })

    return { action: 'draft', success: true }
  }
}

/**
 * AUTO-EXEC: Ejecutar publicación de nueva página con lógica de confianza
 *
 * @param {Object} params
 * @param {string} params.query - Query original
 * @param {string} params.tipoPagina - Tipo: lista | obra | reseña
 * @param {Object} params.aiResult - Contenido generado por IA
 * @param {number} params.tokensUsed - Tokens consumidos
 * @param {number} params.costUsd - Costo en USD
 * @returns {Promise<{action: string, success: boolean, url?: string}>}
 */
async function executePageCreation({ query, tipoPagina, aiResult, tokensUsed, costUsd }) {
  const { confidence_score } = aiResult

  if (confidence_score >= AGENT.CONFIDENCE_THRESHOLD) {
    // AUTO-EXEC: Publicar directamente en CMS
    console.log(`    ✅ Score ${confidence_score} ≥ ${AGENT.CONFIDENCE_THRESHOLD} → Publicando página: ${aiResult.slug}`)
    const cmsResult = await publishPageInCMS(aiResult)

    const logEntry = {
      modulo: 'contentGapsGenerator',
      accion: cmsResult.success ? 'pagina_publicada' : 'pagina_fallo_cms',
      url_afectada: cmsResult.url || aiResult.slug,
      query,
      tipo_pagina: tipoPagina,
      confidence_score,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
      resultado: cmsResult.success ? 'exitoso' : 'fallido',
      razon_ia: aiResult.razon,
      error_cms: cmsResult.error || null,
    }
    logAction(logEntry)

    // AUTO-EXEC: Registrar en log de páginas creadas
    const pageLog = readJsonSafe(LOG_PAGINAS_PATH)
    pageLog.push({ ...logEntry, timestamp: new Date().toISOString() })
    writeJsonAtomic(LOG_PAGINAS_PATH, pageLog)

    return { action: 'published', success: cmsResult.success, url: cmsResult.url }
  } else {
    // DRAFT: Score bajo → guardar como draft
    console.log(`    📝 Score ${confidence_score} < ${AGENT.CONFIDENCE_THRESHOLD} → Guardando página como draft`)
    const drafts = readJsonSafe(DRAFTS_PAGINAS_PATH)
    drafts.push({
      timestamp: new Date().toISOString(),
      query,
      tipo_pagina: tipoPagina,
      ...aiResult,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
    })
    writeJsonAtomic(DRAFTS_PAGINAS_PATH, drafts)

    logAction({
      modulo: 'contentGapsGenerator',
      accion: 'draft_creado',
      url_afectada: aiResult.slug,
      query,
      tipo_pagina: tipoPagina,
      confidence_score,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
      resultado: 'draft',
      razon_ia: `Score ${confidence_score} < umbral ${AGENT.CONFIDENCE_THRESHOLD}. ${aiResult.razon}`,
    })

    return { action: 'draft', success: true }
  }
}

/**
 * AUTO-EXEC: Ejecutar optimización de schema
 */
async function executeSchemaOptimization({ url, slug, aiResult, tokensUsed, costUsd }) {
  const { confidence_score } = aiResult

  if (confidence_score >= AGENT.CONFIDENCE_THRESHOLD) {
    console.log(`    ✅ Score ${confidence_score} ≥ ${AGENT.CONFIDENCE_THRESHOLD} → Actualizando schema: ${url}`)
    // AUTO-EXEC: Actualizar schema en CMS
    let cmsSuccess = false
    if (AGENT.CMS_API_KEY) {
      try {
        const response = await axios.patch(
          `${AGENT.CMS_API_BASE}/series/${slug}`,
          { schema_jsonld: aiResult.schema_jsonld },
          {
            headers: {
              'x-api-key': AGENT.CMS_API_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        )
        cmsSuccess = response.status >= 200 && response.status < 300
      } catch { cmsSuccess = false }
    }

    logAction({
      modulo: 'schemaOptimizer',
      accion: cmsSuccess ? 'schema_actualizado' : 'schema_fallo_cms',
      url_afectada: url,
      confidence_score,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
      resultado: cmsSuccess ? 'exitoso' : 'fallido',
      razon_ia: aiResult.razon,
    })

    return { action: 'published', success: cmsSuccess }
  } else {
    console.log(`    📝 Score ${confidence_score} < ${AGENT.CONFIDENCE_THRESHOLD} → Schema guardado como draft`)
    logAction({
      modulo: 'schemaOptimizer',
      accion: 'draft_creado',
      url_afectada: url,
      confidence_score,
      tokens_ia_usados: tokensUsed,
      costo_estimado_usd: costUsd,
      resultado: 'draft',
      razon_ia: aiResult.razon,
    })

    return { action: 'draft', success: true }
  }
}

/**
 * AUTO-EXEC: Obtener resumen de acciones pendientes (drafts)
 */
function getDraftsSummary() {
  const titleDrafts = readJsonSafe(DRAFTS_TITLES_PATH)
  const pageDrafts = readJsonSafe(DRAFTS_PAGINAS_PATH)

  return {
    titles_pendientes: titleDrafts.length,
    paginas_pendientes: pageDrafts.length,
    titles: titleDrafts.slice(-5),
    paginas: pageDrafts.slice(-3),
  }
}

/**
 * AUTO-EXEC: Obtener resumen de acciones ejecutadas (del log maestro)
 */
function getActionsSummary() {
  const log = readJsonSafe(LOG_MAESTRO_PATH)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thisWeek = log.filter(e => e.timestamp >= oneWeekAgo)

  return {
    total_acciones_semana: thisWeek.length,
    publicadas: thisWeek.filter(e => e.accion?.includes('actualizado') || e.accion?.includes('publicada')).length,
    drafts: thisWeek.filter(e => e.accion === 'draft_creado').length,
    fallidas: thisWeek.filter(e => e.resultado === 'fallido').length,
    tokens_totales: thisWeek.reduce((sum, e) => sum + (e.tokens_ia_usados || 0), 0),
    costo_total_usd: thisWeek.reduce((sum, e) => sum + (e.costo_estimado_usd || 0), 0),
    detalle: thisWeek.slice(-10),
  }
}

module.exports = {
  executeTitleOptimization,
  executePageCreation,
  executeSchemaOptimization,
  getDraftsSummary,
  getActionsSummary,
  logAction,
  readJsonSafe,
  writeJsonAtomic,
  LOG_MAESTRO_PATH,
  LOGS_DIR,
  DRAFTS_DIR,
}
