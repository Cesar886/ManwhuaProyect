/**
 * BWT-SEO: Cliente compartido para Bing Webmaster Tools API
 *
 * Autenticación via API Key (obtener en Bing Webmaster Tools > Settings > API Access).
 * Rate limiting integrado para respetar los límites de BWT.
 *
 * LIMITACIONES CONOCIDAS DE BWT API:
 *   - No permite obtener page+query juntos en una sola llamada
 *   - Rate limits más estrictos que GSC
 *   - Datos pueden tener hasta 48h de delay
 */

const axios = require('axios')
const { BWT } = require('../config/apis')

// BWT-SEO: Control de rate limiting
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = Math.ceil(1000 / BWT.RATE_LIMIT_RPS)

// BWT-SEO: Esperar para respetar rate limits
async function throttle() {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed))
  }
  lastRequestTime = Date.now()
}

// BWT-SEO: Verificar que la API key esté configurada
function ensureApiKey() {
  if (!BWT.API_KEY) {
    throw new Error(
      'BWT-CRÍTICO ⚠: BWT_API_KEY no configurada → ' +
      'Obtenerla en Bing Webmaster Tools > Settings > API Access > API Key'
    )
  }
}

/**
 * BWT-SEO: Llamada genérica a la API de Bing Webmaster Tools
 *
 * @param {string} endpoint - Endpoint (sin base URL)
 * @param {Object} [extraParams={}] - Parámetros adicionales de query string
 * @param {string} [method='GET'] - Método HTTP
 * @param {Object} [body=null] - Body para POST
 * @returns {Promise<Object>} Respuesta de la API
 */
async function bwtRequest(endpoint, extraParams = {}, method = 'GET', body = null) {
  ensureApiKey()
  await throttle()

  const url = `${BWT.API_BASE}${endpoint}`
  const params = {
    apikey: BWT.API_KEY,
    siteUrl: BWT.SITE_URL,
    ...extraParams,
  }

  try {
    const config = {
      method,
      url,
      params,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body) config.data = body

    const response = await axios(config)
    return response.data
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('BWT-CRÍTICO ⚠: API key inválida → Verificar BWT_API_KEY en .env')
    }
    if (error.response?.status === 403) {
      throw new Error('BWT-CRÍTICO ⚠: Sin permisos → Verificar que el sitio esté verificado en Bing Webmaster Tools')
    }
    if (error.response?.status === 429) {
      throw new Error('BWT-CRÍTICO ⚠: Rate limit excedido → Esperar y reintentar')
    }
    throw error
  }
}

/**
 * BWT-SEO: Obtener estadísticas de queries (keywords)
 * VENTAJA: Bing NO anonimiza queries → más datos accionables que GSC
 *
 * @returns {Promise<Object[]>} Array de stats por query
 */
async function getQueryStats() {
  const data = await bwtRequest(BWT.ENDPOINTS.QUERY_STATS)
  // BWT-SEO: La respuesta viene en d.Results o directamente como array
  return extractResults(data)
}

/**
 * BWT-SEO: Obtener estadísticas por página
 *
 * @returns {Promise<Object[]>} Array de stats por página
 */
async function getPageStats() {
  const data = await bwtRequest(BWT.ENDPOINTS.PAGE_STATS)
  return extractResults(data)
}

/**
 * BWT-SEO: Obtener estadísticas de ranking y tráfico
 * Incluye métricas de Copilot/Chat si están disponibles
 *
 * @returns {Promise<Object[]>} Array de stats de ranking
 */
async function getRankAndTrafficStats() {
  const data = await bwtRequest(BWT.ENDPOINTS.RANK_STATS)
  return extractResults(data)
}

/**
 * BWT-SEO: Obtener resultados del SEO Scanner de Bing
 * EXCLUSIVO BWT: GSC no tiene SEO Scanner integrado
 *
 * @returns {Promise<Object[]>} Array de issues detectados
 */
async function getScanDetails() {
  try {
    const data = await bwtRequest(BWT.ENDPOINTS.SITE_SCAN)
    return extractResults(data)
  } catch (err) {
    // BWT-SEO: SEO Scanner puede no estar disponible para todos los sitios
    console.warn(`  ⚠ BWT SEO Scanner no disponible: ${err.message}`)
    return []
  }
}

/**
 * BWT-SEO: Obtener backlinks de un dominio
 * EXCLUSIVO BWT: Permite ver backlinks de CUALQUIER dominio
 *
 * @param {string} targetUrl - URL o dominio a consultar
 * @returns {Promise<Object>} Datos de backlinks
 */
async function getLinkCounts(targetUrl) {
  try {
    const data = await bwtRequest(BWT.ENDPOINTS.LINK_COUNTS, { q: targetUrl })
    return data
  } catch (err) {
    console.warn(`  ⚠ BWT Backlinks no disponible para ${targetUrl}: ${err.message}`)
    return null
  }
}

/**
 * BWT-SEO: Obtener URLs que enlazan a un dominio
 *
 * @param {string} targetUrl - URL a consultar
 * @param {number} [page=0] - Página de resultados
 * @returns {Promise<Object[]>} Array de URLs enlazantes
 */
async function getUrlLinks(targetUrl, page = 0) {
  try {
    const data = await bwtRequest(BWT.ENDPOINTS.URL_LINKS, { q: targetUrl, page })
    return extractResults(data)
  } catch (err) {
    console.warn(`  ⚠ BWT URL Links no disponible para ${targetUrl}: ${err.message}`)
    return []
  }
}

/**
 * BWT-SEO: Enviar URL para indexación via Bing Submit URL API
 *
 * @param {string} url - URL a indexar
 * @returns {Promise<boolean>} true si se envió correctamente
 */
async function submitUrl(url) {
  try {
    await bwtRequest(BWT.ENDPOINTS.SUBMIT_URL, {}, 'POST', { siteUrl: BWT.SITE_URL, url })
    return true
  } catch (err) {
    console.warn(`  ⚠ BWT SubmitUrl falló para ${url}: ${err.message}`)
    return false
  }
}

/**
 * BWT-SEO: Enviar batch de URLs para indexación
 *
 * @param {string[]} urls - Array de URLs a indexar
 * @returns {Promise<boolean>} true si se envió correctamente
 */
async function submitUrlBatch(urls) {
  try {
    await bwtRequest(BWT.ENDPOINTS.SUBMIT_URL_BATCH, {}, 'POST', {
      siteUrl: BWT.SITE_URL,
      urlList: urls,
    })
    return true
  } catch (err) {
    console.warn(`  ⚠ BWT SubmitUrlBatch falló: ${err.message}`)
    return false
  }
}

/**
 * BWT-SEO: Obtener información de una URL específica
 *
 * @param {string} url - URL a consultar
 * @returns {Promise<Object|null>} Info de la URL
 */
async function getUrlInfo(url) {
  try {
    const data = await bwtRequest(BWT.ENDPOINTS.URL_INFO, { url })
    return data
  } catch (err) {
    return null
  }
}

// BWT-SEO: Extraer resultados de la respuesta de BWT (maneja distintos formatos)
function extractResults(data) {
  if (!data) return []
  // BWT puede devolver { d: { Results: [...] } } o { d: [...] } o directamente [...]
  if (Array.isArray(data)) return data
  if (data.d) {
    if (Array.isArray(data.d)) return data.d
    if (data.d.Results && Array.isArray(data.d.Results)) return data.d.Results
    if (data.d.__next) return data.d.Results || []
  }
  if (data.Results && Array.isArray(data.Results)) return data.Results
  return []
}

// BWT-SEO: Normalizar una fila de BWT al formato comparable con GSC
function normalizeBwtRow(row) {
  return {
    query: row.Query || row.query || '',
    page: row.Url || row.Page || row.url || row.page || '',
    clicks: row.Clicks || row.clicks || 0,
    impressions: row.Impressions || row.impressions || 0,
    ctr: row.Ctr || row.ctr || 0,
    position: row.AvgClickPosition || row.Position || row.position || 0,
    // BWT-SEO: Datos de Copilot/Chat si están disponibles
    copilotImpressions: row.CopilotImpressions || row.IntelligentSearchImpressions || 0,
    copilotClicks: row.CopilotClicks || row.IntelligentSearchClicks || 0,
    date: row.Date || row.date || null,
  }
}

// BWT-SEO: Helper para formatear fechas como espera BWT (MM/dd/yyyy o yyyy-MM-dd)
function formatBwtDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

module.exports = {
  bwtRequest,
  getQueryStats,
  getPageStats,
  getRankAndTrafficStats,
  getScanDetails,
  getLinkCounts,
  getUrlLinks,
  submitUrl,
  submitUrlBatch,
  getUrlInfo,
  normalizeBwtRow,
  formatBwtDate,
}
