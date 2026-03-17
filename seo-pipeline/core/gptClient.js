/**
 * IMPERIAL-AGENT v3: Cliente GPT-4o con control de costos
 *
 * Wrapper sobre aiReasoner con presupuesto mensual.
 * Al 80% -> pausar Modulo 6
 * Al 95% -> solo Modulos 1, 2, 3
 * Al 100% -> cero llamadas
 */

const { callAI, canMakeCall, getUsageSummary, parseAiJson } = require('../modules/aiReasoner')
const { trackCost, getCostPercentage, getAllowedModules } = require('./agentMemory')

/**
 * Llamar a GPT-4o con control de presupuesto mensual
 *
 * @param {string} systemPrompt - Prompt de sistema
 * @param {string} userPrompt - Prompt de usuario
 * @param {Object} [options]
 * @param {number} [options.moduleNumber] - Numero de modulo (para control de costos)
 * @param {number} [options.maxTokens] - Max tokens override
 * @param {number} [options.temperature] - Temperature override
 * @returns {Promise<Object>} { parsed, raw, tokens_used, cost_usd, budget_blocked }
 */
async function gptCall(systemPrompt, userPrompt, options = {}) {
  const moduleNumber = options.moduleNumber || 0

  // Verificar presupuesto mensual
  const allowed = getAllowedModules()

  if (allowed.level === 'blocked') {
    console.warn(`  [IMPERIAL-AGENT] ${allowed.reason}. Llamada bloqueada.`)
    return { parsed: null, raw: '', tokens_used: 0, cost_usd: 0, budget_blocked: true }
  }

  if (moduleNumber > 0 && !allowed.modules.includes(moduleNumber)) {
    console.warn(`  [IMPERIAL-AGENT] Modulo ${moduleNumber} no permitido. ${allowed.reason}`)
    return { parsed: null, raw: '', tokens_used: 0, cost_usd: 0, budget_blocked: true }
  }

  // Llamar al motor de IA
  const result = await callAI(systemPrompt, userPrompt, options)

  // Registrar costo en memoria
  if (result.tokens_used > 0) {
    trackCost(result.tokens_used, result.cost_usd)
  }

  return result
}

/**
 * Obtener estado del presupuesto
 */
function getBudgetStatus() {
  const monthly = getCostPercentage()
  const weekly = getUsageSummary()
  const allowed = getAllowedModules()

  return { monthly, weekly, allowed }
}

module.exports = { gptCall, getBudgetStatus, parseAiJson }
