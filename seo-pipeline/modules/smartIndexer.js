/**
 * DUAL-SEO: IndexNow Inteligente + GSC Indexing API
 *
 * VENTAJA: IndexNow de Bing indexa en minutos vs horas/días de Google.
 * Usarlo como sistema de priorización.
 *
 * Lógica de envío inteligente:
 *   - Página nueva → enviar a AMBAS APIs simultáneamente
 *   - Caída de tráfico → resubmitir a ambas
 *   - Actualización de contenido → IndexNow primero (más rápido), luego GSC
 *   - NUNCA enviar la misma URL dos veces en menos de 24h
 *
 * Cola de prioridad con rate limiting automático.
 * Log de cada envío con timestamp y respuesta de ambas APIs.
 * Reintento automático si alguna API falla (max 3 reintentos).
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { GoogleAuth } = require('google-auth-library')
const { INDEX_NOW, GSC } = require('../config/apis')
const { submitUrl: bwtSubmitUrl, submitUrlBatch: bwtSubmitBatch } = require('./bwtClient')

const INDEXING_LOG_PATH = path.resolve(process.env.REPORTS_DIR || './reports', 'indexing_log.json')
const MAX_RETRIES = 3
const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 horas

// DUAL-SEO: Leer log de envíos previos para evitar duplicados
function readIndexingLog() {
  try {
    if (fs.existsSync(INDEXING_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(INDEXING_LOG_PATH, 'utf-8'))
    }
  } catch { /* log corrupto, empezar nuevo */ }
  return { entries: [] }
}

// DUAL-SEO: Guardar log de envíos
function saveIndexingLog(log) {
  const dir = path.dirname(INDEXING_LOG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(INDEXING_LOG_PATH, JSON.stringify(log, null, 2), 'utf-8')
}

// DUAL-SEO: Verificar si una URL fue enviada recientemente (< 24h)
function wasRecentlySubmitted(log, url, api) {
  const now = Date.now()
  return log.entries.some(entry =>
    entry.url === url &&
    entry.api === api &&
    entry.success &&
    (now - new Date(entry.timestamp).getTime()) < COOLDOWN_MS
  )
}

// DUAL-SEO: Registrar envío en el log
function logSubmission(log, url, api, success, response) {
  log.entries.push({
    url,
    api,
    success,
    response: typeof response === 'string' ? response : JSON.stringify(response),
    timestamp: new Date().toISOString(),
  })
  // Mantener solo últimos 30 días de log
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  log.entries = log.entries.filter(e => new Date(e.timestamp).getTime() > thirtyDaysAgo)
}

/**
 * DUAL-SEO: Enviar URL a IndexNow (Bing, Yandex, etc.)
 * VENTAJA: Indexación en minutos
 */
async function sendToIndexNow(url, retries = 0) {
  if (!INDEX_NOW.KEY) {
    return { success: false, error: 'INDEXNOW_KEY no configurada' }
  }

  try {
    const payload = {
      host: new URL(url).hostname,
      key: INDEX_NOW.KEY,
      urlList: [url],
    }
    if (INDEX_NOW.KEY_LOCATION) {
      payload.keyLocation = INDEX_NOW.KEY_LOCATION
    }

    const response = await axios.post(INDEX_NOW.ENDPOINT, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    })

    return { success: true, status: response.status }
  } catch (err) {
    if (retries < MAX_RETRIES) {
      // Espera exponencial: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)))
      return sendToIndexNow(url, retries + 1)
    }
    return { success: false, error: err.message }
  }
}

/**
 * GSC-SEO: Enviar URL a Google Indexing API
 */
async function sendToGoogleIndexing(url, type = 'URL_UPDATED', retries = 0) {
  try {
    const auth = new GoogleAuth({
      keyFile: GSC.CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    })
    const client = await auth.getClient()
    const token = await client.getAccessToken()

    const response = await axios.post(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      { url, type },
      {
        headers: {
          Authorization: `Bearer ${token.token || token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    )

    return { success: true, status: response.status }
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)))
      return sendToGoogleIndexing(url, type, retries + 1)
    }
    return { success: false, error: err.message }
  }
}

/**
 * BWT-SEO: Enviar URL a Bing Submit URL API
 */
async function sendToBwtSubmit(url) {
  try {
    const result = await bwtSubmitUrl(url)
    return { success: result, status: result ? 200 : 500 }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * DUAL-SEO: Enviar URL a TODAS las APIs disponibles
 *
 * @param {string} url - URL a indexar
 * @param {string} reason - Razón del envío (new_page, traffic_drop, content_update)
 * @param {Object} [options] - Opciones
 * @param {boolean} [options.force=false] - Forzar envío aunque se haya enviado recientemente
 * @returns {Promise<Object>} Resultado del envío a cada API
 */
async function smartIndex(url, reason = 'content_update', options = {}) {
  const log = readIndexingLog()
  const results = {
    url,
    reason,
    timestamp: new Date().toISOString(),
    apis: {},
  }

  // DUAL-SEO: Determinar qué APIs usar según la razón
  const apisToUse = []

  if (reason === 'new_page') {
    // Página nueva → enviar a TODAS simultáneamente
    apisToUse.push('indexnow', 'google_indexing', 'bwt_submit')
  } else if (reason === 'traffic_drop') {
    // Caída de tráfico → resubmitir a ambas
    apisToUse.push('indexnow', 'google_indexing')
  } else {
    // Actualización → IndexNow primero (más rápido), luego GSC
    apisToUse.push('indexnow', 'google_indexing')
  }

  // DUAL-SEO: Enviar a cada API respetando cooldown de 24h
  const promises = []

  for (const api of apisToUse) {
    if (!options.force && wasRecentlySubmitted(log, url, api)) {
      results.apis[api] = { skipped: true, reason: 'Enviada en últimas 24h' }
      continue
    }

    let promise
    switch (api) {
      case 'indexnow':
        promise = sendToIndexNow(url).then(r => {
          results.apis.indexnow = r
          logSubmission(log, url, 'indexnow', r.success, r)
        })
        break
      case 'google_indexing':
        promise = sendToGoogleIndexing(url).then(r => {
          results.apis.google_indexing = r
          logSubmission(log, url, 'google_indexing', r.success, r)
        })
        break
      case 'bwt_submit':
        promise = sendToBwtSubmit(url).then(r => {
          results.apis.bwt_submit = r
          logSubmission(log, url, 'bwt_submit', r.success, r)
        })
        break
    }
    if (promise) promises.push(promise)
  }

  await Promise.allSettled(promises)
  saveIndexingLog(log)

  return results
}

/**
 * DUAL-SEO: Enviar batch de URLs inteligentemente
 *
 * @param {Array<{url: string, reason: string}>} items - URLs con razón
 * @returns {Promise<Object[]>} Resultados por URL
 */
async function smartIndexBatch(items) {
  console.log(`🔄 Indexando ${items.length} URLs inteligentemente...`)

  const results = []
  // Procesar en lotes de 10 para no saturar APIs
  const BATCH_SIZE = 10

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(item => smartIndex(item.url, item.reason))
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        results.push({ error: result.reason?.message })
      }
    }

    // Pausa entre lotes para rate limiting
    if (i + BATCH_SIZE < items.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  const exitosos = results.filter(r => !r.error).length
  console.log(`  → ${exitosos}/${items.length} URLs procesadas correctamente`)
  return results
}

/**
 * DUAL-SEO: Ejecutar indexación inteligente basada en datos del pipeline
 * Se integra con monitorCaidaDual para resubmitir páginas en caída
 */
async function runSmartIndexer(paginasCaida = []) {
  console.log('🔄 Ejecutando Smart Indexer...')

  const items = []

  // DUAL-SEO: Resubmitir páginas en caída detectadas por el monitor
  for (const pagina of paginasCaida) {
    if (pagina.nivel_alerta === 'CRÍTICO' || pagina.caida_google_pct > 30 || pagina.caida_bing_pct > 30) {
      items.push({
        url: pagina.page,
        reason: 'traffic_drop',
      })
    }
  }

  if (items.length === 0) {
    console.log('  → No hay URLs que requieran reindexación')
    return []
  }

  return smartIndexBatch(items)
}

module.exports = { smartIndex, smartIndexBatch, runSmartIndexer }
