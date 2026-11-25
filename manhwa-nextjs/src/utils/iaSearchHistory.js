const CACHE_PREFIX = 'ia_cache_v3_'
const CACHE_INDEX_KEY = 'ia_cache_index'
const STORAGE_PROBE_KEY = '__ia_storage_probe__'

export function slugifyQuery(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 300)
}

function getHistoryStorage() {
  if (typeof window === 'undefined') return null

  for (const storageType of ['sessionStorage', 'localStorage']) {
    try {
      const storage = window[storageType]
      if (!storage) continue
      storage.setItem(STORAGE_PROBE_KEY, '1')
      storage.removeItem(STORAGE_PROBE_KEY)
      return storage
    } catch {
      // Try the other storage backend.
    }
  }

  return null
}

export function getSearchHistory(limit = 5, options = {}) {
  const safeLang = options.lang === 'en' ? 'en' : 'es'
  const namespace = String(options.namespace || 'default').trim().toLowerCase()
  const safeNamespace = namespace === 'default'
    ? ''
    : `_${namespace.replace(/[^a-z0-9_-]/g, '') || 'default'}`
  const cachePrefix = `${CACHE_PREFIX}${safeLang}${safeNamespace}_`
  const cacheIndexKey = `${CACHE_INDEX_KEY}_${safeLang}${safeNamespace}`
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, limit)) : 5

  try {
    const storage = getHistoryStorage()
    if (!storage) return []

    const rawIndex = storage.getItem(cacheIndexKey)
    const parsedIndex = rawIndex ? JSON.parse(rawIndex) : []
    if (!Array.isArray(parsedIndex)) return []

    return parsedIndex
      .filter((entry) => (
        entry
        && typeof entry === 'object'
        && typeof entry.key === 'string'
        && Number.isFinite(entry.ts)
      ))
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, safeLimit)
      .map((entry) => {
        const slug = entry.key.replace(cachePrefix, '')
        const rawEntry = storage.getItem(`${cachePrefix}${slug}`)
        if (!rawEntry) return null
        const cached = JSON.parse(rawEntry)
        const query = typeof cached?.originalQuery === 'string' ? cached.originalQuery : null
        return query ? { query, slug, ts: entry.ts } : null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}
