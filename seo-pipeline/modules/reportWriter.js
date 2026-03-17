/**
 * IMPERIAL-AGENT v2: Modulo 9 — Reporte Ejecutivo Semanal
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
 * Envio: Email HTML via nodemailer + Telegram <=280 chars
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const nodemailer = require('nodemailer')
const { AGENT } = require('../config/agentConfig')
const { gptCall } = require('../core/gptClient')
const { getActionsSummary, getDraftsSummary } = require('./autonomousExecutor')
const { getCostPercentage, getDrafts, readMemory } = require('../core/agentMemory')
const reportPrompt = require('../prompts/reportWriter.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')

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
  report.generado_por = 'IMPERIAL-AGENT-v2'
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
 * Enviar reporte por Telegram + Email
 */
async function sendReport(report) {
  // Telegram: max 280 chars
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      let text = report.resumen_ejecutivo || 'Reporte semanal disponible.'
      if (text.length > 280) text = text.slice(0, 277) + '...'

      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `IMPERIAL-AGENT v2 | Reporte Semanal\n\n${text}`,
        parse_mode: 'HTML',
      })
      console.log('  [M9] Telegram enviado')
    } catch (err) {
      console.error(`  [M9] Error Telegram: ${err.message}`)
    }
  }

  // Email HTML
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && (process.env.SMTP_TO || process.env.NOTIFICATION_EMAIL)) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })

      const htmlBody = buildEmailHtml(report)
      const to = process.env.SMTP_TO || process.env.NOTIFICATION_EMAIL

      await transporter.sendMail({
        from: `"IMPERIAL-AGENT v2" <${process.env.SMTP_USER}>`,
        to,
        subject: `Reporte SEO Semanal — ${new Date().toISOString().split('T')[0]}`,
        html: htmlBody,
      })
      console.log('  [M9] Email enviado')
    } catch (err) {
      console.error(`  [M9] Error Email: ${err.message}`)
    }
  }
}

function buildEmailHtml(report) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px}
h1{color:#333;border-bottom:2px solid #e74c3c;padding-bottom:10px}
h2{color:#e74c3c}
.metric{background:#f5f5f5;padding:10px;margin:5px 0;border-radius:4px}
.alert{background:#fff3cd;padding:10px;border-radius:4px}
</style></head>
<body>
<h1>IMPERIAL-AGENT v2 | Reporte Semanal</h1>
<h2>Resumen</h2>
<p>${report.resumen_ejecutivo || 'Sin datos'}</p>
${report.metricas ? `<h2>Metricas</h2><pre>${JSON.stringify(report.metricas, null, 2)}</pre>` : ''}
${report.geo ? `<h2>GEO</h2><pre>${JSON.stringify(report.geo, null, 2)}</pre>` : ''}
${report.alerta_costos ? `<div class="alert"><strong>Alerta:</strong> ${report.alerta_costos}</div>` : ''}
${report.proximas_3_acciones?.length ? `<h2>Proximas Acciones</h2><pre>${JSON.stringify(report.proximas_3_acciones, null, 2)}</pre>` : ''}
<hr><p style="color:#999;font-size:12px">Generado por IMPERIAL-AGENT v2 | ${new Date().toISOString()}</p>
</body></html>`
}

module.exports = { runReportWriter }
