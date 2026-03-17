/**
 * IMPERIAL-AGENT v3: Sistema de Memoria Persistente
 *
 * Guarda estado del agente entre ejecuciones:
 *   - db_schema detectado
 *   - URLs optimizadas (no repetir <1 semana)
 *   - Paginas creadas (slugs)
 *   - URLs indexadas (no repetir <7 dias)
 *   - Content gaps procesados (no repetir 2 semanas seguidas)
 *   - Drafts pendientes
 *   - Costos OpenAI acumulados (mensual + historial 52 semanas)
 *
 * Reglas criticas:
 *   - No optimizar la misma URL mas de 1 vez/semana
 *   - No crear slug ya existente en DB
 *   - No indexar la misma URL 2 veces en 7 dias
 *   - No procesar el mismo gap 2 semanas seguidas
 */

const fs = require('fs')
const path = require('path')

const MEMORY_PATH = path.resolve(__dirname, '..', 'data', 'agent_memory.json')

const DEFAULT_MEMORY = {
  version: '2.1.0',
  db_type: null,
  db_schema: null,
  semana_actual: null,
  ultima_ejecucion: null,
  paginas_optimizadas_semana: [],   // { url, modulo, fecha }
  paginas_creadas_slugs: [],         // { slug, query, fecha }
  urls_indexadas_semana: [],         // { url, fecha, via }
  content_gaps_procesados: [],       // { query, fecha, resultado }
  drafts_pendientes: [],             // { tipo, slug/url, modulo, score, fecha }
  costo_openai_semana_usd: 0,
  costo_openai_mes_usd: 0,
  costos_openai: {
    mes_actual: null,
    acumulado_usd: 0,
    tokens_totales: 0,
    llamadas: 0,
  },
  historial_costos: [],              // ultimas 52 semanas: { semana, costo_usd, tokens }
  // CURATOR-AGENT v1
  curator_queue: [],                 // URLs en cola para curar
  paginas_curadas_semana: [],        // { url, slug, tipo, score, fecha }
  paginas_curadas_historico: {},     // { url: { veces_curada, ultima_curacion, ctr_antes, ctr_despues, mejora_confirmada } }
  // AB-TESTER v1
  ab_tests_activos: [],              // { slug, url, start, tipo }
  ab_tests_completados: [],          // { slug, winner, score, fecha }
}

// ── Lectura/Escritura ──

function readMemory() {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8'))
      return { ...DEFAULT_MEMORY, ...data }
    }
  } catch { /* corrupto */ }
  return { ...DEFAULT_MEMORY }
}

function saveMemory(memory) {
  const dir = path.dirname(MEMORY_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmpPath = MEMORY_PATH + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(memory, null, 2), 'utf-8')
  fs.renameSync(tmpPath, MEMORY_PATH)
}

function updateMemory(key, value) {
  const memory = readMemory()
  memory[key] = value
  saveMemory(memory)
}

// ── Semana actual ──

function getCurrentWeek() {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  return monday.toISOString().split('T')[0]
}

function ensureCurrentWeek() {
  const memory = readMemory()
  const week = getCurrentWeek()
  if (memory.semana_actual !== week) {
    // Nueva semana: limpiar datos semanales
    memory.semana_actual = week
    memory.paginas_optimizadas_semana = []
    memory.urls_indexadas_semana = []
    memory.costo_openai_semana_usd = 0

    // Archivar costo semanal anterior
    if (memory.semana_actual) {
      memory.historial_costos.push({
        semana: memory.semana_actual,
        costo_usd: memory.costo_openai_semana_usd,
        tokens: memory.costos_openai.tokens_totales,
      })
      // Mantener solo 52 semanas
      if (memory.historial_costos.length > 52) {
        memory.historial_costos = memory.historial_costos.slice(-52)
      }
    }

    saveMemory(memory)
  }
  return memory
}

// ── URLs optimizadas ──

function wasRecentlyOptimized(url, days = 7) {
  const memory = readMemory()
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return memory.paginas_optimizadas_semana.some(
    entry => entry.url === url && new Date(entry.fecha).getTime() > cutoff
  )
}

function markOptimized(url, modulo) {
  const memory = readMemory()
  memory.paginas_optimizadas_semana.push({
    url,
    modulo,
    fecha: new Date().toISOString(),
  })
  saveMemory(memory)
}

// ── Paginas creadas ──

function markPageCreated(slug, query) {
  const memory = readMemory()
  memory.paginas_creadas_slugs.push({
    slug,
    query,
    fecha: new Date().toISOString(),
  })
  saveMemory(memory)
}

// ── URLs indexadas (cooldown 7 dias) ──

function wasRecentlyIndexed(url, days = 7) {
  const memory = readMemory()
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return memory.urls_indexadas_semana.some(
    entry => entry.url === url && new Date(entry.fecha).getTime() > cutoff
  )
}

function markIndexed(url, via) {
  const memory = readMemory()
  memory.urls_indexadas_semana.push({
    url,
    via,
    fecha: new Date().toISOString(),
  })
  saveMemory(memory)
}

// ── Content gaps (cooldown 2 semanas) ──

function wasGapProcessedRecently(query, days = 14) {
  const memory = readMemory()
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return memory.content_gaps_procesados.some(
    g => g.query === query && new Date(g.fecha).getTime() > cutoff
  )
}

function markGapProcessed(query, resultado) {
  const memory = readMemory()
  memory.content_gaps_procesados.push({
    query,
    resultado,
    fecha: new Date().toISOString(),
  })
  saveMemory(memory)
}

// ── Drafts ──

function addDraft(draft) {
  const memory = readMemory()
  memory.drafts_pendientes.push({
    ...draft,
    fecha: new Date().toISOString(),
  })
  saveMemory(memory)
}

function getDrafts() {
  return readMemory().drafts_pendientes
}

// ── Costos OpenAI ──

function trackCost(tokensUsed, costUsd) {
  const memory = readMemory()
  const currentMonth = new Date().toISOString().slice(0, 7)

  if (memory.costos_openai.mes_actual !== currentMonth) {
    memory.costos_openai = {
      mes_actual: currentMonth,
      acumulado_usd: 0,
      tokens_totales: 0,
      llamadas: 0,
    }
    memory.costo_openai_mes_usd = 0
  }

  memory.costos_openai.acumulado_usd += costUsd
  memory.costos_openai.tokens_totales += tokensUsed
  memory.costos_openai.llamadas += 1
  memory.costo_openai_semana_usd += costUsd
  memory.costo_openai_mes_usd = memory.costos_openai.acumulado_usd

  saveMemory(memory)
  return memory.costos_openai
}

function getCostPercentage() {
  const memory = readMemory()
  const limit = parseFloat(process.env.OPENAI_MONTHLY_LIMIT_USD) || 20
  const currentMonth = new Date().toISOString().slice(0, 7)

  if (memory.costos_openai.mes_actual !== currentMonth) {
    return { pct: 0, acumulado: 0, limite: limit }
  }

  return {
    pct: (memory.costos_openai.acumulado_usd / limit) * 100,
    acumulado: memory.costos_openai.acumulado_usd,
    limite: limit,
  }
}

/**
 * Determinar modulos permitidos segun presupuesto
 *   80% -> pausar Modulo 6 (generacion de paginas)
 *   95% -> solo Modulos 1, 2, 3 (sin GPT)
 *  100% -> solo notificar
 */
function getAllowedModules() {
  const { pct } = getCostPercentage()

  if (pct >= 100) {
    return { level: 'blocked', modules: [], reason: `Presupuesto agotado (${pct.toFixed(1)}%)` }
  }
  if (pct >= 95) {
    return { level: 'minimal', modules: [1, 2, 3], reason: `Solo modulos sin GPT (${pct.toFixed(1)}%)` }
  }
  if (pct >= 80) {
    return { level: 'limited', modules: [1, 2, 3, 4, 5, 7, 8, 9], reason: `Modulo 6 pausado (${pct.toFixed(1)}%)` }
  }
  return { level: 'full', modules: [1, 2, 3, 4, 5, 6, 7, 8, 9], reason: `Presupuesto OK (${pct.toFixed(1)}%)` }
}

// ── Limpieza ──

function cleanup() {
  const memory = readMemory()
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000

  memory.paginas_optimizadas_semana = memory.paginas_optimizadas_semana.filter(
    e => new Date(e.fecha).getTime() > thirtyDaysAgo
  )
  memory.content_gaps_procesados = memory.content_gaps_procesados.filter(
    e => new Date(e.fecha).getTime() > fourteenDaysAgo
  )
  memory.urls_indexadas_semana = memory.urls_indexadas_semana.filter(
    e => new Date(e.fecha).getTime() > (Date.now() - 7 * 24 * 60 * 60 * 1000)
  )

  saveMemory(memory)
}

function markExecution() {
  updateMemory('ultima_ejecucion', new Date().toISOString())
}

module.exports = {
  readMemory,
  saveMemory,
  updateMemory,
  getCurrentWeek,
  ensureCurrentWeek,
  wasRecentlyOptimized,
  markOptimized,
  markPageCreated,
  wasRecentlyIndexed,
  markIndexed,
  wasGapProcessedRecently,
  markGapProcessed,
  addDraft,
  getDrafts,
  trackCost,
  getCostPercentage,
  getAllowedModules,
  cleanup,
  markExecution,
  MEMORY_PATH,
}
