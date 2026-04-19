/**
 * IMPERIAL-AGENT v3: Historial de cambios SEO para rollback
 *
 * Guarda pares {before, after} de cada UPDATE a DB para poder revertir
 * una optimización que haya dañado el posicionamiento. Se persiste a
 * disco en data/seo_history.json (JSONL podría ser mejor pero mantenemos
 * compat con agentMemory).
 *
 * Política de retención: últimas 500 entradas.
 */

const fs = require('fs')
const path = require('path')

const HISTORY_FILE = path.resolve(__dirname, '..', 'data', 'seo_history.json')
const MAX_ENTRIES = 500

function loadHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return []
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(entries) {
  try {
    const dir = path.dirname(HISTORY_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const trimmed = entries.slice(-MAX_ENTRIES)
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2))
  } catch (err) {
    console.warn(`  [HISTORY] No se pudo guardar: ${err.message}`)
  }
}

function recordChange({ slug, table, module: mod, before, after, reason = null }) {
  const entries = loadHistory()
  entries.push({
    ts: new Date().toISOString(),
    slug,
    table,
    module: mod,
    before,
    after,
    reason,
  })
  saveHistory(entries)
}

function findLastChange(slug, table = null) {
  const entries = loadHistory()
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e.slug === slug && (!table || e.table === table)) return e
  }
  return null
}

module.exports = {
  recordChange,
  findLastChange,
  loadHistory,
}
