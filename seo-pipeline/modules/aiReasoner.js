/**
 * IA-AGENT: Motor de Razonamiento con IA — Capa 2 del Agente Autónomo
 *
 * Envía prompts estructurados a la API de IA (Anthropic/OpenAI) y
 * devuelve respuestas parseadas con confidence_score.
 *
 * Funcionalidades:
 *   - Llamadas a API con retry exponencial
 *   - Tracking de tokens consumidos para control de costos
 *   - Parseo seguro de JSON desde respuestas de IA
 *   - Rate limiting interno para no exceder límites semanales
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { AGENT } = require('../config/agentConfig')

const COST_LOG_PATH = path.resolve(process.env.REPORTS_DIR || './reports', '..', 'logs', 'costo_ia_mensual.json')
const WEEKLY_USAGE_PATH = path.resolve(process.env.REPORTS_DIR || './reports', '..', 'logs', 'uso_semanal_tokens.json')

// IA-AGENT: Leer uso acumulado de tokens esta semana
function readWeeklyUsage() {
  try {
    if (fs.existsSync(WEEKLY_USAGE_PATH)) {
      const data = JSON.parse(fs.readFileSync(WEEKLY_USAGE_PATH, 'utf-8'))
      // Resetear si la semana cambió
      const currentWeek = getWeekNumber()
      if (data.week !== currentWeek) {
        return { week: currentWeek, tokens_used: 0, cost_usd: 0, calls: 0 }
      }
      return data
    }
  } catch { /* archivo corrupto */ }
  return { week: getWeekNumber(), tokens_used: 0, cost_usd: 0, calls: 0 }
}

// IA-AGENT: Guardar uso de tokens
function saveWeeklyUsage(usage) {
  const dir = path.dirname(WEEKLY_USAGE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(WEEKLY_USAGE_PATH, JSON.stringify(usage, null, 2), 'utf-8')
}

// IA-AGENT: Registrar costo mensual acumulado
function logMonthlyCost(tokensUsed, costUsd) {
  const dir = path.dirname(COST_LOG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  let costLog = { entries: [], total_cost_usd: 0, total_tokens: 0 }
  try {
    if (fs.existsSync(COST_LOG_PATH)) {
      costLog = JSON.parse(fs.readFileSync(COST_LOG_PATH, 'utf-8'))
    }
  } catch { /* nuevo archivo */ }

  const month = new Date().toISOString().slice(0, 7) // YYYY-MM
  let monthEntry = costLog.entries.find(e => e.month === month)
  if (!monthEntry) {
    monthEntry = { month, tokens: 0, cost_usd: 0, calls: 0 }
    costLog.entries.push(monthEntry)
  }
  monthEntry.tokens += tokensUsed
  monthEntry.cost_usd += costUsd
  monthEntry.calls += 1

  costLog.total_tokens = costLog.entries.reduce((sum, e) => sum + e.tokens, 0)
  costLog.total_cost_usd = costLog.entries.reduce((sum, e) => sum + e.cost_usd, 0)

  fs.writeFileSync(COST_LOG_PATH, JSON.stringify(costLog, null, 2), 'utf-8')
}

function getWeekNumber() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now - start
  return `${now.getFullYear()}-W${Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)}`
}

// IA-AGENT: Verificar si se puede hacer una llamada (límite semanal)
function canMakeCall(estimatedTokens = 2000) {
  const usage = readWeeklyUsage()
  const projectedUsage = usage.tokens_used + estimatedTokens
  return {
    allowed: projectedUsage <= AGENT.WEEKLY_TOKEN_LIMIT,
    usage_pct: (usage.tokens_used / AGENT.WEEKLY_TOKEN_LIMIT) * 100,
    tokens_remaining: AGENT.WEEKLY_TOKEN_LIMIT - usage.tokens_used,
    pause_generation: (usage.tokens_used / AGENT.WEEKLY_TOKEN_LIMIT) >= AGENT.COST_PAUSE_THRESHOLD,
  }
}

// IA-AGENT: Parsear JSON de respuesta de IA (tolerante a markdown code blocks)
function parseAiJson(text) {
  // Intentar parsear directamente
  try {
    return JSON.parse(text)
  } catch { /* intentar limpiar */ }

  // Remover bloques de código markdown
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim())
    } catch { /* continuar */ }
  }

  // Buscar primer { ... último }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1))
    } catch { /* falló */ }
  }

  return null
}

/**
 * IA-AGENT: Llamar a la API de IA con prompt estructurado
 *
 * @param {string} systemPrompt - Prompt de sistema
 * @param {string} userPrompt - Prompt de usuario
 * @param {Object} [options] - Opciones adicionales
 * @param {number} [options.maxTokens] - Máximo de tokens en la respuesta
 * @param {number} [options.temperature] - Temperatura (0-1)
 * @param {number} [options.retries] - Reintentos actuales (interno)
 * @returns {Promise<{parsed: Object|null, raw: string, tokens_used: number, cost_usd: number}>}
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
  const maxTokens = options.maxTokens || AGENT.AI_MAX_TOKENS
  const temperature = options.temperature ?? AGENT.AI_TEMPERATURE
  const retries = options.retries || 0
  const maxRetries = 3

  // IA-AGENT: Verificar límite de tokens semanales
  const budget = canMakeCall(maxTokens)
  if (!budget.allowed) {
    console.warn(`  ⚠ IA-AGENT: Límite semanal de tokens alcanzado (${budget.usage_pct.toFixed(1)}%). Llamada rechazada.`)
    return { parsed: null, raw: '', tokens_used: 0, cost_usd: 0, budget_exceeded: true }
  }

  try {
    let response
    let tokensUsed = 0
    let rawText = ''

    if (AGENT.AI_PROVIDER === 'anthropic') {
      // IA-AGENT: Llamada a Anthropic Messages API
      response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: AGENT.AI_MODEL,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }, {
        headers: {
          'x-api-key': AGENT.AI_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 60000,
      })

      rawText = response.data.content?.[0]?.text || ''
      tokensUsed = (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0)

    } else if (AGENT.AI_PROVIDER === 'openai') {
      // IA-AGENT: Llamada a OpenAI Chat Completions API
      response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: AGENT.AI_MODEL,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }, {
        headers: {
          Authorization: `Bearer ${AGENT.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      })

      rawText = response.data.choices?.[0]?.message?.content || ''
      tokensUsed = response.data.usage?.total_tokens || 0
    } else {
      throw new Error(`IA-AGENT: Proveedor no soportado: ${AGENT.AI_PROVIDER}`)
    }

    // IA-AGENT: Registrar uso de tokens
    const costUsd = (tokensUsed / 1000) * AGENT.COST_PER_1K_TOKENS
    const usage = readWeeklyUsage()
    usage.tokens_used += tokensUsed
    usage.cost_usd += costUsd
    usage.calls += 1
    saveWeeklyUsage(usage)
    logMonthlyCost(tokensUsed, costUsd)

    // IA-AGENT: Parsear respuesta JSON
    const parsed = parseAiJson(rawText)

    return { parsed, raw: rawText, tokens_used: tokensUsed, cost_usd: costUsd }

  } catch (err) {
    // IA-AGENT: Retry con backoff exponencial
    if (retries < maxRetries) {
      const waitMs = 1000 * Math.pow(2, retries)
      console.warn(`  ⚠ IA-AGENT: Error en llamada (intento ${retries + 1}/${maxRetries}): ${err.message}. Reintentando en ${waitMs}ms...`)
      await new Promise(r => setTimeout(r, waitMs))
      return callAI(systemPrompt, userPrompt, { ...options, retries: retries + 1 })
    }

    console.error(`  ❌ IA-AGENT: Fallo tras ${maxRetries} reintentos: ${err.message}`)
    return { parsed: null, raw: '', tokens_used: 0, cost_usd: 0, error: err.message }
  }
}

/**
 * IA-AGENT: Verificar si la generación de páginas debe pausarse (control de costos)
 */
function shouldPauseGeneration() {
  const budget = canMakeCall(0)
  return budget.pause_generation
}

/**
 * IA-AGENT: Obtener resumen de uso de tokens
 */
function getUsageSummary() {
  const weekly = readWeeklyUsage()
  let monthly = { total_cost_usd: 0, total_tokens: 0 }
  try {
    if (fs.existsSync(COST_LOG_PATH)) {
      monthly = JSON.parse(fs.readFileSync(COST_LOG_PATH, 'utf-8'))
    }
  } catch { /* */ }

  return {
    weekly: {
      tokens_used: weekly.tokens_used,
      tokens_limit: AGENT.WEEKLY_TOKEN_LIMIT,
      usage_pct: ((weekly.tokens_used / AGENT.WEEKLY_TOKEN_LIMIT) * 100).toFixed(1) + '%',
      cost_usd: weekly.cost_usd.toFixed(4),
      calls: weekly.calls,
    },
    monthly: {
      total_tokens: monthly.total_tokens,
      total_cost_usd: monthly.total_cost_usd?.toFixed(4) || '0.0000',
    },
  }
}

module.exports = { callAI, canMakeCall, shouldPauseGeneration, getUsageSummary, parseAiJson }
