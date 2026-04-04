import { endpoint } from '../config'

const handleResponse = async (res) => {
  const text = await res.text().catch(() => '')
  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('application/json') && text ? JSON.parse(text) : text
  if (!res.ok) {
    const message = (data && data.message) || res.statusText || String(data)
    const err = new Error(message)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

// Build headers. Using cookie-based auth (httpOnly) — do not read token from localStorage.
// Include internal API key for backend access control (defense-in-depth).
const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
// Timezone del usuario para cálculos de horario local (ej: logro Lector Nocturno)
const getUserTimezone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
  catch { return ''; }
}
const getAuthHeaders = (extra = {}) => {
  const tz = getUserTimezone();
  return {
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    ...(tz ? { 'x-timezone': tz } : {}),
    ...extra,
  };
}
// Generic request with retry on network errors but DO NOT retry on 429
// Rationale: retrying aggressively on 429 can make throttling worse.
const requestWithRetry = async (input, init = {}, maxRetries = 3) => {
  let attempt = 0
  while (true) {
    attempt += 1
    let res
    try {
      res = await fetch(input, init)
    } catch (e) {
      // Network / fetch error: allow retry with exponential backoff up to maxRetries
      if (attempt > maxRetries) throw e
      const waitMs = 500 * Math.pow(2, attempt - 1)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }

    // If server responds 429 Too Many Requests, do NOT retry here.
    // Let the caller receive the 429 and handle throttling (or rely on Retry-After and UI backoff).
    if (res.status === 429) {
      return handleResponse(res)
    }

    // For other responses, handle normally (handleResponse will throw on non-ok)
    return handleResponse(res)
  }
}

// In-flight dedupe map and short-lived GET cache to avoid duplicate requests
const inFlightRequests = new Map()
const getCache = new Map()
const CACHE_TTL_MS = 5000

const makeCacheKey = (url, init = {}) => {
  // Only consider headers that affect response (Authorization) and url
  const headers = init.headers || {}
  const auth = headers.Authorization || headers.authorization || ''
  return `${url}|${init.method || 'GET'}|${auth}`
}

export const api = {
  get: (name, subpath = '', options = {}) => {
    const url = endpoint(name, subpath)
    // allow callers to opt-in to cache and set per-call TTL via options.cache and options.cacheTTL
    const { cache: cacheOpt, cacheTTL, ...fetchOptions } = options || {}
    const init = { method: 'GET', credentials: 'include', headers: getAuthHeaders(fetchOptions.headers || {}), ...fetchOptions }

    const key = makeCacheKey(url, init)

    // Determine whether to use cache: explicit opt-in or sensible defaults for stable endpoints (auth/me)
    const useCache = cacheOpt === true || (name === 'auth' && (subpath === '' || String(subpath) === 'me'))
    const cacheTtlMs = (typeof cacheTTL === 'number' && cacheTTL >= 0) ? cacheTTL : CACHE_TTL_MS

    if (useCache) {
      const cached = getCache.get(key)
      if (cached && (Date.now() - cached.ts) < cacheTtlMs) {
        return Promise.resolve(cached.data)
      }
    }

    // If a request for the same key is in-flight, reuse its promise
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key)
    }

    const p = requestWithRetry(url, init)
      .then((res) => {
        try {
          if (useCache) getCache.set(key, { ts: Date.now(), data: res })
        } catch { /* noop */ }
        inFlightRequests.delete(key)
        return res
      })
      .catch((err) => {
        inFlightRequests.delete(key)
        throw err
      })

    inFlightRequests.set(key, p)
    return p
  },
  post: (name, subpath = '', body, options = {}) => {
    // Detectar si body es FormData
    const isFormData = body instanceof FormData;
    const hasBody = typeof body !== 'undefined';

    // Si es FormData, no establecer Content-Type (el navegador lo hará con el boundary correcto)
    const headers = hasBody && !isFormData
      ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
      : { ...(options.headers || {}) };

    const bodyData = hasBody
      ? (isFormData ? body : JSON.stringify(body))
      : undefined;

    return requestWithRetry(endpoint(name, subpath), {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(headers),
      ...(hasBody ? { body: bodyData } : {}),
      ...options
    });
  },
  put: (name, subpath = '', body, options = {}) => {
    // Detectar si body es FormData
    const isFormData = body instanceof FormData;
    const hasBody = typeof body !== 'undefined';

    // Si es FormData, no establecer Content-Type (el navegador lo hará con el boundary correcto)
    const headers = hasBody && !isFormData
      ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
      : { ...(options.headers || {}) };

    const bodyData = hasBody
      ? (isFormData ? body : JSON.stringify(body))
      : undefined;

    return requestWithRetry(endpoint(name, subpath), {
      method: 'PUT',
      credentials: 'include',
      headers: getAuthHeaders(headers),
      ...(hasBody ? { body: bodyData } : {}),
      ...options
    });
  },
  del: (name, subpath = '', options = {}) => requestWithRetry(endpoint(name, subpath), { method: 'DELETE', credentials: 'include', headers: getAuthHeaders(options.headers || {}), ...options }),
  patch: (name, subpath = '', body, options = {}) => {
    const hasBody = typeof body !== 'undefined';
    const headers = hasBody ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : { ...(options.headers || {}) };
    return requestWithRetry(endpoint(name, subpath), {
      method: 'PATCH',
      credentials: 'include',
      headers: getAuthHeaders(headers),
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      ...options
    });
  },
  upload: (name, subpath = '', formData, options = {}) => {
    // No establecer Content-Type para que el navegador lo haga automáticamente con el boundary correcto
    return requestWithRetry(endpoint(name, subpath), { method: 'POST', credentials: 'include', headers: getAuthHeaders(options.headers || {}), body: formData, ...options })
  },
}

export const fetchSeries = (subpath = '') => api.get('series', subpath)

// Intento de cerrar sesión en el backend. Usa "credentials: include" para cookies.
export const logout = (subpath = 'logout') => api.post('auth', subpath)

// Obtener el usuario autenticado (sesión). Por defecto llama a /api/auth/me
export const getCurrentUser = (subpath = 'me') => api.get('auth', subpath, { cache: true, cacheTTL: CACHE_TTL_MS })

// Iniciar sesión (POST /api/auth/login) — backend debe establecer cookie o devolver token
export const login = (body, subpath = 'login') => api.post('auth', subpath, body)

// Registrar usuario (POST /api/auth/register)
export const register = (body, subpath = 'register') => api.post('auth', subpath, body)

// Login con Google OAuth (POST /api/auth/google)
// Soporta credential (ID token) o access_token
export const googleLogin = (token, tokenType = 'credential') => {
  const body = tokenType === 'access_token'
    ? { access_token: token }
    : { credential: token }
  return api.post('auth', 'google', body)
}

// Login con Discord OAuth (POST /api/auth/discord)
export const discordLogin = (code) => api.post('auth', 'discord', { code })

// Actualizar usuario (PATCH /api/users/:id)
export const updateUser = (userId, body) => api.patch('users', userId, body)

export default api
