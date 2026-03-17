/**
 * IMPERIAL-AGENT v3: Modulo 9 — Reporte Ejecutivo Semanal
 *
 * GPT-4o genera reporte con formato v2:
 *   - resumen_ejecutivo (3 lineas, solo numeros)
 *   - acciones_automaticas
 *   - drafts_pendientes
 *   - metricas (clics_google, clics_bing, impresiones, ctr, paginas, etc.)
 *   - geo (clics_copilot, paginas_citadas, queries_pregunta)
 *   - costos openai
 *   - proximas_3_acciones
 *
 * Envio: Guardado en ManhwaImperialAdmin/reports/ (CMS admin)
 */

const fs = require('fs')
const path = require('path')
const { AGENT } = require('../config/agentConfig')
const { gptCall } = require('../core/gptClient')
const { getActionsSummary, getDraftsSummary } = require('./autonomousExecutor')
const { getCostPercentage, getDrafts, readMemory } = require('../core/agentMemory')
const reportPrompt = require('../prompts/reportWriter.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const ADMIN_REPORTS_DIR = '/home/daniel/ManhwaImperialAdmin/reports'

function ensureAdminReportsDir() {
  if (!fs.existsSync(ADMIN_REPORTS_DIR)) {
    fs.mkdirSync(ADMIN_REPORTS_DIR, { recursive: true })
  }
}

/**
 * Recopilar datos consolidados de la semana
 */
function collectWeeklyData() {
  const analysisFiles = {
    quick_wins: 'quick_wins_unificado.json',
    content_gaps: 'content_gaps_cross.json',
    monitor_caida: 'monitor_caida_dual.json',
    ctr_comparativo: 'ctr_comparativo.json',
    auditoria: 'auditoria_tecnica.json',
    smart_indexer: 'smart_indexer_results.json',
  }

  const analysis = {}
  for (const [key, filename] of Object.entries(analysisFiles)) {
    const filePath = path.join(REPORTS_DIR, filename)
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        analysis[key] = {
          total: Array.isArray(data) ? data.length : 0,
          top_3: Array.isArray(data) ? data.slice(0, 3) : [],
        }
      } catch { analysis[key] = null }
    }
  }

  const actions = getActionsSummary()
  const drafts = getDraftsSummary()
  const memory = readMemory()
  const cost = getCostPercentage()
  const pendingDrafts = getDrafts()

  return {
    fecha: new Date().toISOString(),
    analisis: analysis,
    acciones_agente: actions,
    drafts_agente: drafts,
    drafts_pendientes: pendingDrafts,
    costos: {
      semana_usd: memory.costo_openai_semana_usd || 0,
      mes_usd: cost.acumulado,
      limite_usd: cost.limite,
      pct: cost.pct,
    },
  }
}

/**
 * Generar y enviar reporte semanal
 */
async function runReportWriter() {
  console.log('  [M9] Reporte Ejecutivo Semanal...\n')

  const weeklyData = collectWeeklyData()

  if (!AGENT.OPENAI_API_KEY) {
    console.warn('  [M9] OPENAI_API_KEY no configurada. Reporte basico.')
    const basicReport = generateBasicReport(weeklyData)
    await sendReport(basicReport)
    return { status: 'basic', report: basicReport }
  }

  // GPT-4o genera reporte v2
  const aiResponse = await gptCall(
    reportPrompt.getSystemPrompt(),
    reportPrompt.getUserPrompt(weeklyData),
    { moduleNumber: 9, maxTokens: 3000 }
  )

  if (!aiResponse.parsed) {
    console.warn('  [M9] IA no devolvio reporte valido. Usando basico.')
    const basicReport = generateBasicReport(weeklyData)
    await sendReport(basicReport)
    return { status: 'fallback', report: basicReport }
  }

  const report = aiResponse.parsed
  report.generado_por = 'IMPERIAL-AGENT-v3'
  report.tokens_used = aiResponse.tokens_used
  report.cost_usd = aiResponse.cost_usd

  // Guardar reporte
  const reportPath = path.join(REPORTS_DIR, 'reporte_semanal_v2.json')
  const tmpPath = reportPath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(report, null, 2), 'utf-8')
  fs.renameSync(tmpPath, reportPath)
  console.log(`  [M9] Reporte guardado: ${reportPath}`)

  await sendReport(report)
  return { status: 'completed', report }
}

/**
 * Reporte basico sin IA (fallback)
 */
function generateBasicReport(weeklyData) {
  const { acciones_agente, costos } = weeklyData
  return {
    resumen_ejecutivo: `Semana ${new Date().toISOString().split('T')[0]}: ${acciones_agente?.total_acciones_semana || 0} acciones. Costo: $${(costos?.semana_usd || 0).toFixed(2)}.`,
    acciones_automaticas: [],
    drafts_pendientes: [],
    metricas: {},
    geo: {},
    costo_openai_semana_usd: costos?.semana_usd || 0,
    costo_openai_mes_usd: costos?.mes_usd || 0,
    alerta_costos: costos?.pct >= 80 ? `Presupuesto al ${costos.pct.toFixed(1)}%` : null,
    proximas_3_acciones: [],
    generado_por: 'fallback',
  }
}

/**
 * Guardar reporte en ManhwaImperialAdmin/reports/ (CMS admin)
 */
async function sendReport(report) {
  ensureAdminReportsDir()
  const fecha = new Date().toISOString().split('T')[0]

  const reportData = {
    ...report,
    tipo: 'reporte_ejecutivo_semanal',
    fecha_generacion: new Date().toISOString(),
  }

  // Guardar con fecha y como latest
  const filePath = path.join(ADMIN_REPORTS_DIR, `reporte_ejecutivo_${fecha}.json`)
  const latestPath = path.join(ADMIN_REPORTS_DIR, 'reporte_ejecutivo_latest.json')

  for (const dest of [filePath, latestPath]) {
    const tmpPath = dest + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(reportData, null, 2), 'utf-8')
    fs.renameSync(tmpPath, dest)
  }

  console.log(`  [M9] Reporte guardado en admin: ${filePath}`)
}

module.exports = { runReportWriter }
