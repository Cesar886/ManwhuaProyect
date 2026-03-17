/**
 * IMPERIAL-AGENT v2: Motor de Razonamiento IA
 *
 * Soporta OpenAI (GPT-4o) y Anthropic (Claude).
 * Incluye retry exponencial, tracking de tokens y rate limiting.
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { AGENT } = require('../config/agentConfig')

const COST_LOG_PATH = path.resolve(__dirname, '..', 'logs', 'costo_ia_mensual.json')
const WEEKLY_USAGE_PATH = path.resolve(__dirname, '..', 'logs', 'uso_semanal_tokens.json')

// Resolver API key y proveedor (v2 usa OPENAI_API_KEY, v1 usa AI_API_KEY)
function getApiKey() {
  return AGENT.OPENAI_API_KEY || process.env.AI_API_KEY || ''
}

function getProvider() {
  if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER
  // v2 defaults to openai
  return 'openai'
}

function getModel() {
  return AGENT.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o'
}

function getMaxTokens() {
  return AGENT.OPENAI_MAX_TOKENS || parseInt(process.env.AI_MAX_TOKENS) || 4096
}

function getTemperature() {
  return AGENT.OPENAI_TEMPERATURE ?? parseFloat(process.env.AI_TEMPERATURE) ?? 0.3
}

function getWeeklyTokenLimit() {
  return parseInt(process.env.AI_WEEKLY_TOKEN_LIMIT) || 500000
}

function getCostPer1kTokens() {
  return parseFloat(process.env.AI_COST_PER_1K_TOKENS) || 0.003
}

// Uso semanal de tokens
function getWeekNumber() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now - start
  return `${now.getFullYear()}-W${Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)}`
}

function readWeeklyUsage() {
  try {
    if (fs.existsSync(WEEKLY_USAGE_PATH)) {
      const data = JSON.parse(fs.readFileSync(WEEKLY_USAGE_PATH, 'utf-8'))
      const currentWeek = getWeekNumber()
      if (data.week !== currentWeek) {
        return { week: currentWeek, tokens_used: 0, cost_usd: 0, calls: 0 }
      }
      return data
    }
  } catch { /* corrupto */ }
  return { week: getWeekNumber(), tokens_used: 0, cost_usd: 0, calls: 0 }
}

function saveWeeklyUsage(usage) {
  const dir = path.dirname(WEEKLY_USAGE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(WEEKLY_USAGE_PATH, JSON.stringify(usage, null, 2), 'utf-8')
}

function logMonthlyCost(tokensUsed, costUsd) {
  const dir = path.dirname(COST_LOG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  let costLog = { entries: [], total_cost_usd: 0, total_tokens: 0 }
  try {
    if (fs.existsSync(COST_LOG_PATH)) {
      costLog = JSON.parse(fs.readFileSync(COST_LOG_PATH, 'utf-8'))
    }
  } catch { /* nuevo */ }

  const month = new Date().toISOString().slice(0, 7)
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

function canMakeCall(estimatedTokens = 2000) {
  const usage = readWeeklyUsage()
  const limit = getWeeklyTokenLimit()
  const projectedUsage = usage.tokens_used + estimatedTokens
  return {
    allowed: projectedUsage <= limit,
    usage_pct: (usage.tokens_used / limit) * 100,
    tokens_remaining: limit - usage.tokens_used,
    pause_generation: (usage.tokens_used / limit) >= 0.80,
  }
}

// Parsear JSON de respuesta IA (tolerante a markdown)
function parseAiJson(text) {
  try { return JSON.parse(text) } catch { /* limpiar */ }

  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1].trim()) } catch { /* continuar */ }
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)) } catch { /* fallo */ }
  }

  return null
}

/**
 * Llamar a la API de IA con prompt estructurado
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
  const maxTokens = options.maxTokens || getMaxTokens()
  const temperature = options.temperature ?? getTemperature()
  const retries = options.retries || 0
  const maxRetries = 3

  const budget = canMakeCall(maxTokens)
  if (!budget.allowed) {
    console.warn(`  [IA] Limite semanal de tokens alcanzado (${budget.usage_pct.toFixed(1)}%).`)
    return { parsed: null, raw: '', tokens_used: 0, cost_usd: 0, budget_exceeded: true }
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return { parsed: null, raw: '', tokens_used: 0, cost_usd: 0, error: 'No API key configured' }
  }

  try {
    let rawText = ''
    let tokensUsed = 0
    const provider = getProvider()
    const model = getModel()

    if (provider === 'anthropic') {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 60000,
      })

      rawText = response.data.content?.[0]?.text || ''
      tokensUsed = (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0)

    } else {
      // OpenAI (default for v2)
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      })

      rawText = response.data.choices?.[0]?.message?.content || ''
      tokensUsed = response.data.usage?.total_tokens || 0
    }

    // Registrar uso
    const costUsd = (tokensUsed / 1000) * getCostPer1kTokens()
    const usage = readWeeklyUsage()
    usage.tokens_used += tokensUsed
    usage.cost_usd += costUsd
    usage.calls += 1
    saveWeeklyUsage(usage)
    logMonthlyCost(tokensUsed, costUsd)

    const parsed = parseAiJson(rawText)
    return { parsed, raw: rawText, tokens_used: tokensUsed, cost_usd: costUsd }

  } catch (err) {
    if (retries < maxRetries) {
      const waitMs = 1000 * Math.pow(2, retries)
      console.warn(`  [IA] Error (intento ${retries + 1}/${maxRetries}): ${err.message}. Reintentando en ${waitMs}ms...`)
      await new Promise(r => setTimeout(r, waitMs))
      return callAI(systemPrompt, userPrompt, { ...options, retries: retries + 1 })
    }

    console.error(`  [IA] Fallo tras ${maxRetries} reintentos: ${err.message}`)
    return { parsed: null, raw: '', tokens_used: 0, cost_usd: 0, error: err.message }
  }
}

function shouldPauseGeneration() {
  const budget = canMakeCall(0)
  return budget.pause_generation
}

function getUsageSummary() {
  const weekly = readWeeklyUsage()
  const limit = getWeeklyTokenLimit()
  let monthly = { total_cost_usd: 0, total_tokens: 0 }
  try {
    if (fs.existsSync(COST_LOG_PATH)) {
      monthly = JSON.parse(fs.readFileSync(COST_LOG_PATH, 'utf-8'))
    }
  } catch { /* */ }

  return {
    weekly: {
      tokens_used: weekly.tokens_used,
      tokens_limit: limit,
      usage_pct: ((weekly.tokens_used / limit) * 100).toFixed(1) + '%',
      cost_usd: (weekly.cost_usd || 0).toFixed(4),
      calls: weekly.calls,
    },
    monthly: {
      total_tokens: monthly.total_tokens,
      total_cost_usd: (monthly.total_cost_usd || 0).toFixed(4),
    },
  }
}

module.exports = { callAI, canMakeCall, shouldPauseGeneration, getUsageSummary, parseAiJson }
