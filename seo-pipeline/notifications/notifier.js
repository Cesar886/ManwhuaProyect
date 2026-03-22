/**
 * DUAL-SEO: Pipeline de Notificación Automática Consolidada
 *
 * Guarda reportes semanales consolidados (GSC + BWT) en:
 *   - ManhwaImperialAdmin/reports/ (CMS admin)
 *
 * Ya no usa Telegram ni Email — el admin CMS es el canal de reportes.
 */

const fs = require('fs')
const path = require('path')

const { AGENT } = require('../config/agentConfig')
const ADMIN_REPORTS_DIR = process.env.ADMIN_REPORTS_DIR || AGENT.ADMIN_REPORTS_DIR

function ensureAdminReportsDir() {
  if (!fs.existsSync(ADMIN_REPORTS_DIR)) {
    fs.mkdirSync(ADMIN_REPORTS_DIR, { recursive: true })
  }
}

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

// Guardar reporte en el admin CMS
function saveReportToAdmin(filename, data) {
  ensureAdminReportsDir()
  const filePath = path.join(ADMIN_REPORTS_DIR, filename)
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
  console.log(`  ✅ Reporte guardado en admin: ${filePath}`)
  return true
}

// DUAL-SEO: Función principal — genera y guarda reporte consolidado en admin CMS
async function notify(data) {
  console.log('\n📬 Generando reporte semanal DUAL...')

  const text = generateReportText(data)
  const json = generateReportJson(data)

  console.log('\n' + text + '\n')

  // Guardar en admin CMS
  const fecha = new Date().toISOString().split('T')[0]
  saveReportToAdmin(`reporte_semanal_${fecha}.json`, { ...json, texto: text })
  saveReportToAdmin('reporte_semanal_latest.json', { ...json, texto: text })

  return json
}

module.exports = { notify, generateReportJson, generateReportText }
