/**
 * IMPERIAL-AGENT v3: Invalidador de ISR Next.js
 *
 * Tras cada UPDATE a DB, llama al endpoint /api/revalidate del frontend
 * para que Next.js regenere las páginas con el nuevo meta_title/meta_description.
 *
 * Si REVALIDATE_SECRET o SITE_URL no están configurados, no-op silencioso
 * (no debe hacer fallar el pipeline).
 */

const axios = require('axios')

const SITE_URL = process.env.SITE_URL || 'https://manhwaimperial.site'
const SECRET = process.env.REVALIDATE_SECRET || ''
const TIMEOUT_MS = 8000
const MAX_RETRIES = 2

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Revalida las rutas asociadas a un slug (y opcionalmente un capítulo).
 * Retries exponenciales ante 5xx / timeout.
 *
 * @param {object} opts { slug, numero?, paths?, tags? }
 * @returns {object} { ok, status?, revalidated?, error? }
 */
async function revalidateSeries(opts = {}) {
  if (!SECRET) {
    return { ok: false, skipped: true, reason: 'REVALIDATE_SECRET_missing' }
  }
  if (!opts.slug && !opts.paths?.length && !opts.tags?.length) {
    return { ok: false, skipped: true, reason: 'no_targets' }
  }

  const url = `${SITE_URL}/api/revalidate?secret=${encodeURIComponent(SECRET)}`
  const body = {}
  if (opts.slug) body.slug = opts.slug
  if (opts.numero !== undefined && opts.numero !== null) body.numero = opts.numero
  if (Array.isArray(opts.paths)) body.paths = opts.paths
  if (Array.isArray(opts.tags)) body.tags = opts.tags

  let lastErr = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(url, body, {
        timeout: TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      })
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, status: res.status, revalidated: res.data?.revalidated || [] }
      }
      // 4xx: no reintentar
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, error: res.data?.error || `HTTP ${res.status}` }
      }
      lastErr = `HTTP ${res.status}`
    } catch (err) {
      lastErr = err.message
    }
    if (attempt < MAX_RETRIES) await sleep(500 * Math.pow(2, attempt))
  }
  return { ok: false, error: lastErr || 'unknown', retries: MAX_RETRIES }
}

module.exports = { revalidateSeries }
