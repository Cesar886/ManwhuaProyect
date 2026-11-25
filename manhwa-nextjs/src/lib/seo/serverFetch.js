import { SERVER_API_BASE, SITE_URL } from '@/config'

const API_KEY = process.env.INTERNAL_API_KEY || ''
const TIMEOUT_MS = 4500

export async function fetchInternalJson(path, options = {}) {
  const base = (SERVER_API_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '')
  const url = `${base}/${String(path).replace(/^\//, '')}`
  let lastError

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        ...options,
        // Explicit cache is required because the route itself is dynamic.
        // Next keeps the last successful response when background revalidation fails.
        cache: 'force-cache',
        headers: {
          Accept: 'application/json',
          Origin: SITE_URL,
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          ...(options.headers || {}),
        },
        signal: controller.signal,
        next: { revalidate: options.revalidate || 300 },
      })
      if (response.status === 404 && options.allowNotFound) return null
      if (!response.ok) throw new Error(`Internal API ${response.status}: ${url}`)
      const json = await response.json()
      if (options.requireNonEmpty && (!json || (Array.isArray(json) && json.length === 0))) {
        throw new Error(`Internal API returned empty data: ${url}`)
      }
      return json
    } catch (error) {
      lastError = error
      if (attempt === 0) continue
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError || new Error(`Internal API unavailable: ${url}`)
}

export function extractSeries(payload) {
  const series = payload?.data?.series || payload?.series || payload?.data || payload
  if (!Array.isArray(series) || series.length === 0) throw new Error('Internal API returned no series')
  return series
}
