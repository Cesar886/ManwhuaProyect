/**
 * IA-AGENT: Redactor Autónomo del Reporte Semanal
 *
 * Recopila todos los datos de la semana (análisis + acciones del agente)
 * y la IA genera un reporte ejecutivo con predicciones.
 *
 * Envío: Email HTML + Telegram resumido (280 chars)
 */

const fs = require('fs')
const path = require('path')
const { AGENT } = require('../config/agentConfig')
const { callAI, getUsageSummary } = require('./aiReasoner')
const { getActionsSummary, getDraftsSummary } = require('./autonomousExecutor')
const { notify } = require('../notifications/notifier')
const reportPrompt = require('../prompts/reportWriter.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const LOGS_DIR = path.resolve(__dirname, '..', 'logs')

/**
 * IA-AGENT: Recopilar todos los datos de la semana para el reporte
 */
function collectWeeklyData() {
  // Datos de análisis
  const analysisFiles = {
    quick_wins: 'quick_wins_unificado.json',
    content_gaps: 'content_gaps_cross.json',
    monitor_caida: 'monitor_caida_dual.json',
    ctr_comparativo: 'ctr_comparativo.json',
  }

  const analysis = {}
  for (const [key, filename] of Object.entries(analysisFiles)) {
    const filePath = path.join(REPORTS_DIR, filename)
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        // Resumen: solo contar y top 3
        analysis[key] = {
          total: Array.isArray(data) ? data.length : 0,
          top_3: Array.isArray(data) ? data.slice(0, 3) : [],
        }
      } catch { analysis[key] = null }
    }
  }

  // Datos de acciones del agente
  const actions = getActionsSummary()
  const drafts = getDraftsSummary()
  const usage = getUsageSummary()

  // Plan semanal si existe
  const planPath = path.join(LOGS_DIR, 'plan_semanal.json')
  let plan = null
  if (fs.existsSync(planPath)) {
    try { plan = JSON.parse(fs.readFileSync(planPath, 'utf-8')) } catch { /* */ }
  }

  return {
    fecha: new Date().toISOString(),
    analisis: analysis,
    acciones_agente: actions,
    drafts_pendientes: drafts,
    uso_ia: usage,
    plan_actual: plan,
  }
}

/**
 * IA-AGENT: Generar y enviar reporte semanal con IA
 *
 * @returns {Promise<Object>} Reporte generado
 */
async function runReportWriter() {
  console.log('📝 Redactor Autónomo de Reporte Semanal (IA)...\n')

  // Recopilar datos
  const weeklyData = collectWeeklyData()

  // Si no hay API key de IA, generar reporte básico sin IA
  if (!AGENT.AI_API_KEY) {
    console.warn('  ⚠ AI_API_KEY no configurada. Generando reporte básico sin IA.')
    const basicReport = generateBasicReport(weeklyData)
    await sendReport(basicReport)
    return { status: 'basic', report: basicReport }
  }

  // CAPA 2: Pedir a la IA que redacte el reporte
  const systemPrompt = reportPrompt.getSystemPrompt()
  const userPrompt = reportPrompt.getUserPrompt(weeklyData)

  const aiResponse = await callAI(systemPrompt, userPrompt, { maxTokens: 3000 })

  if (!aiResponse.parsed) {
    console.warn('  ⚠ IA no devolvió reporte válido. Usando reporte básico.')
    const basicReport = generateBasicReport(weeklyData)
    await sendReport(basicReport)
    return { status: 'fallback', report: basicReport }
  }

  const report = aiResponse.parsed
  report.generado_por = 'ia'
  report.tokens_used = aiResponse.tokens_used
  report.cost_usd = aiResponse.cost_usd

  // Guardar reporte
  const reportPath = path.join(REPORTS_DIR, 'reporte_semanal_ia.json')
  const tmpPath = reportPath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(report, null, 2), 'utf-8')
  fs.renameSync(tmpPath, reportPath)
  console.log(`  💾 Reporte guardado: ${reportPath}`)

  // Enviar por Telegram y Email
  await sendReport(report)

  return { status: 'completed', report }
}

/**
 * IA-AGENT: Generar reporte básico sin IA (fallback)
 */
function generateBasicReport(weeklyData) {
  const { acciones_agente, drafts_pendientes, uso_ia } = weeklyData

  return {
    resumen: `Semana ${new Date().toISOString().split('T')[0]}: ${acciones_agente.total_acciones_semana} acciones ejecutadas, ${acciones_agente.publicadas} publicadas, ${acciones_agente.drafts} drafts.`,
    acciones_automaticas: [`${acciones_agente.publicadas} optimizaciones publicadas`, `${acciones_agente.drafts} guardadas como draft`],
    drafts_pendientes: [`${drafts_pendientes.titles_pendientes} titles`, `${drafts_pendientes.paginas_pendientes} páginas`],
    metricas_clave: {
      acciones_semana: acciones_agente.total_acciones_semana,
      tokens_usados: uso_ia.weekly?.tokens_used || 0,
      costo_semanal_usd: uso_ia.weekly?.cost_usd || '0.0000',
    },
    prediccion_proxima_semana: 'No disponible sin IA.',
    version_telegram: `📊 SEO Manhwa Imperial: ${acciones_agente.publicadas} optimizaciones, ${drafts_pendientes.titles_pendientes + drafts_pendientes.paginas_pendientes} drafts pendientes.`,
    generado_por: 'fallback',
  }
}

/**
 * IA-AGENT: Enviar reporte por Telegram y Email
 */
async function sendReport(report) {
  const axios = require('axios')
  const nodemailer = require('nodemailer')

  // Telegram: versión corta
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const text = report.version_telegram || report.resumen || 'Reporte semanal disponible.'
      const truncated = text.length > 4000 ? text.slice(0, 4000) + '...' : text
      await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: `📊 *Reporte SEO Semanal*\n\n${truncated}`,
        parse_mode: 'Markdown',
      })
      console.log('  ✅ Reporte enviado por Telegram')
    } catch (err) {
      console.error(`  ❌ Error Telegram: ${err.message}`)
    }
  }

  // Email: versión completa HTML
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_TO) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })

      const htmlBody = report.reporte_html || `<pre>${JSON.stringify(report, null, 2)}</pre>`

      await transporter.sendMail({
        from: `"SEO Agent - Manhwa Imperial" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_TO,
        subject: `📊 Reporte SEO Semanal IA — ${new Date().toISOString().split('T')[0]}`,
        html: htmlBody,
      })
      console.log('  ✅ Reporte enviado por Email')
    } catch (err) {
      console.error(`  ❌ Error Email: ${err.message}`)
    }
  }
}

module.exports = { runReportWriter }
