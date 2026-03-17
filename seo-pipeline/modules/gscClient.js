/**
 * GSC-SEO: Cliente compartido para Google Search Console API
 *
 * Usa google-auth-library (mismo patrón que googleIndexing.js del backend)
 * en lugar de googleapis (pesado). Hace llamadas REST directas.
 *
 * Requisitos:
 *   1. Service Account con acceso a GSC (añadir como usuario en Search Console)
 *   2. Archivo de credenciales JSON del Service Account
 */

const { GoogleAuth } = require('google-auth-library')
const axios = require('axios')
const path = require('path')
const fs = require('fs')

// GSC API base URL
const GSC_API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3'

// Scope necesario para leer datos de Search Console
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

let authClient = null

// GSC-SEO: Inicializa el cliente de autenticación con el Service Account
async function getAuthClient() {
  if (authClient) return authClient

  const credentialsPath = path.resolve(
    process.env.GOOGLE_CREDENTIALS_PATH ||
    path.join(__dirname, '..', '..', 'manhwa-api', 'src', 'config', 'google-indexing-credentials.json')
  )

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `GSC-CRÍTICO ⚠: Archivo de credenciales no encontrado en ${credentialsPath}\n` +
      `→ Configura GOOGLE_CREDENTIALS_PATH en .env`
    )
  }

  const auth = new GoogleAuth({
    keyFile: credentialsPath,
    scopes: [GSC_SCOPE],
  })

  authClient = await auth.getClient()
  return authClient
}

// GSC-SEO: Obtiene un token de acceso válido para llamadas REST
async function getAccessToken() {
  const client = await getAuthClient()
  const tokenResponse = await client.getAccessToken()
  return tokenResponse.token || tokenResponse
}

/**
 * GSC-SEO: Consulta la Search Analytics API de Google Search Console
 *
 * @param {Object} params - Parámetros de la consulta
 * @param {string} params.startDate - Fecha inicio (YYYY-MM-DD)
 * @param {string} params.endDate - Fecha fin (YYYY-MM-DD)
 * @param {string[]} params.dimensions - Dimensiones: query, page, country, device, date
 * @param {Object[]} [params.dimensionFilterGroups] - Filtros opcionales
 * @param {number} [params.rowLimit=25000] - Máximo de filas (máx. API: 25000)
 * @param {number} [params.startRow=0] - Offset para paginación
 * @returns {Promise<Object[]>} Filas de datos de GSC
 */
async function querySearchAnalytics(params) {
  const siteUrl = process.env.GSC_SITE_URL || 'https://manhwaimperial.site'
  const encodedSite = encodeURIComponent(siteUrl)
  const url = `${GSC_API_BASE}/sites/${encodedSite}/searchAnalytics/query`

  const token = await getAccessToken()

  const body = {
    startDate: params.startDate,
    endDate: params.endDate,
    dimensions: params.dimensions || ['query', 'page'],
    rowLimit: params.rowLimit || 25000,
    startRow: params.startRow || 0,
    // GSC-SEO: Tipo 'web' para resultados de búsqueda orgánica (excluye imagen/video/news)
    type: params.type || 'web',
  }

  if (params.dimensionFilterGroups) {
    body.dimensionFilterGroups = params.dimensionFilterGroups
  }

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    return response.data.rows || []
  } catch (error) {
    if (error.response?.status === 401) {
      // GSC-CRÍTICO ⚠: Token expirado — resetear cliente para re-autenticar
      authClient = null
      throw new Error(
        'GSC-CRÍTICO ⚠: Autenticación expirada → Verificar credenciales del Service Account'
      )
    }
    if (error.response?.status === 403) {
      throw new Error(
        'GSC-CRÍTICO ⚠: Sin permisos en GSC → Agregar el email del Service Account como usuario en Search Console'
      )
    }
    if (error.response?.status === 429) {
      throw new Error(
        'GSC-CRÍTICO ⚠: Rate limit excedido → Esperar 60 segundos y reintentar'
      )
    }
    throw error
  }
}

/**
 * GSC-SEO: Consulta paginada para obtener TODOS los datos (>25000 filas)
 * Itera automáticamente si hay más filas disponibles.
 */
async function queryAllRows(params) {
  const PAGE_SIZE = 25000
  let allRows = []
  let startRow = 0
  let hasMore = true

  while (hasMore) {
    const rows = await querySearchAnalytics({
      ...params,
      rowLimit: PAGE_SIZE,
      startRow,
    })

    allRows = allRows.concat(rows)
    startRow += PAGE_SIZE

    // GSC-SEO: Si devuelve menos del máximo, no hay más páginas
    hasMore = rows.length === PAGE_SIZE
  }

  return allRows
}

// GSC-SEO: Helper para calcular fechas relativas
function dateOffset(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

// GSC-SEO: Extrae el valor de una dimensión de una fila de GSC
function getDimension(row, dimensionName, dimensions) {
  const idx = dimensions.indexOf(dimensionName)
  return idx >= 0 ? row.keys[idx] : null
}

module.exports = {
  querySearchAnalytics,
  queryAllRows,
  dateOffset,
  getDimension,
}
