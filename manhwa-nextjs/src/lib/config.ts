const LOCAL = process.env.NEXT_PUBLIC_API_URL_LOCAL
const PROD = process.env.NEXT_PUBLIC_API_URL_PROD
const MODE = process.env.NODE_ENV

export const API_BASE = MODE === 'production' ? (PROD || LOCAL) : (LOCAL || PROD)

export const apiUrl = (path = '') => {
  const base = (API_BASE || '').replace(/\/$/, '')
  const p = String(path).replace(/^\//, '')
  return p ? `${base}/${p}` : base
}

export default API_BASE

// Mapeo de endpoints de la API
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
  donations: apiUrl(`${apiPrefix}donations`),
}

// Helper para obtener un endpoint y agregar un subpath opcional
export const endpoint = (name: keyof typeof ENDPOINTS, subpath = '') => {
  const base = ENDPOINTS[name]
  if (!base) throw new Error(`Endpoint desconocido: ${name}`)
  const s = String(subpath).replace(/^\/+|\/+$/g, '')
  return s ? `${base}/${s}` : base
}
