/**
 * IA-AGENT: Decisor Autónomo de Prioridades
 *
 * Recopila output de TODOS los módulos de análisis y la IA genera
 * un plan de acción priorizado por ROI de tráfico orgánico.
 *
 * El agente ejecuta automáticamente las acciones del plan
 * llamando a los módulos correspondientes en orden de prioridad.
 */

const fs = require('fs')
const path = require('path')
const { AGENT } = require('../config/agentConfig')
const { callAI } = require('./aiReasoner')
const { logAction, readJsonSafe, writeJsonAtomic } = require('./autonomousExecutor')
const priorityPrompt = require('../prompts/priorityDecider.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const PLAN_PATH = path.resolve(__dirname, '..', 'logs', 'plan_semanal.json')

/**
 * IA-AGENT: Recopilar todos los datos disponibles de los módulos
 */
function collectAllReports() {
  const files = {
    quick_wins: 'quick_wins_unificado.json',
    content_gaps: 'content_gaps_cross.json',
    monitor_caida: 'monitor_caida_dual.json',
    auditoria_tecnica: 'auditoria_tecnica.json',
    ctr_comparativo: 'ctr_comparativo.json',
    ai_overview: 'ai_overview_sospecha.json',
    copilot: 'copilot_cannibalization.json',
    backlinks: 'link_building_oportunidades.json',
    smart_indexer: 'smart_indexer_results.json',
  }

  const data = {}
  for (const [key, filename] of Object.entries(files)) {
    const filePath = path.join(REPORTS_DIR, filename)
    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        // IA-AGENT: Enviar solo resumen (top 10) para no exceder tokens
        data[key] = Array.isArray(raw) ? raw.slice(0, 10) : raw
      } catch {
        data[key] = null
      }
    } else {
      data[key] = null
    }
  }

  return data
}

/**
 * IA-AGENT: Generar plan de acción priorizado con IA
 *
 * @returns {Promise<Object>} Plan de acción estructurado
 */
async function runPriorityDecider() {
  console.log('🧠 Decisor Autónomo de Prioridades (IA)...\n')

  if (!AGENT.AI_API_KEY) {
    console.warn('  ⚠ AI_API_KEY no configurada. Módulo desactivado.')
    return { status: 'disabled', reason: 'AI_API_KEY not set' }
  }

  // CAPA 1: Recopilar todos los datos
  const allData = collectAllReports()
  const hasData = Object.values(allData).some(v => v !== null)

  if (!hasData) {
    console.warn('  ⚠ No hay datos de análisis disponibles. Ejecutar pipeline de análisis primero.')
    return { status: 'no_data' }
  }

  console.log(`  → Datos disponibles: ${Object.entries(allData).filter(([, v]) => v !== null).map(([k]) => k).join(', ')}\n`)

  // CAPA 2: Pedir a la IA que genere el plan
  const systemPrompt = priorityPrompt.getSystemPrompt()
  const userPrompt = priorityPrompt.getUserPrompt(allData)

  const aiResponse = await callAI(systemPrompt, userPrompt, { maxTokens: 3000 })

  if (aiResponse.budget_exceeded) {
    console.warn('  ⚠ Presupuesto semanal agotado.')
    return { status: 'budget_exceeded' }
  }

  if (!aiResponse.parsed || !aiResponse.parsed.plan) {
    console.error('  ❌ IA no devolvió un plan válido.')
    return { status: 'ai_error', raw: aiResponse.raw }
  }

  const plan = aiResponse.parsed

  // AUTO-EXEC: Guardar plan en disco
  writeJsonAtomic(PLAN_PATH, {
    timestamp: new Date().toISOString(),
    tokens_used: aiResponse.tokens_used,
    cost_usd: aiResponse.cost_usd,
    ...plan,
  })

  // AUTO-EXEC: Registrar en log maestro
  logAction({
    modulo: 'priorityDecider',
    accion: 'plan_generado',
    confidence_score: plan.confidence_score || 0,
    tokens_ia_usados: aiResponse.tokens_used,
    costo_estimado_usd: aiResponse.cost_usd,
    resultado: 'exitoso',
    razon_ia: plan.resumen_ejecutivo,
    acciones_plan: plan.plan?.length || 0,
  })

  // Mostrar plan
  console.log('  📋 PLAN DE ACCIÓN GENERADO:\n')
  if (plan.resumen_ejecutivo) {
    console.log(`  Resumen: ${plan.resumen_ejecutivo}\n`)
  }

  for (const [i, accion] of (plan.plan || []).entries()) {
    const icon = accion.prioridad === 'inmediata' ? '🔴' : accion.prioridad === 'mensual' ? '🟡' : '🔵'
    console.log(`  ${icon} ${i + 1}. [${accion.prioridad}] ${accion.que_hacer}`)
    console.log(`     → Por qué: ${accion.por_que}`)
    console.log(`     → Impacto: +${accion.impacto_estimado_clics_semana} clics/semana | Módulo: ${accion.modulo}\n`)
  }

  return {
    status: 'completed',
    plan: plan.plan,
    resumen: plan.resumen_ejecutivo,
    confidence: plan.confidence_score,
    tokens_used: aiResponse.tokens_used,
    cost_usd: aiResponse.cost_usd,
  }
}

/**
 * IA-AGENT: Ejecutar las acciones inmediatas del plan
 * Llama a los módulos correspondientes según lo que decidió la IA
 *
 * @param {Object} plan - Plan generado por runPriorityDecider
 * @returns {Promise<Object>} Resultado de ejecución
 */
async function executePlan(plan) {
  if (!plan?.plan) return { status: 'no_plan' }

  const immediate = plan.plan.filter(a => a.prioridad === 'inmediata')
  console.log(`\n  🚀 Ejecutando ${immediate.length} acciones inmediatas del plan...\n`)

  const results = []

  for (const action of immediate) {
    console.log(`  → Ejecutando: ${action.que_hacer} (módulo: ${action.modulo})`)

    // IA-AGENT: Despachar al módulo correspondiente
    // Los módulos se importan dinámicamente para evitar dependencias circulares
    try {
      let result
      switch (action.modulo) {
        case 'quickWinsOptimizer': {
          const { runQuickWinsOptimizer } = require('./quickWinsOptimizer')
          result = await runQuickWinsOptimizer()
          break
        }
        case 'contentGapsGenerator': {
          const { runContentGapsGenerator } = require('./contentGapsGenerator')
          result = await runContentGapsGenerator()
          break
        }
        case 'schemaOptimizer': {
          const { runSchemaOptimizer } = require('./schemaOptimizer')
          result = await runSchemaOptimizer()
          break
        }
        case 'smartIndexer': {
          const { runSmartIndexer } = require('./smartIndexer')
          result = await runSmartIndexer()
          break
        }
        default:
          console.warn(`    ⚠ Módulo desconocido: ${action.modulo}`)
          result = { status: 'unknown_module' }
      }

      results.push({ action: action.que_hacer, modulo: action.modulo, result })
    } catch (err) {
      console.error(`    ❌ Error ejecutando ${action.modulo}: ${err.message}`)
      results.push({ action: action.que_hacer, modulo: action.modulo, error: err.message })
    }
  }

  return { status: 'completed', executed: results.length, results }
}

module.exports = { runPriorityDecider, executePlan }
