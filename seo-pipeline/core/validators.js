/**
 * IMPERIAL-AGENT v3: Validadores de seguridad para escritura en DB
 *
 * Se aplican antes de cualquier UPDATE o INSERT para evitar:
 *   - Meta title > 60 / < 20 chars (Google trunca en SERP)
 *   - Meta description > 160 / < 50 chars (Google trunca / sin snippet)
 *   - Strings vacios / null / idénticos al actual (noop)
 *   - HTML/scripts inyectados en campos de texto
 *   - Pérdida de accentos UTF-8 por comillas mal-escapadas
 */

const LIMITS = {
  TITLE_MIN: 20,
  TITLE_MAX: 60,
  TITLE_HARD_MAX: 80, // rechaza sobre esto; entre MAX y HARD_MAX trunca
  META_MIN: 50,
  META_MAX: 160,
  META_HARD_MAX: 200,
}

// Chars peligrosos en contexto HTML (no se escriben como-is)
const SUSPICIOUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i,        // onclick=, onerror=, etc.
  /<iframe/i,
  /<\?php/i,
]

function containsSuspicious(str) {
  if (typeof str !== 'string') return false
  return SUSPICIOUS_PATTERNS.some(p => p.test(str))
}

function normalizeWhitespace(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/\s+/g, ' ').trim()
}

/**
 * Valida y limpia un meta_title generado por IA.
 * @returns {object} { ok, value, reason, truncated }
 */
function validateTitle(raw, currentTitle = null) {
  if (raw === undefined || raw === null) {
    return { ok: false, reason: 'title_null' }
  }
  const value = normalizeWhitespace(String(raw))

  if (value.length === 0) return { ok: false, reason: 'title_empty' }
  if (containsSuspicious(value)) return { ok: false, reason: 'title_suspicious' }
  if (value.length < LIMITS.TITLE_MIN) return { ok: false, reason: `title_too_short (${value.length}<${LIMITS.TITLE_MIN})` }
  if (value.length > LIMITS.TITLE_HARD_MAX) return { ok: false, reason: `title_too_long (${value.length}>${LIMITS.TITLE_HARD_MAX})` }

  // No-op: idéntico al actual
  if (currentTitle && normalizeWhitespace(currentTitle) === value) {
    return { ok: false, reason: 'title_unchanged' }
  }

  // Truncamiento suave entre MAX y HARD_MAX
  let truncated = false
  let final = value
  if (final.length > LIMITS.TITLE_MAX) {
    final = final.slice(0, LIMITS.TITLE_MAX - 1).replace(/\s+\S*$/, '').trim() + '…'
    truncated = true
  }

  return { ok: true, value: final, truncated }
}

/**
 * Valida y limpia un meta_description generado por IA.
 */
function validateMetaDescription(raw, currentMeta = null) {
  if (raw === undefined || raw === null) {
    return { ok: false, reason: 'meta_null' }
  }
  const value = normalizeWhitespace(String(raw))

  if (value.length === 0) return { ok: false, reason: 'meta_empty' }
  if (containsSuspicious(value)) return { ok: false, reason: 'meta_suspicious' }
  if (value.length < LIMITS.META_MIN) return { ok: false, reason: `meta_too_short (${value.length}<${LIMITS.META_MIN})` }
  if (value.length > LIMITS.META_HARD_MAX) return { ok: false, reason: `meta_too_long (${value.length}>${LIMITS.META_HARD_MAX})` }

  if (currentMeta && normalizeWhitespace(currentMeta) === value) {
    return { ok: false, reason: 'meta_unchanged' }
  }

  let truncated = false
  let final = value
  if (final.length > LIMITS.META_MAX) {
    final = final.slice(0, LIMITS.META_MAX - 1).replace(/\s+\S*$/, '').trim() + '…'
    truncated = true
  }

  return { ok: true, value: final, truncated }
}

/**
 * Valida schema JSON-LD antes de escribir.
 * Exige objeto con @context y @type como mínimo.
 */
function validateSchemaJsonLd(raw) {
  if (raw === undefined || raw === null) return { ok: false, reason: 'schema_null' }
  let obj = raw
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw) } catch { return { ok: false, reason: 'schema_invalid_json' } }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, reason: 'schema_not_object' }
  }
  if (!obj['@context'] || !obj['@type']) {
    return { ok: false, reason: 'schema_missing_fields' }
  }
  return { ok: true, value: obj }
}

/**
 * Validador compuesto que aplica a todos los campos editables.
 * Devuelve un payload limpio + motivos si algo se descartó.
 */
function validateMetaPayload(input, current = {}) {
  const reasons = []
  const clean = {}
  const flags = { truncated: [] }

  if (input.title !== undefined) {
    const r = validateTitle(input.title, current.title)
    if (r.ok) {
      clean.title = r.value
      if (r.truncated) flags.truncated.push('title')
    } else {
      reasons.push({ field: 'title', reason: r.reason })
    }
  }

  if (input.meta_description !== undefined) {
    const r = validateMetaDescription(input.meta_description, current.meta_description)
    if (r.ok) {
      clean.meta_description = r.value
      if (r.truncated) flags.truncated.push('meta_description')
    } else {
      reasons.push({ field: 'meta_description', reason: r.reason })
    }
  }

  if (input.schema_jsonld !== undefined && input.schema_jsonld !== null) {
    const r = validateSchemaJsonLd(input.schema_jsonld)
    if (r.ok) {
      clean.schema_jsonld = r.value
    } else {
      reasons.push({ field: 'schema_jsonld', reason: r.reason })
    }
  }

  const hasSomethingToWrite = Object.keys(clean).length > 0
  return {
    ok: hasSomethingToWrite,
    clean,
    reasons,
    truncated: flags.truncated,
  }
}

module.exports = {
  LIMITS,
  validateTitle,
  validateMetaDescription,
  validateSchemaJsonLd,
  validateMetaPayload,
  normalizeWhitespace,
}
