const LOCAL = process.env.NEXT_PUBLIC_API_URL_LOCAL
const PROD = process.env.NEXT_PUBLIC_API_URL_PROD
const MODE = process.env.NODE_ENV

export const API_BASE = MODE === 'production' ? (PROD || LOCAL) : (LOCAL || PROD)

/**
 * URL interna para fetches SSR en el servidor.
 * En producción apunta a localhost:3000 (Express directo, sin pasar por Cloudflare).
 * En el browser siempre se usa API_BASE (la URL pública).
 * Se configura con la variable de entorno INTERNAL_API_URL (sin prefijo NEXT_PUBLIC_
 * para que sea exclusiva del servidor y leída en runtime, sin necesidad de rebuild).
 */
export const SERVER_API_BASE =
  typeof window === 'undefined' && process.env.INTERNAL_API_URL
    ? process.env.INTERNAL_API_URL.replace(/\/$/, '')
    : (API_BASE || '').replace(/\/$/, '')

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://manhwaimperial.site'

export const SITE_NAME = 'Manhwa Imperial'

export const CHAPTERS_PER_SITEMAP = 1000

export const apiUrl = (path = '') => {
  const base = (API_BASE || '').replace(/\/$/, '')
  const p = String(path).replace(/^\//, '')
  return p ? `${base}/${p}` : base
}

export default API_BASE

const _baseHasApi = (API_BASE || '').replace(/\/$/, '').endsWith('/api')
const apiPrefix = _baseHasApi ? '' : 'api/'

export const ENDPOINTS = {
  auth: apiUrl(`${apiPrefix}auth`),
  users: apiUrl(`${apiPrefix}users`),
  series: apiUrl(`${apiPrefix}series`),
  chapters: apiUrl(`${apiPrefix}chapters`),
  comments: apiUrl(`${apiPrefix}comments`),
  webhooks: apiUrl(`${apiPrefix}webhooks`),
  collections: apiUrl(`${apiPrefix}collections`),
  requests: apiUrl(`${apiPrefix}requests`),
  bookmarks: apiUrl(`${apiPrefix}bookmarks`),
  genres: apiUrl(`${apiPrefix}genres`),
  search: apiUrl(`${apiPrefix}search`),
  admin: apiUrl(`${apiPrefix}admin`),
  upload: apiUrl(`${apiPrefix}upload`),
  spaces: apiUrl(`${apiPrefix}spaces`),
  progress: apiUrl(`${apiPrefix}progress`),
}

export const endpoint = (name, subpath = '') => {
  const base = ENDPOINTS[name]
  if (!base) throw new Error(`Endpoint desconocido: ${name}`)
  const s = String(subpath).replace(/^\/+|\/+$/g, '')
  return s ? `${base}/${s}` : base
}
