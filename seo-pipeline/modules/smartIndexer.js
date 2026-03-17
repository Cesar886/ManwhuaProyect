/**
 * IMPERIAL-AGENT v3: Modulo 8 — Indexacion Inteligente
 *
 * Sin GPT. Detectar paginas con updated_at ultimos 7 dias
 * y updated_by = "IMPERIAL-AGENT-v3".
 *
 * Por cada URL:
 *   1. Enviar a GSC Indexing API
 *   2. Enviar a BWT IndexNow (mas rapido)
 *   3. Registrar en log
 *
 * Rate limits: GSC 200/dia | BWT 10,000/dia
 * No enviar la misma URL dos veces en 7 dias.
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { GoogleAuth } = require('google-auth-library')
const { INDEX_NOW, GSC } = require('../config/apis')
const { submitUrl: bwtSubmitUrl } = require('./bwtClient')
const { wasRecentlyIndexed, markIndexed } = require('../core/agentMemory')

const INDEXING_LOG_PATH = path.resolve(process.env.REPORTS_DIR || './reports', 'indexing_log.json')
const MAX_RETRIES = 3
const COOLDOWN_DAYS = 7

// Log de envios
function readIndexingLog() {
  try {
    if (fs.existsSync(INDEXING_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(INDEXING_LOG_PATH, 'utf-8'))
    }
  } catch { /* corrupto */ }
  return { entries: [] }
}

function saveIndexingLog(log) {
  const dir = path.dirname(INDEXING_LOG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmpPath = INDEXING_LOG_PATH + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(log, null, 2), 'utf-8')
  fs.renameSync(tmpPath, INDEXING_LOG_PATH)
}

function logSubmission(log, url, api, success, response) {
  log.entries.push({
    url, api, success,
    response: typeof response === 'string' ? response : JSON.stringify(response),
    timestamp: new Date().toISOString(),
  })
  // Mantener 30 dias
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000)
  log.entries = log.entries.filter(e => new Date(e.timestamp).getTime() > cutoff)
}

// IndexNow (Bing, Yandex)
async function sendToIndexNow(url, retries = 0) {
  if (!INDEX_NOW.KEY) return { success: false, error: 'INDEXNOW_KEY no configurada' }

  try {
    const payload = {
      host: new URL(url).hostname,
      key: INDEX_NOW.KEY,
      urlList: [url],
    }
    if (INDEX_NOW.KEY_LOCATION) payload.keyLocation = INDEX_NOW.KEY_LOCATION

    const response = await axios.post(INDEX_NOW.ENDPOINT, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    })
    return { success: true, status: response.status }
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)))
      return sendToIndexNow(url, retries + 1)
    }
    return { success: false, error: err.message }
  }
}

// Google Indexing API
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

// Bing Submit URL
async function sendToBwtSubmit(url) {
  try {
    const result = await bwtSubmitUrl(url)
    return { success: !!result, status: result ? 200 : 500 }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Enviar URL a todas las APIs disponibles
 * v2: Respeta cooldown de 7 dias (no 24h)
 */
async function smartIndex(url, reason = 'content_update', options = {}) {
  // v2: Cooldown de 7 dias
  if (!options.force && wasRecentlyIndexed(url, COOLDOWN_DAYS)) {
    return { url, reason, skipped: true, skipped_reason: 'Indexada en ultimos 7 dias' }
  }

  const log = readIndexingLog()
  const results = { url, reason, timestamp: new Date().toISOString(), apis: {} }

  const apisToUse = reason === 'new_page'
    ? ['indexnow', 'google_indexing', 'bwt_submit']
    : ['indexnow', 'google_indexing']

  const promises = []

  for (const api of apisToUse) {
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

  // v2: Registrar en memoria del agente
  const anySuccess = Object.values(results.apis).some(a => a.success)
  if (anySuccess) {
    markIndexed(url, Object.keys(results.apis).filter(k => results.apis[k].success).join('+'))
  }

  return results
}

/**
 * Batch indexing con rate limiting
 */
async function smartIndexBatch(items) {
  console.log(`  [M8] Indexando ${items.length} URLs...`)

  const results = []
  const BATCH_SIZE = 10

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(item => smartIndex(item.url, item.reason))
    )

    for (const result of batchResults) {
      results.push(result.status === 'fulfilled' ? result.value : { error: result.reason?.message })
    }

    if (i + BATCH_SIZE < items.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  const exitosos = results.filter(r => !r.error && !r.skipped).length
  const omitidos = results.filter(r => r.skipped).length
  console.log(`  [M8] ${exitosos} indexadas, ${omitidos} omitidas (cooldown)`)
  return results
}

/**
 * v2: Ejecutar indexacion basada en paginas en caida + paginas actualizadas por el agente
 */
async function runSmartIndexer(paginasCaida = []) {
  console.log('  [M8] Smart Indexer...')

  const items = []

  // Resubmitir paginas en caida critica
  for (const pagina of paginasCaida) {
    if (pagina.nivel_alerta === 'CRITICO' || Math.abs(pagina.g_pct || pagina.caida_google_pct || 0) > 30) {
      items.push({ url: pagina.page, reason: 'traffic_drop' })
    }
  }

  if (items.length === 0) {
    console.log('  [M8] No hay URLs que requieran reindexacion')
    return []
  }

  return smartIndexBatch(items)
}

module.exports = { smartIndex, smartIndexBatch, runSmartIndexer }
