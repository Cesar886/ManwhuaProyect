/**
 * DUAL-SEO: Pipeline de Notificación Automática Consolidada
 *
 * Envía reportes semanales consolidados (GSC + BWT) por:
 *   - Telegram Bot (si TELEGRAM_BOT_TOKEN está configurado)
 *   - Email SMTP (si SMTP_HOST está configurado)
 *
 * Si ninguno está configurado, solo guarda el reporte en disco.
 */

const axios = require('axios')
const nodemailer = require('nodemailer')

// DUAL-SEO: Genera el texto del reporte semanal consolidado (GSC + BWT)
function generateReportText(data) {
  const fecha = new Date().toISOString().split('T')[0]

  const quickWinsAlta = data.quickWins?.filter(q => q.prioridad === 'ALTA') || []
  const caidasCriticas = data.paginasCaida?.filter(p => p.nivel_alerta === 'CRÍTICO') || []
  const copilotCount = data.copilotCannibalization?.length || 0
  const auditoriaCount = data.auditoriaTecnica?.length || 0
  const auditoriaCriticas = data.auditoriaTecnica?.filter(a => a.severidad === 'CRÍTICA')?.length || 0
  const backlinkCount = data.backlinkCompetidores?.length || 0

  // DUAL-SEO: Construir top 3 acciones urgentes
  const acciones = []

  // Acción 1: Quick Win más impactante
  if (quickWinsAlta.length > 0) {
    const top = quickWinsAlta[0]
    const pagePath = (top.page || '').replace('https://manhwaimperial.site', '')
    const fuente = top.fuente ? ` [${top.fuente}]` : ''
    acciones.push(
      `Optimizar "${top.query}" en ${pagePath}${fuente} ` +
      `(pos. G:${top.posicion_google || top.posicion || '?'} / B:${top.posicion_bing || '?'})`
    )
  }

  // Acción 2: Página en caída más crítica
  if (caidasCriticas.length > 0) {
    const top = caidasCriticas[0]
    const pagePath = (top.page || '').replace('https://manhwaimperial.site', '')
    const caidaG = top.caida_google_pct || top.caida_clics_porcentaje || 0
    acciones.push(
      `Investigar caída de ${caidaG}% en ${pagePath} (${top.diagnostico || 'revisar'})`
    )
  }

  // Acción 3: Content Gap o Copilot o Backlink
  if (data.contentGaps?.length > 0) {
    const top = data.contentGaps[0]
    const totalImp = (top.impresiones_google || top.impresiones || 0) + (top.impresiones_bing || 0)
    acciones.push(
      `Crear página para "${top.query}" (${totalImp} imp.${top.exclusivo_bing ? ' — exclusivo Bing!' : ''})`
    )
  } else if (copilotCount > 0) {
    const top = data.copilotCannibalization[0]
    acciones.push(
      `Optimizar contra Copilot: "${top.query}" (pos. ${top.posicion_bing}, CTR ${(top.ctr_bing * 100).toFixed(2)}%)`
    )
  } else if (backlinkCount > 0) {
    const top = data.backlinkCompetidores[0]
    acciones.push(
      `Link building: contactar ${top.dominio_referente} (enlaza a ${top.enlaza_a_competidor})`
    )
  }

  // Rellenar si faltan acciones
  while (acciones.length < 3) {
    acciones.push('Sin acciones adicionales urgentes')
  }

  const reporte = [
    '═══════════════════════════════════════════',
    '📊 REPORTE SEO DUAL - Manhwa Imperial',
    `Fecha: ${fecha}`,
    '──────────────────────────────────────────',
    `⚡ Quick Wins (Google+Bing): ${data.quickWins?.length || 0} páginas`,
    `   └ Prioridad ALTA: ${quickWinsAlta.length}`,
    `📝 Content Gaps nuevos: ${data.contentGaps?.length || 0} queries sin página`,
    `   └ Exclusivos de Bing: ${data.contentGaps?.filter(g => g.exclusivo_bing)?.length || 0}`,
    `🔗 Oportunidades de link building: ${backlinkCount} dominios`,
    `📉 Páginas en caída: ${data.paginasCaida?.length || 0} URLs`,
    `   └ Críticas: ${caidasCriticas.length}`,
    `🤖 Posible Copilot/AI cannibalization: ${copilotCount} páginas`,
    `🤖 Posible AI Overview (Google): ${data.aiOverview?.length || 0} páginas`,
    `🔧 Errores técnicos detectados por Bing Scanner: ${auditoriaCount}`,
    `   └ Críticos: ${auditoriaCriticas}`,
    '──────────────────────────────────────────',
    'TOP 3 ACCIONES URGENTES:',
    `1. ${acciones[0]}`,
    `2. ${acciones[1]}`,
    `3. ${acciones[2]}`,
    '═══════════════════════════════════════════',
  ].join('\n')

  return reporte
}

// DUAL-SEO: Genera el reporte semanal en formato JSON estructurado
function generateReportJson(data) {
  const fecha = new Date().toISOString()

  return {
    fecha,
    motor: 'DUAL (Google + Bing)',
    resumen: {
      quick_wins_total: data.quickWins?.length || 0,
      quick_wins_alta: data.quickWins?.filter(q => q.prioridad === 'ALTA').length || 0,
      content_gaps_total: data.contentGaps?.length || 0,
      content_gaps_exclusivos_bing: data.contentGaps?.filter(g => g.exclusivo_bing)?.length || 0,
      paginas_caida_total: data.paginasCaida?.length || 0,
      paginas_caida_criticas: data.paginasCaida?.filter(p => p.nivel_alerta === 'CRÍTICO').length || 0,
      ai_overview_google_total: data.aiOverview?.length || 0,
      copilot_cannibalization_total: data.copilotCannibalization?.length || 0,
      auditoria_tecnica_total: data.auditoriaTecnica?.length || 0,
      auditoria_tecnica_criticas: data.auditoriaTecnica?.filter(a => a.severidad === 'CRÍTICA')?.length || 0,
      backlink_oportunidades_total: data.backlinkCompetidores?.length || 0,
    },
    top_quick_wins: (data.quickWins || []).slice(0, 5),
    top_content_gaps: (data.contentGaps || []).slice(0, 5),
    top_caidas: (data.paginasCaida || []).slice(0, 5),
    top_ai_overview: (data.aiOverview || []).slice(0, 5),
    top_copilot: (data.copilotCannibalization || []).slice(0, 5),
    top_auditoria: (data.auditoriaTecnica || []).slice(0, 5),
    top_backlinks: (data.backlinkCompetidores || []).slice(0, 5),
    ctr_comparativo: data.ctrAnalysis || [],
  }
}

// DUAL-SEO: Enviar reporte por Telegram Bot
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.log('  ℹ Telegram no configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)')
    return false
  }

  try {
    // Telegram tiene límite de 4096 chars, truncar si es necesario
    const truncated = text.length > 4000 ? text.substring(0, 4000) + '\n...[truncado]' : text
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: truncated,
      parse_mode: 'Markdown',
    })
    console.log('  ✅ Reporte enviado por Telegram')
    return true
  } catch (err) {
    console.error('  ❌ Error enviando Telegram:', err.message)
    return false
  }
}

// DUAL-SEO: Enviar reporte por Email SMTP
async function sendEmail(text, subject = '📊 Reporte SEO DUAL Semanal - Manhwa Imperial') {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const to = process.env.SMTP_TO

  if (!host || !user || !pass || !to) {
    console.log('  ℹ Email no configurado (SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_TO)')
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: `"SEO Pipeline DUAL - Manhwa Imperial" <${user}>`,
      to,
      subject,
      text,
      html: `<pre style="font-family: monospace; font-size: 14px;">${text}</pre>`,
    })

    console.log('  ✅ Reporte enviado por Email')
    return true
  } catch (err) {
    console.error('  ❌ Error enviando Email:', err.message)
    return false
  }
}

// DUAL-SEO: Función principal — genera y envía reporte consolidado
async function notify(data) {
  console.log('\n📬 Generando reporte semanal DUAL...')

  const text = generateReportText(data)
  const json = generateReportJson(data)

  console.log('\n' + text + '\n')

  // Intentar enviar por ambos canales
  await Promise.allSettled([
    sendTelegram(text),
    sendEmail(text),
  ])

  return json
}

module.exports = { notify, generateReportJson, generateReportText }
