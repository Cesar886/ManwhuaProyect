#!/usr/bin/env node

/**
 * IMPERIAL-AGENT v2 — SEO/GEO Autonomous Agent
 * Manhwa Imperial (manhwaimperial.site)
 *
 * Ciclo semanal de 9 modulos:
 *   FASE 1 (Recoleccion)  : M1 — GSC + BWT datos crudos
 *   FASE 2 (Diagnostico)  : M2 — Monitor de caida | M3 — Auditoria tecnica
 *   FASE 3 (Optimizacion) : M4 — Quick Wins titles/meta/schema
 *   FASE 4 (Creacion)     : M5 — Content Gaps | M6 — Generador paginas
 *   FASE 5 (GEO)          : M7 — GEO Optimizer para IAs generativas
 *   FASE 6 (Distribucion) : M8 — Indexacion GSC + IndexNow | M9 — Reporte
 *
 * Uso:
 *   node index.js                             → Pipeline completo
 *   node index.js --module=agenteFull         → Pipeline completo
 *   node index.js --module=setup              → Detectar DB y validar APIs
 *   node index.js --module=<nombre>           → Modulo individual
 *   node index.js --cron                      → Cron cada lunes 4AM
 */

require('dotenv').config()

const fs = require('fs')
const path = require('path')

// -- MODULOS DE ANALISIS (Fase 1) --
const { detectQuickWinsUnificado } = require('./modules/quickWinsUnificado')
const { detectContentGapsCross } = require('./modules/contentGapsCross')
const { detectMonitorCaidaDual } = require('./modules/monitorCaidaDual')
const { analyzeCtrComparativo } = require('./modules/ctrComparativo')
const { detectCopilotCannibalization } = require('./modules/copilotCannibalization')
const { runAuditoriaTecnica } = require('./modules/auditoriaTecnica')
const { analyzeBacklinkCompetidores } = require('./modules/backlinkCompetidores')
const { detectAIOverview } = require('./modules/aiOverview')

// -- MODULOS LEGACY (solo GSC) --
const { detectQuickWins } = require('./modules/quickWins')
const { detectContentGaps } = require('./modules/contentGaps')
const { detectPaginasCaida } = require('./modules/paginasCaida')
const { analyzeCTR } = require('./modules/ctrAnalysis')

// -- MODULOS AUTONOMOS CON IA (Fase 2-5) --
const { runQuickWinsOptimizer } = require('./modules/quickWinsOptimizer')
const { runContentGapsGenerator } = require('./modules/contentGapsGenerator')
const { runPriorityDecider, executePlan } = require('./modules/priorityDecider')
const { runSchemaOptimizer } = require('./modules/schemaOptimizer')
const { runReportWriter } = require('./modules/reportWriter')
const { runGeoOptimizer, generateOrganizationSchema } = require('./modules/geoOptimizer')
const { runSmartIndexer } = require('./modules/smartIndexer')
const { getUsageSummary } = require('./modules/aiReasoner')

// -- CORE --
const { initDB, getRecentlyUpdatedPages, closeDB } = require('./core/dbClient')
const {
  readMemory, ensureCurrentWeek, getAllowedModules, getCostPercentage,
  cleanup, markExecution,
} = require('./core/agentMemory')

// -- NOTIFICACIONES --
const { notify, generateReportJson } = require('./notifications/notifier')

// -- CONSTANTES --
const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const DATA_RAW_DIR = path.resolve('./data/raw')
const { AGENT } = require('./config/agentConfig')

// == UTILIDADES ==

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function saveReport(filename, data, dir = REPORTS_DIR) {
  ensureDir(dir)
  const filePath = path.join(dir, filename)
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
  console.log(`  [SAVE] ${filePath}`)
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
    console.log(`  [TIME] ${name}: ${elapsed}s\n`)
    return result
  } catch (err) {
    console.error(`\n  [ERROR] ${name}: ${err.message}`)
    return null
  }
}

function isAiConfigured() {
  return !!(process.env.OPENAI_API_KEY || process.env.AI_API_KEY)
}

function isBwtConfigured() {
  return !!process.env.BWT_API_KEY
}

// == PIPELINE IMPERIAL-AGENT v2 — 9 MODULOS ==

async function runImperialAgent() {
  const fecha = new Date().toISOString().split('T')[0]
  const bwtReady = isBwtConfigured()
  const aiReady = isAiConfigured()
  const budget = getAllowedModules()

  console.log('==================================================')
  console.log('  IMPERIAL-AGENT v2 — Manhwa Imperial')
  console.log('  SEO + GEO Autonomous Agent')
  console.log(`  ${fecha}`)
  console.log('==================================================\n')

  // Estado del sistema
  if (!bwtReady) console.warn('[WARN] BWT_API_KEY no configurada. Modo degradado.')
  else console.log('[OK] BWT API detectada. Modo dual (GSC + BWT).')

  if (!aiReady) console.warn('[WARN] OPENAI_API_KEY no configurada. Modulos IA desactivados.')
  else {
    const cost = getCostPercentage()
    console.log(`[OK] OpenAI configurada. Presupuesto: $${cost.acumulado.toFixed(2)}/$${cost.limite} (${cost.pct.toFixed(1)}%)`)
  }

  console.log(`[INFO] Modulos permitidos: ${budget.modules.join(', ')} (${budget.reason})`)
  console.log('')

  // Inicializar semana y DB
  ensureCurrentWeek()
  console.log('== INICIALIZACION ==\n')
  await initDB()
  console.log('')

  const results = {}

  // -- FASE 1: RECOLECCION (sin GPT, puro datos) --
  if (budget.modules.includes(1)) {
    console.log('== FASE 1: RECOLECCION DE DATOS (GSC + BWT) ==\n')

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

    saveReport(`semana_${fecha}.json`, results, DATA_RAW_DIR)
  }

  // -- FASE 2: DIAGNOSTICO (GPT analiza anomalias) --
  if (budget.modules.includes(2)) {
    console.log('== FASE 2: DIAGNOSTICO ==\n')
    console.log('-- Modulo 2: Monitor de Caida --\n')
    const caida = await runModule('monitorCaidaDual', detectMonitorCaidaDual)
    if (caida) {
      saveReport('monitor_caida_dual.json', caida)
      results.monitorCaidaDual = caida
    }
  }

  if (budget.modules.includes(3)) {
    console.log('-- Modulo 3: Auditoria Tecnica (BWT) --\n')
    const auditoria = await runModule('auditoriaTecnica', runAuditoriaTecnica)
    if (auditoria) {
      saveReport('auditoria_tecnica.json', auditoria)
      results.auditoriaTecnica = auditoria
    }
  }

  // -- FASE 3: OPTIMIZACION (GPT mejora lo existente) --
  if (budget.modules.includes(4) && aiReady) {
    console.log('== FASE 3: OPTIMIZACION ==\n')
    console.log('-- Modulo 4: Quick Wins --\n')
    const titleResults = await runModule('quickWinsOptimizer', () =>
      runQuickWinsOptimizer(results.quickWinsUnificado)
    )
    if (titleResults) results.quickWinsOptimizer = titleResults

    const schemaResults = await runModule('schemaOptimizer', () =>
      runSchemaOptimizer(results.quickWinsUnificado)
    )
    if (schemaResults) results.schemaOptimizer = schemaResults
  }

  // -- FASE 4: CREACION (GPT genera contenido nuevo) --
  if (budget.modules.includes(5)) {
    if (results.contentGapsCross) {
      const gaps = results.contentGapsCross
      const alta = gaps.filter(g => g.prioridad_contenido === 'ALTA').length
      const media = gaps.filter(g => g.prioridad_contenido === 'MEDIA').length
      console.log('== FASE 4: CREACION ==\n')
      console.log(`-- Modulo 5: Content Gaps: ${gaps.length} gaps (${alta} ALTA, ${media} MEDIA) --\n`)
    }
  }

  if (budget.modules.includes(6) && aiReady) {
    console.log('-- Modulo 6: Generador de Paginas --\n')
    const pageResults = await runModule('contentGapsGenerator', () =>
      runContentGapsGenerator(results.contentGapsCross)
    )
    if (pageResults) results.contentGapsGenerator = pageResults
  }

  // -- FASE 5: GEO (GPT optimiza para IAs generativas) --
  if (budget.modules.includes(7) && aiReady) {
    console.log('== FASE 5: GEO ==\n')
    console.log('-- Modulo 7: GEO Optimizer --\n')
    const geoResults = await runModule('geoOptimizer', () =>
      runGeoOptimizer({
        quickWins: results.quickWinsUnificado,
        contentGaps: results.contentGapsCross,
      })
    )
    if (geoResults) results.geoOptimizer = geoResults
  }

  // -- FASE 6: DISTRIBUCION (sin GPT) --
  if (budget.modules.includes(8)) {
    console.log('== FASE 6: DISTRIBUCION ==\n')
    console.log('-- Modulo 8: Indexacion Inteligente --\n')

    // Resubmitir paginas en caida
    if (results.monitorCaidaDual) {
      const indexResults = await runModule('smartIndexer', () =>
        runSmartIndexer(results.monitorCaidaDual)
      )
      if (indexResults) {
        saveReport('smart_indexer_results.json', indexResults)
        results.smartIndexer = indexResults
      }
    }

    // Indexar paginas actualizadas por el agente
    try {
      const recentPages = await getRecentlyUpdatedPages(7)
      if (recentPages.length > 0) {
        const siteUrl = AGENT.SITE_URL
        const { smartIndexBatch } = require('./modules/smartIndexer')
        const items = recentPages.map(slug => ({
          url: `${siteUrl}/manhwa/${slug}`,
          reason: 'content_update',
        }))
        console.log(`  [M8] ${items.length} paginas actualizadas por el agente`)
        await smartIndexBatch(items.slice(0, 50))
      }
    } catch { /* DB no disponible */ }
  }

  // -- Modulo 9: Reporte Ejecutivo --
  console.log('-- Modulo 9: Reporte Ejecutivo Semanal --\n')

  if (budget.modules.includes(9) && aiReady) {
    await runModule('reportWriter', runReportWriter)
  } else {
    const reportData = buildReportData(results)
    const reportJson = await notify(reportData)
    saveReport('reporte_semanal_dual.json', reportJson)
  }

  // -- CIERRE --
  if (aiReady) {
    const cost = getCostPercentage()
    console.log(`\n[COST] Mes: $${cost.acumulado.toFixed(4)} / $${cost.limite} (${cost.pct.toFixed(1)}%)`)
  }

  cleanup()
  markExecution()
  await closeDB()

  console.log('\n[DONE] IMPERIAL-AGENT v2 — Pipeline completado.')
}

function buildReportData(results) {
  return {
    quickWins: results.quickWinsUnificado || [],
    contentGaps: results.contentGapsCross || [],
    paginasCaida: results.monitorCaidaDual || [],
    ctrAnalysis: results.ctrComparativo || [],
    aiOverview: results.aiOverview || [],
    copilotCannibalization: results.copilotCannibalization || [],
    auditoriaTecnica: results.auditoriaTecnica || [],
    backlinkCompetidores: results.backlinkCompetidores || [],
    smartIndexer: results.smartIndexer || [],
    geoOptimizer: results.geoOptimizer || null,
  }
}

// == EJECUCION POR MODULO INDIVIDUAL ==

async function runSingleModule(targetModule) {
  const aiReady = isAiConfigured()

  console.log('==================================================')
  console.log('  IMPERIAL-AGENT v2 — Modulo Individual')
  console.log(`  ${new Date().toISOString().split('T')[0]}`)
  console.log('==================================================\n')

  ensureCurrentWeek()

  const results = {}

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

  const aiModules = {
    optimizarTitles: { fn: () => runQuickWinsOptimizer(), label: 'Quick Wins Optimizer (IA)' },
    generarPaginas: { fn: () => runContentGapsGenerator(), label: 'Content Gaps Generator (IA)' },
    decidirPrioridades: { fn: () => runPriorityDecider(), label: 'Priority Decider (IA)' },
    optimizarSchemas: { fn: () => runSchemaOptimizer(), label: 'Schema Optimizer (IA)' },
    reporteIA: { fn: () => runReportWriter(), label: 'Report Writer (IA)' },
    geoOptimizer: { fn: () => runGeoOptimizer(), label: 'GEO Optimizer (IA)' },
  }

  if (targetModule === 'setup' || targetModule === 'detectDB') {
    console.log('[SETUP] Detectando esquema de base de datos...\n')
    await initDB()
    const { getSchema } = require('./core/dbClient')
    const schema = getSchema()
    if (schema) {
      console.log('\n[SCHEMA]')
      console.log(JSON.stringify(schema, null, 2))
    }

    // Validar APIs
    console.log('\n[APIS]')
    console.log(`  GSC: ${process.env.GOOGLE_CREDENTIALS_PATH ? 'Configurado' : 'No configurado'}`)
    console.log(`  BWT: ${isBwtConfigured() ? 'Configurado' : 'No configurado'}`)
    console.log(`  OpenAI: ${isAiConfigured() ? 'Configurado' : 'No configurado'}`)
    console.log(`  Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'Configurado' : 'No configurado'}`)
    console.log(`  Email: ${process.env.SMTP_HOST ? 'Configurado' : 'No configurado'}`)

    await closeDB()
    return
  }

  if (targetModule === 'agenteFull') {
    return runImperialAgent()
  }

  if (aiModules[targetModule]) {
    const mod = aiModules[targetModule]
    console.log(`[IA] Ejecutando: ${mod.label}\n`)
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
    console.log('[M8] Ejecutando Smart Indexer...\n')
    const caida = await runModule('monitorCaidaDual', detectMonitorCaidaDual)
    if (caida) saveReport('monitor_caida_dual.json', caida)
    const indexResults = await runModule('smartIndexer', () => runSmartIndexer(caida || []))
    if (indexResults) saveReport('smart_indexer_results.json', indexResults)
    return
  }

  if (targetModule === 'reporte') {
    console.log('[M9] Generando reporte...\n')
    for (const [key, mod] of Object.entries(analysisModules)) {
      const filePath = path.join(REPORTS_DIR, mod.file)
      if (fs.existsSync(filePath)) {
        try {
          results[key] = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          console.log(`  [OK] ${mod.file}`)
        } catch { console.log(`  [WARN] ${mod.file}`) }
      }
    }
    const reportData = buildReportData(results)
    const reportJson = await notify(reportData)
    saveReport('reporte_semanal_dual.json', reportJson)
    return
  }

  // Modulo desconocido
  console.error(`[ERROR] Modulo desconocido: ${targetModule}`)
  const allModules = [
    ...Object.keys(analysisModules),
    ...Object.keys(aiModules),
    'smartIndexer', 'reporte', 'agenteFull', 'setup',
  ]
  console.log(`  Disponibles: ${allModules.join(', ')}`)
  process.exit(1)
}

// == MODO CRON ==

function startCron() {
  let cron
  try {
    cron = require('node-cron')
  } catch {
    console.error('[ERROR] node-cron no instalado. Ejecutar: npm install node-cron')
    process.exit(1)
  }

  console.log('==================================================')
  console.log('  IMPERIAL-AGENT v2 — Modo CRON')
  console.log('  Schedule: 0 4 * * 1 (Lunes 4:00 AM)')
  console.log('==================================================\n')

  console.log('[CRON] Esperando proxima ejecucion programada...\n')

  cron.schedule('0 4 * * 1', async () => {
    console.log(`\n[CRON] Ejecucion iniciada: ${new Date().toISOString()}\n`)
    try {
      await runImperialAgent()
    } catch (err) {
      console.error(`\n[FATAL] Error en ejecucion programada: ${err.message}`)
    }
  }, {
    timezone: 'America/Mexico_City',
  })

  process.on('SIGINT', () => {
    console.log('\n[STOP] IMPERIAL-AGENT v2 detenido.')
    process.exit(0)
  })
}

// == PUNTO DE ENTRADA ==

async function main() {
  const args = parseArgs()

  if (args.cron) return startCron()

  const targetModule = args.module || null

  if (targetModule) return runSingleModule(targetModule)

  // Sin argumentos: pipeline completo
  return runImperialAgent()
}

main().catch(err => {
  console.error('\n[FATAL] Error fatal del pipeline:', err.message)
  process.exit(1)
})
