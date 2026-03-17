#!/usr/bin/env node

/**
 * IMPERIAL-AGENT v1 — SEO/GEO Autonomous Agent
 * Manhwa Imperial (manhwaimperial.site)
 *
 * Orquesta 9 módulos en ciclo semanal:
 *   Módulo 1 → Recolección datos GSC + BWT
 *   Módulo 2 → Monitor de caída de tráfico
 *   Módulo 3 → Auditoría técnica BWT SEO Scanner
 *   Módulo 4 → Quick Wins — optimizar titles/meta/schema
 *   Módulo 5 → Content Gaps — detectar queries sin página
 *   Módulo 6 → Generador de páginas (top 5 gaps)
 *   Módulo 7 → GEO Optimizer — optimizar para IAs generativas
 *   Módulo 8 → Indexación inteligente
 *   Módulo 9 → Reporte ejecutivo semanal
 *
 * Uso:
 *   node index.js                                → Pipeline completo (9 módulos)
 *   node index.js --module=agenteFull            → Pipeline autónomo completo
 *   node index.js --module=geoOptimizer          → Solo GEO Optimizer (Módulo 7)
 *   node index.js --module=quickWinsUnificado    → Solo Quick Wins (Módulo 1+4)
 *   node index.js --module=contentGapsCross      → Solo Content Gaps (Módulo 5)
 *   node index.js --module=generarPaginas        → Solo generar páginas (Módulo 6)
 *   node index.js --module=smartIndexer          → Smart Indexer (Módulo 8)
 *   node index.js --module=reporte               → Solo reporte (Módulo 9)
 *   node index.js --cron                         → Iniciar con node-cron (lunes 4AM)
 *   node index.js --module=detectDB              → Solo detectar esquema de DB
 *
 * Los resultados se guardan en:
 *   ./data/raw/           → Datos crudos por semana
 *   ./reports/            → Reportes procesados
 *   ./logs/               → Log maestro y costos
 *   ./drafts/             → Contenido pendiente de revisión
 *   ./data/agent_memory.json → Memoria persistente del agente
 */

require('dotenv').config()

const fs = require('fs')
const path = require('path')

// ── MÓDULOS DE ANÁLISIS (Capa 1) ──────────────────
const { detectQuickWinsUnificado } = require('./modules/quickWinsUnificado')
const { detectContentGapsCross } = require('./modules/contentGapsCross')
const { detectMonitorCaidaDual } = require('./modules/monitorCaidaDual')
const { analyzeCtrComparativo } = require('./modules/ctrComparativo')
const { detectCopilotCannibalization } = require('./modules/copilotCannibalization')
const { runAuditoriaTecnica } = require('./modules/auditoriaTecnica')
const { analyzeBacklinkCompetidores } = require('./modules/backlinkCompetidores')
const { detectAIOverview } = require('./modules/aiOverview')

// ── MÓDULOS LEGACY (solo GSC) ─────────────────────
const { detectQuickWins } = require('./modules/quickWins')
const { detectContentGaps } = require('./modules/contentGaps')
const { detectPaginasCaida } = require('./modules/paginasCaida')
const { analyzeCTR } = require('./modules/ctrAnalysis')

// ── MÓDULOS AUTÓNOMOS CON IA (Capa 2+3) ──────────
const { runQuickWinsOptimizer } = require('./modules/quickWinsOptimizer')
const { runContentGapsGenerator } = require('./modules/contentGapsGenerator')
const { runPriorityDecider, executePlan } = require('./modules/priorityDecider')
const { runSchemaOptimizer } = require('./modules/schemaOptimizer')
const { runReportWriter } = require('./modules/reportWriter')
const { runGeoOptimizer, generateOrganizationSchema } = require('./modules/geoOptimizer')
const { runSmartIndexer } = require('./modules/smartIndexer')
const { getUsageSummary } = require('./modules/aiReasoner')

// ── CORE ──────────────────────────────────────────
const { initDB, getRecentlyUpdatedPages, closeDB } = require('./core/dbClient')
const { readMemory, getAllowedModules, cleanup, markExecution, getCostPercentage } = require('./core/agentMemory')

// ── NOTIFICACIONES ────────────────────────────────
const { notify, generateReportJson } = require('./notifications/notifier')

// ── CONSTANTES ────────────────────────────────────
const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const DATA_RAW_DIR = path.resolve('./data/raw')

// ═══════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function saveReport(filename, data, dir = REPORTS_DIR) {
  ensureDir(dir)
  const filePath = path.join(dir, filename)
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
  console.log(`  💾 Guardado: ${filePath}`)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}
  for (const arg of args) {
    if (arg === '--cron') { result.cron = true; continue }
    const match = arg.match(/^--(\w+)=(.+)$/)
    if (match) result[match[1]] = match[2]
  }
  return result
}

async function runModule(name, fn) {
  const start = Date.now()
  try {
    const result = await fn()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`  ⏱ ${name}: ${elapsed}s\n`)
    return result
  } catch (err) {
    console.error(`\n  ❌ Error en ${name}: ${err.message}`)
    return null
  }
}

function isBwtConfigured() { return !!process.env.BWT_API_KEY }
function isAiConfigured() { return !!process.env.AI_API_KEY }

// ═══════════════════════════════════════════════════
// PIPELINE IMPERIAL-AGENT v1 — 9 MÓDULOS
// ═══════════════════════════════════════════════════

async function runImperialAgent() {
  const fecha = new Date().toISOString().split('T')[0]
  const bwtReady = isBwtConfigured()
  const aiReady = isAiConfigured()
  const budget = getAllowedModules()

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  🏯 IMPERIAL-AGENT v1 — Manhwa Imperial          ║')
  console.log('║  SEO + GEO Autonomous Agent                      ║')
  console.log(`║  ${fecha}                                    ║`)
  console.log('╚══════════════════════════════════════════════════╝\n')

  // Estado del sistema
  if (!bwtReady) console.warn('⚠ BWT_API_KEY no configurada. Módulos Bing en modo degradado.')
  else console.log('✅ BWT API key detectada. Modo dual (GSC + BWT).')

  if (!aiReady) console.warn('⚠ AI_API_KEY no configurada. Módulos IA desactivados.')
  else {
    const usage = getUsageSummary()
    const cost = getCostPercentage()
    console.log(`✅ IA configurada (${process.env.AI_PROVIDER || 'anthropic'}). Uso semanal: ${usage.weekly.usage_pct}`)
    console.log(`💰 Presupuesto mensual: $${cost.acumulado.toFixed(2)}/$${cost.limite} (${cost.pct.toFixed(1)}%)`)
  }

  console.log(`📋 Módulos permitidos: ${budget.modules.join(', ')} (${budget.reason})`)
  console.log('')

  // Detectar esquema de DB al arrancar
  console.log('═══ INICIALIZACIÓN ═══\n')
  await initDB()
  console.log('')

  const results = {}

  // ─── PASO 1: MÓDULO 1 — RECOLECCIÓN DE DATOS ───
  if (budget.modules.includes(1)) {
    console.log('═══ MÓDULO 1: RECOLECCIÓN DE DATOS (GSC + BWT) ═══\n')

    const dataModules = [
      { key: 'quickWinsUnificado', fn: detectQuickWinsUnificado, file: 'quick_wins_unificado.json' },
      { key: 'contentGapsCross', fn: detectContentGapsCross, file: 'content_gaps_cross.json' },
      { key: 'ctrComparativo', fn: analyzeCtrComparativo, file: 'ctr_comparativo.json' },
      { key: 'copilotCannibalization', fn: detectCopilotCannibalization, file: 'copilot_cannibalization.json' },
      { key: 'backlinkCompetidores', fn: analyzeBacklinkCompetidores, file: 'link_building_oportunidades.json' },
      { key: 'aiOverview', fn: detectAIOverview, file: 'ai_overview_sospecha.json' },
    ]

    for (const mod of dataModules) {
      const result = await runModule(mod.key, mod.fn)
      if (result) {
        saveReport(mod.file, result)
        results[mod.key] = result
      }
    }

    // Guardar datos crudos de la semana
    saveReport(`semana_${fecha}.json`, results, DATA_RAW_DIR)
  }

  // ─── PASO 2: MÓDULO 2 — MONITOR DE CAÍDA ───
  if (budget.modules.includes(2)) {
    console.log('═══ MÓDULO 2: MONITOR DE CAÍDA DE TRÁFICO ═══\n')
    const caida = await runModule('monitorCaidaDual', detectMonitorCaidaDual)
    if (caida) {
      saveReport('monitor_caida_dual.json', caida)
      results.monitorCaidaDual = caida
    }
  }

  // ─── PASO 3: MÓDULO 3 — AUDITORÍA TÉCNICA ───
  if (budget.modules.includes(3)) {
    console.log('═══ MÓDULO 3: AUDITORÍA TÉCNICA (BWT SEO Scanner) ═══\n')
    const auditoria = await runModule('auditoriaTecnica', runAuditoriaTecnica)
    if (auditoria) {
      saveReport('auditoria_tecnica.json', auditoria)
      results.auditoriaTecnica = auditoria
    }
  }

  // ─── PASO 4: MÓDULO 4 — QUICK WINS OPTIMIZER ───
  if (budget.modules.includes(4) && aiReady) {
    console.log('═══ MÓDULO 4: QUICK WINS — Optimizar Titles/Meta ═══\n')
    const titleResults = await runModule('quickWinsOptimizer', () =>
      runQuickWinsOptimizer(results.quickWinsUnificado)
    )
    if (titleResults) results.quickWinsOptimizer = titleResults

    // Schema optimizer también
    const schemaResults = await runModule('schemaOptimizer', () =>
      runSchemaOptimizer(results.quickWinsUnificado)
    )
    if (schemaResults) results.schemaOptimizer = schemaResults
  }

  // ─── PASO 5: MÓDULO 5 — CONTENT GAPS DETECTOR ───
  if (budget.modules.includes(5)) {
    // Content gaps ya se detectó en Módulo 1, aquí solo mostramos resumen
    if (results.contentGapsCross) {
      const gaps = results.contentGapsCross
      const alta = gaps.filter(g => g.prioridad_contenido === 'ALTA').length
      const media = gaps.filter(g => g.prioridad_contenido === 'MEDIA').length
      console.log('═══ MÓDULO 5: CONTENT GAPS ═══\n')
      console.log(`  → ${gaps.length} gaps detectados: ${alta} ALTA, ${media} MEDIA\n`)
    }
  }

  // ─── PASO 6: MÓDULO 6 — GENERADOR DE PÁGINAS ───
  if (budget.modules.includes(6) && aiReady) {
    console.log('═══ MÓDULO 6: GENERADOR DE PÁGINAS (Top 5 Gaps) ═══\n')
    const pageResults = await runModule('contentGapsGenerator', () =>
      runContentGapsGenerator(results.contentGapsCross)
    )
    if (pageResults) results.contentGapsGenerator = pageResults
  }

  // ─── PASO 7: MÓDULO 7 — GEO OPTIMIZER ───
  if (budget.modules.includes(7) && aiReady) {
    console.log('═══ MÓDULO 7: GEO OPTIMIZER — IAs Generativas ═══\n')
    const geoResults = await runModule('geoOptimizer', () =>
      runGeoOptimizer({
        quickWins: results.quickWinsUnificado,
        contentGaps: results.contentGapsCross,
      })
    )
    if (geoResults) results.geoOptimizer = geoResults
  }

  // ─── PASO 8: MÓDULO 8 — INDEXACIÓN INTELIGENTE ───
  if (budget.modules.includes(8)) {
    console.log('═══ MÓDULO 8: INDEXACIÓN INTELIGENTE ═══\n')

    // Resubmitir páginas en caída
    if (results.monitorCaidaDual) {
      const indexResults = await runModule('smartIndexer', () =>
        runSmartIndexer(results.monitorCaidaDual)
      )
      if (indexResults) {
        saveReport('smart_indexer_results.json', indexResults)
        results.smartIndexer = indexResults
      }
    }

    // Indexar páginas nuevas/actualizadas de la DB
    try {
      const recentPages = await getRecentlyUpdatedPages(7)
      if (recentPages.length > 0) {
        const siteUrl = process.env.GSC_SITE_URL || 'https://manhwaimperial.site'
        const { smartIndexBatch } = require('./modules/smartIndexer')
        const items = recentPages.map(slug => ({
          url: `${siteUrl}/manhwa/${slug}`,
          reason: 'content_update',
        }))
        console.log(`  → ${items.length} páginas actualizadas esta semana para indexar`)
        await smartIndexBatch(items.slice(0, 50)) // Limitar a 50
      }
    } catch { /* DB no disponible */ }
  }

  // ─── PASO 9: MÓDULO 9 — REPORTE EJECUTIVO ───
  console.log('═══ MÓDULO 9: REPORTE EJECUTIVO SEMANAL ═══\n')

  if (budget.modules.includes(9) && aiReady) {
    await runModule('reportWriter', runReportWriter)
  } else {
    const reportData = buildReportData(results)
    const reportJson = await notify(reportData)
    saveReport('reporte_semanal_dual.json', reportJson)
  }

  // ─── CIERRE ───
  if (aiReady) {
    const usage = getUsageSummary()
    const cost = getCostPercentage()
    console.log(`\n📊 Uso IA semanal: ${usage.weekly.tokens_used} tokens (${usage.weekly.usage_pct}) | $${usage.weekly.cost_usd}`)
    console.log(`📊 Uso IA mensual: $${cost.acumulado.toFixed(4)} / $${cost.limite}`)
  }

  // Limpiar memoria antigua y registrar ejecución
  cleanup()
  markExecution()
  await closeDB()

  console.log('\n✅ IMPERIAL-AGENT v1 — Pipeline completado.')
}

// ═══════════════════════════════════════════════════
// CONSTRUIR DATOS PARA REPORTE
// ═══════════════════════════════════════════════════

function buildReportData(results) {
  return {
    quickWins: results.quickWinsUnificado || results.quickWins || [],
    contentGaps: results.contentGapsCross || results.contentGaps || [],
    paginasCaida: results.monitorCaidaDual || results.paginasCaida || [],
    ctrAnalysis: results.ctrComparativo || results.ctrAnalysis || [],
    aiOverview: results.aiOverview || [],
    copilotCannibalization: results.copilotCannibalization || [],
    auditoriaTecnica: results.auditoriaTecnica || [],
    backlinkCompetidores: results.backlinkCompetidores || [],
    smartIndexer: results.smartIndexer || [],
    geoOptimizer: results.geoOptimizer || null,
  }
}

// ═══════════════════════════════════════════════════
// EJECUCIÓN POR MÓDULO INDIVIDUAL
// ═══════════════════════════════════════════════════

async function runSingleModule(targetModule) {
  const bwtReady = isBwtConfigured()
  const aiReady = isAiConfigured()

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  🏯 IMPERIAL-AGENT v1 — Módulo Individual        ║')
  console.log(`║  ${new Date().toISOString().split('T')[0]}                                    ║`)
  console.log('╚══════════════════════════════════════════════════╝\n')

  const results = {}

  // Registro de módulos de análisis
  const analysisModules = {
    quickWinsUnificado: { fn: detectQuickWinsUnificado, file: 'quick_wins_unificado.json' },
    contentGapsCross: { fn: detectContentGapsCross, file: 'content_gaps_cross.json' },
    monitorCaidaDual: { fn: detectMonitorCaidaDual, file: 'monitor_caida_dual.json' },
    ctrComparativo: { fn: analyzeCtrComparativo, file: 'ctr_comparativo.json' },
    copilotCannibalization: { fn: detectCopilotCannibalization, file: 'copilot_cannibalization.json' },
    auditoriaTecnica: { fn: runAuditoriaTecnica, file: 'auditoria_tecnica.json' },
    backlinkCompetidores: { fn: analyzeBacklinkCompetidores, file: 'link_building_oportunidades.json' },
    aiOverview: { fn: detectAIOverview, file: 'ai_overview_sospecha.json' },
    // Legacy
    quickWins: { fn: detectQuickWins, file: 'quick_wins.json' },
    contentGaps: { fn: detectContentGaps, file: 'content_gaps.json' },
    paginasCaida: { fn: detectPaginasCaida, file: 'paginas_caida.json' },
    ctrAnalysis: { fn: analyzeCTR, file: 'ctr_por_tipo.json' },
  }

  // Módulos IA
  const aiModules = {
    optimizarTitles: { fn: () => runQuickWinsOptimizer(), label: 'Optimizar Titles (IA)' },
    generarPaginas: { fn: () => runContentGapsGenerator(), label: 'Generar Páginas (IA)' },
    decidirPrioridades: { fn: () => runPriorityDecider(), label: 'Decidir Prioridades (IA)' },
    optimizarSchemas: { fn: () => runSchemaOptimizer(), label: 'Optimizar Schemas (IA)' },
    reporteIA: { fn: () => runReportWriter(), label: 'Reporte Semanal (IA)' },
    geoOptimizer: { fn: () => runGeoOptimizer(), label: 'GEO Optimizer (IA)' },
  }

  if (targetModule === 'detectDB') {
    console.log('🔍 Detectando esquema de base de datos...\n')
    await initDB()
    const { getSchema } = require('./core/dbClient')
    const schema = getSchema()
    if (schema) {
      console.log('\n📋 Esquema detectado:')
      console.log(JSON.stringify(schema, null, 2))
    }
    await closeDB()
    return
  }

  if (targetModule === 'agenteFull') {
    return runImperialAgent()
  }

  if (aiModules[targetModule]) {
    const mod = aiModules[targetModule]
    console.log(`🤖 Ejecutando: ${mod.label}\n`)
    await runModule(targetModule, mod.fn)
    return
  }

  if (analysisModules[targetModule]) {
    const mod = analysisModules[targetModule]
    const result = await runModule(targetModule, mod.fn)
    if (result) saveReport(mod.file, result)
    return
  }

  if (targetModule === 'smartIndexer') {
    console.log('🔄 Ejecutando Smart Indexer...\n')
    const caida = await runModule('monitorCaidaDual', detectMonitorCaidaDual)
    if (caida) saveReport('monitor_caida_dual.json', caida)
    const indexResults = await runModule('smartIndexer', () => runSmartIndexer(caida || []))
    if (indexResults) saveReport('smart_indexer_results.json', indexResults)
    return
  }

  if (targetModule === 'reporte') {
    console.log('📬 Generando reporte...\n')
    for (const [key, mod] of Object.entries(analysisModules)) {
      const filePath = path.join(REPORTS_DIR, mod.file)
      if (fs.existsSync(filePath)) {
        try {
          results[key] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          console.log(`  ✅ Cargado: ${mod.file}`)
        } catch { console.log(`  ⚠ Error: ${mod.file}`) }
      }
    }
    const reportData = buildReportData(results)
    const reportJson = await notify(reportData)
    saveReport('reporte_semanal_dual.json', reportJson)
    return
  }

  // Módulo desconocido
  console.error(`❌ Módulo desconocido: ${targetModule}`)
  const allModules = [
    ...Object.keys(analysisModules),
    ...Object.keys(aiModules),
    'smartIndexer', 'reporte', 'agenteFull', 'detectDB',
  ]
  console.log(`   Módulos disponibles: ${allModules.join(', ')}`)
  process.exit(1)
}

// ═══════════════════════════════════════════════════
// MODO CRON — Cada lunes a las 4AM
// ═══════════════════════════════════════════════════

function startCron() {
  let cron
  try {
    cron = require('node-cron')
  } catch {
    console.error('❌ node-cron no instalado. Ejecutar: npm install node-cron')
    process.exit(1)
  }

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  🏯 IMPERIAL-AGENT v1 — Modo CRON                ║')
  console.log('║  Schedule: Lunes 4:00 AM                         ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  console.log('⏰ Esperando próxima ejecución programada...')
  console.log('   Cron: 0 4 * * 1 (cada lunes a las 4AM)\n')

  // Cada lunes a las 4AM
  cron.schedule('0 4 * * 1', async () => {
    console.log(`\n🕐 Ejecución programada iniciada: ${new Date().toISOString()}\n`)
    try {
      await runImperialAgent()
    } catch (err) {
      console.error(`\n💥 Error en ejecución programada: ${err.message}`)
    }
  }, {
    timezone: 'America/Mexico_City',
  })

  // Mantener proceso vivo
  process.on('SIGINT', () => {
    console.log('\n👋 IMPERIAL-AGENT detenido.')
    process.exit(0)
  })
}

// ═══════════════════════════════════════════════════
// PUNTO DE ENTRADA
// ═══════════════════════════════════════════════════

async function main() {
  const args = parseArgs()

  if (args.cron) {
    return startCron()
  }

  const targetModule = args.module || null

  if (targetModule) {
    return runSingleModule(targetModule)
  }

  // Sin argumentos: ejecutar pipeline completo
  return runImperialAgent()
}

main().catch(err => {
  console.error('\n💥 Error fatal del pipeline:', err.message)
  process.exit(1)
})
