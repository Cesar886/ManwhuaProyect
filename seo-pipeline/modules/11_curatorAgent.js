/**
 * CURATOR-AGENT v1: Content Curation Specialist
 * Manhwa Imperial (manhwaimperial.site)
 *
 * Analiza paginas con alto ranking pero bajo CTR y reescribe
 * su content_html para mejorar engagement.
 *
 * NO crea contenido nuevo. NO toca titles ni metas.
 * Solo reescribe el cuerpo HTML existente.
 *
 * Schedule: 0 4 * * 3 (Miercoles 4 AM)
 * Cupo semanal: maximo 15 paginas
 *
 * Flujo:
 *   1. Recolectar datos GSC + BWT (90 dias)
 *   2. Filtrar candidatas (impresiones >= 200, pos 1-20, CTR < benchmark)
 *   3. Calcular curator_score para cada una
 *   4. Seleccionar top 15
 *   5. Diagnostico GPT -> Reescritura GPT -> DB
 *   6. Enviar a IndexNow
 *   7. Medir impacto de curaciones anteriores (14+ dias)
 *   8. Generar reporte
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')
const { gptCall } = require('../core/gptClient')
const {
  readMemory, saveMemory,
  wasRecentlyOptimized, markOptimized,
  addDraft,
} = require('../core/agentMemory')
const { getSchema } = require('../core/dbClient')
const { analyzeHtml, detectPageType, CTR_BENCHMARKS } = require('./htmlAnalyzer')
const { logAction } = require('./autonomousExecutor')
const { activateAbTest, getActiveTests, getDbPool, closePool, formatLearningsForPrompt, MAX_CONCURRENT } = require('./12_abTester')

// Prompts
const diagnosticoPrompt = require('../prompts/curator_diagnostico.prompt')
const curatorObraPrompt = require('../prompts/curator_obra.prompt')
const curatorListaPrompt = require('../prompts/curator_lista.prompt')
const curatorResenaPrompt = require('../prompts/curator_resena.prompt')
const curatorGeneroPrompt = require('../prompts/curator_genero.prompt')

// Configuracion
const CURATOR_TAG = 'CURATOR-AGENT-v1'
const MAX_PAGES = parseInt(process.env.CURATOR_MAX_PAGES_PER_RUN) || 15
const MIN_CONFIDENCE = parseFloat(process.env.CURATOR_MIN_CONFIDENCE) || 0.80
const MIN_IMPRESSIONS = parseInt(process.env.CURATOR_MIN_IMPRESSIONS) || 200
const MEASURE_AFTER_DAYS = parseInt(process.env.CURATOR_MEASURE_AFTER_DAYS) || 14
const COOLDOWN_DAYS = 28 // No recurar en 4 semanas
const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const DRAFTS_DIR = path.resolve('./drafts/curator')

// ── GSC: Obtener datos de paginas (90 dias) ──

async function fetchGscPageData() {
  const credPath = process.env.GOOGLE_CREDENTIALS_PATH
  const siteUrl = process.env.GSC_SITE_URL
  if (!credPath || !siteUrl) {
    console.warn('  [CURATOR] GSC no configurado.')
    return []
  }

  try {
    const { GoogleAuth } = require('google-auth-library')
    const auth = new GoogleAuth({
      keyFile: path.resolve(credPath),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    const client = await auth.getClient()

    const endDate = new Date()
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const response = await client.request({
      url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      method: 'POST',
      data: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['page', 'query'],
        rowLimit: 25000,
        dataState: 'final',
      },
    })

    return response.data.rows || []
  } catch (err) {
    console.error(`  [CURATOR] Error GSC: ${err.message}`)
    return []
  }
}

// ── BWT: Obtener datos complementarios ──

async function fetchBwtQueryStats() {
  const apiKey = process.env.BWT_API_KEY
  const siteUrl = process.env.BWT_SITE_URL
  if (!apiKey || !siteUrl) return []

  try {
    const response = await axios.get(
      `https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?siteUrl=${encodeURIComponent(siteUrl)}`,
      {
        headers: { 'Content-Type': 'application/json' },
        params: { apikey: apiKey },
        timeout: 30000,
      }
    )
    return response.data?.d || []
  } catch (err) {
    console.error(`  [CURATOR] Error BWT: ${err.message}`)
    return []
  }
}

// ── Agregar datos por URL ──

function aggregateByUrl(gscRows, bwtRows) {
  const urlMap = {}

  for (const row of gscRows) {
    const url = row.keys[0]
    const query = row.keys[1]

    if (!urlMap[url]) {
      urlMap[url] = {
        url,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        queries: [],
        _posSum: 0,
        _posCount: 0,
      }
    }

    urlMap[url].clicks += row.clicks || 0
    urlMap[url].impressions += row.impressions || 0
    urlMap[url]._posSum += (row.position || 0) * (row.impressions || 1)
    urlMap[url]._posCount += row.impressions || 1
    urlMap[url].queries.push({
      query,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      position: row.position || 0,
    })
  }

  // Calcular promedios ponderados
  for (const url of Object.keys(urlMap)) {
    const entry = urlMap[url]
    entry.position = entry._posCount > 0 ? entry._posSum / entry._posCount : 0
    entry.ctr = entry.impressions > 0 ? (entry.clicks / entry.impressions) * 100 : 0
    entry.queries.sort((a, b) => b.impressions - a.impressions)
    entry.top_queries = entry.queries.slice(0, 10).map(q => q.query)
    delete entry._posSum
    delete entry._posCount
  }

  return Object.values(urlMap)
}

// ── Sistema de Scoring ──

function calculateCuratorScore(entry, tipo) {
  const benchmark = CTR_BENCHMARKS[tipo] || 3.0
  const ctrGap = benchmark - entry.ctr

  // CTR gap (0-40 pts)
  let ctrScore = 0
  if (ctrGap >= 4.0) ctrScore = 40
  else if (ctrGap >= 2.0) ctrScore = 28
  else if (ctrGap >= 1.0) ctrScore = 16
  else if (ctrGap >= 0.5) ctrScore = 8

  // Impresiones (0-30 pts)
  let impScore = 0
  if (entry.impressions >= 2000) impScore = 30
  else if (entry.impressions >= 1000) impScore = 22
  else if (entry.impressions >= 500) impScore = 14
  else if (entry.impressions >= 200) impScore = 6

  // Posicion (0-20 pts)
  let posScore = 0
  if (entry.position <= 5) posScore = 20
  else if (entry.position <= 10) posScore = 16
  else if (entry.position <= 15) posScore = 10
  else if (entry.position <= 20) posScore = 5

  // Contenido debil (0-10 pts)
  let weakScore = 0
  if (entry.metricas) {
    if (entry.metricas.word_count < 300) weakScore += 4
    if (entry.metricas.h2_count === 0) weakScore += 2
    if (!entry.metricas.has_faq) weakScore += 2
    if (!entry.metricas.has_quick_answer) weakScore += 2
  }

  const total = ctrScore + impScore + posScore + weakScore

  return {
    total,
    breakdown: { ctr: ctrScore, imp: impScore, pos: posScore, weak: weakScore },
    ctr_gap: ctrGap,
    benchmark,
    clasificacion: total >= 70 ? 'CRITICO' : total >= 45 ? 'ALTO' : total >= 25 ? 'MEDIO' : 'BAJO',
  }
}

// ── Obtener content_html de la DB ──

async function getContentHtmlFromDb(slug) {
  const schema = getSchema()
  if (!schema) return null

  try {
    let dbConnection
    if (schema.type === 'mysql') {
      const mysql = require('mysql2/promise')
      dbConnection = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        connectionLimit: 2,
      })

      for (const [, info] of Object.entries(schema.columns)) {
        const slugCol = info.detected.slug
        const contentCol = info.detected.content_html
        if (!slugCol || !contentCol) continue

        const [rows] = await dbConnection.query(
          `SELECT ${contentCol} as content_html FROM ${info.table} WHERE ${slugCol} = ? LIMIT 1`,
          [slug]
        )
        await dbConnection.end()
        if (rows.length > 0) return rows[0].content_html
      }
      await dbConnection.end()
    } else if (schema.type === 'mongodb') {
      const { MongoClient } = require('mongodb')
      const uri = process.env.MONGODB_URI ||
        `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME}`
      const client = new MongoClient(uri)
      await client.connect()
      const db = client.db(process.env.DB_NAME)

      for (const [, info] of Object.entries(schema.fields)) {
        const slugField = info.detected.slug
        const contentField = info.detected.content_html
        if (!slugField || !contentField) continue

        const doc = await db.collection(info.collection).findOne(
          { [slugField]: slug },
          { projection: { [contentField]: 1 } }
        )
        await client.close()
        if (doc && doc[contentField]) return doc[contentField]
      }
      await client.close()
    }
  } catch (err) {
    console.error(`  [CURATOR] Error leyendo HTML de DB: ${err.message}`)
  }
  return null
}

// ── Obtener content_html via fetch (fallback) ──

async function getContentHtmlFromUrl(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'CURATOR-AGENT/1.0' },
    })
    // Extraer el contenido principal (entre <main> o <article> o <body>)
    const html = response.data
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    return mainMatch ? mainMatch[1] : html
  } catch {
    return null
  }
}

// ── Extraer slug de URL ──

function extractSlug(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\/(manhwa|obra|lista|top|mejores|resena|review|genero|tag)\/([^/]+)/)
    if (match) return match[2]
    const parts = pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch { return null }
}

// ── Actualizar content_html en DB ──

async function updateContentHtml(slug, contentHtml) {
  const schema = getSchema()
  if (!schema) return { success: false, error: 'Schema no detectado' }

  try {
    if (schema.type === 'mysql') {
      const mysql = require('mysql2/promise')
      const pool = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        connectionLimit: 2,
      })

      for (const [, info] of Object.entries(schema.columns)) {
        const slugCol = info.detected.slug
        const contentCol = info.detected.content_html
        if (!slugCol || !contentCol) continue

        const updates = [`${contentCol} = ?`]
        const values = [contentHtml]

        if (info.detected.updated_at) {
          updates.push(`${info.detected.updated_at} = NOW()`)
        }
        if (info.detected.updated_by) {
          updates.push(`${info.detected.updated_by} = ?`)
          values.push(CURATOR_TAG)
        }

        values.push(slug)
        const [result] = await pool.query(
          `UPDATE ${info.table} SET ${updates.join(', ')} WHERE ${slugCol} = ?`,
          values
        )
        await pool.end()

        if (result.affectedRows > 0) {
          return { success: true, table: info.table, rows: result.affectedRows }
        }
      }
      await pool.end()
      return { success: false, error: `Slug "${slug}" no encontrado` }

    } else if (schema.type === 'mongodb') {
      const { MongoClient } = require('mongodb')
      const uri = process.env.MONGODB_URI ||
        `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME}`
      const client = new MongoClient(uri)
      await client.connect()
      const db = client.db(process.env.DB_NAME)

      for (const [, info] of Object.entries(schema.fields)) {
        const slugField = info.detected.slug
        const contentField = info.detected.content_html
        if (!slugField || !contentField) continue

        const update = { [contentField]: contentHtml }
        if (info.detected.updated_at) update[info.detected.updated_at] = new Date()
        if (info.detected.updated_by) update[info.detected.updated_by] = CURATOR_TAG

        const result = await db.collection(info.collection).updateOne(
          { [slugField]: slug },
          { $set: update }
        )
        await client.close()

        if (result.matchedCount > 0) {
          return { success: true, collection: info.collection, matched: result.matchedCount }
        }
      }
      await client.close()
      return { success: false, error: `Slug "${slug}" no encontrado` }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ── Enviar a IndexNow para re-crawl rapido ──

async function sendToIndexNow(url) {
  const key = process.env.INDEXNOW_KEY
  if (!key) return { success: false, reason: 'INDEXNOW_KEY no configurada' }

  try {
    const response = await axios.get('https://api.indexnow.org/indexnow', {
      params: {
        url,
        key,
        keyLocation: process.env.INDEXNOW_KEY_LOCATION || undefined,
      },
      timeout: 10000,
    })
    return { success: response.status >= 200 && response.status < 300 }
  } catch (err) {
    return { success: false, reason: err.message }
  }
}

// ── Seleccionar prompt por tipo ──

function getPromptForType(tipo) {
  switch (tipo) {
    case 'obra': return curatorObraPrompt
    case 'lista': return curatorListaPrompt
    case 'resena': return curatorResenaPrompt
    case 'genero': return curatorGeneroPrompt
    default: return curatorObraPrompt // fallback a obra
  }
}

// ── Verificar si fue curado recientemente ──

function wasCuratedRecently(url, days = COOLDOWN_DAYS) {
  const memory = readMemory()
  const historico = memory.paginas_curadas_historico || {}
  const entry = historico[url]
  if (!entry) return false
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(entry.ultima_curacion).getTime() > cutoff
}

// ── Guardar draft en disco ──

function saveDraft(url, slug, data) {
  if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true })
  const filename = `${slug}_${new Date().toISOString().split('T')[0]}.json`
  const filepath = path.join(DRAFTS_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify({ url, slug, ...data }, null, 2), 'utf-8')
  console.log(`    -> Draft guardado: ${filepath}`)
}

// ── Medir impacto de curaciones anteriores ──

async function measureImpact(gscData) {
  const memory = readMemory()
  const historico = memory.paginas_curadas_historico || {}
  const cutoff = Date.now() - MEASURE_AFTER_DAYS * 24 * 60 * 60 * 1000
  const results = []

  for (const [url, entry] of Object.entries(historico)) {
    if (entry.mejora_confirmada !== null && entry.mejora_confirmada !== undefined) continue
    if (new Date(entry.ultima_curacion).getTime() > cutoff) continue // Muy reciente

    // Buscar CTR actual en datos GSC
    const gscEntry = gscData.find(e => e.url === url)
    if (!gscEntry) continue

    const ctrActual = gscEntry.ctr
    const mejora = ctrActual - entry.ctr_antes

    entry.ctr_despues = ctrActual
    entry.mejora_confirmada = mejora >= 0.5
    entry.delta_ctr = mejora

    results.push({
      url,
      ctr_antes: entry.ctr_antes,
      ctr_despues: ctrActual,
      delta: mejora,
      mejora_confirmada: entry.mejora_confirmada,
    })

    if (!entry.mejora_confirmada) {
      console.log(`  [CURATOR] ${url}: CTR ${mejora >= 0 ? 'sin mejora significativa' : 'empeoró'} (${entry.ctr_antes.toFixed(2)}% -> ${ctrActual.toFixed(2)}%)`)
    } else {
      console.log(`  [CURATOR] ${url}: Mejora confirmada (${entry.ctr_antes.toFixed(2)}% -> ${ctrActual.toFixed(2)}%)`)
    }
  }

  if (results.length > 0) {
    memory.paginas_curadas_historico = historico
    saveMemory(memory)
  }

  return results
}

// ══════════════════════════════════════════════════
// PIPELINE PRINCIPAL
// ══════════════════════════════════════════════════

async function runCuratorAgent() {
  console.log('==================================================')
  console.log('  CURATOR-AGENT v1 — Content Curation Specialist')
  console.log(`  ${new Date().toISOString().split('T')[0]}`)
  console.log('==================================================\n')

  if (!AGENT.OPENAI_API_KEY) {
    console.warn('  [CURATOR] OPENAI_API_KEY no configurada. Modulo desactivado.')
    return { status: 'disabled' }
  }

  const results = {
    status: 'completed',
    curadas: 0,
    drafts: 0,
    failed: 0,
    skipped: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    impact_measured: [],
    details: [],
  }

  // ── PASO 1: Recolectar datos GSC + BWT ──
  console.log('  [PASO 1] Recolectando datos GSC + BWT (90 dias)...\n')
  const gscRows = await fetchGscPageData()
  const bwtRows = await fetchBwtQueryStats()

  if (gscRows.length === 0) {
    console.warn('  [CURATOR] Sin datos de GSC. Abortando.')
    return { status: 'no_data' }
  }

  console.log(`  [CURATOR] ${gscRows.length} filas GSC, ${bwtRows.length} filas BWT\n`)

  // ── Agregar datos por URL ──
  const urlData = aggregateByUrl(gscRows, bwtRows)
  console.log(`  [CURATOR] ${urlData.length} URLs unicas\n`)

  // ── PASO 7 (adelantado): Medir impacto de curaciones anteriores ──
  console.log('  [PASO 7] Midiendo impacto de curaciones anteriores...\n')
  results.impact_measured = await measureImpact(urlData)
  if (results.impact_measured.length > 0) {
    const mejoradas = results.impact_measured.filter(r => r.mejora_confirmada).length
    console.log(`  [CURATOR] ${results.impact_measured.length} medidas, ${mejoradas} con mejora confirmada\n`)
  } else {
    console.log('  [CURATOR] Sin curaciones antiguas para medir\n')
  }

  // ── PASO 2: Filtrar candidatas ──
  console.log('  [PASO 2] Filtrando candidatas...\n')

  // Obtener paginas optimizadas por IMPERIAL-AGENT esta semana
  const memory = readMemory()
  const imperialOptimized = (memory.paginas_optimizadas_semana || [])
    .filter(e => e.modulo !== 'curator')
    .map(e => e.url)

  const candidates = urlData.filter(entry => {
    // Impresiones minimas
    if (entry.impressions < MIN_IMPRESSIONS) return false
    // Posicion 1-20
    if (entry.position < 1 || entry.position > 20) return false
    // Detectar tipo y verificar CTR bajo benchmark
    const tipo = detectPageType(entry.url)
    const benchmark = CTR_BENCHMARKS[tipo] || 3.0
    if (entry.ctr >= benchmark) return false
    // No curada recientemente por CURATOR
    if (wasCuratedRecently(entry.url)) return false
    // No optimizada por IMPERIAL esta semana
    if (imperialOptimized.includes(entry.url)) return false
    // No optimizada recientemente (7 dias)
    if (wasRecentlyOptimized(entry.url, 7)) return false
    return true
  })

  console.log(`  [CURATOR] ${candidates.length} candidatas despues del filtro\n`)

  if (candidates.length === 0) {
    console.log('  [CURATOR] No hay candidatas para curar.')
    return { ...results, status: 'no_candidates' }
  }

  // ── PASO 3: Calcular curator_score ──
  console.log('  [PASO 3] Calculando curator_score...\n')

  for (const candidate of candidates) {
    const tipo = detectPageType(candidate.url)
    const slug = extractSlug(candidate.url)

    // Obtener HTML para analizar metricas
    let contentHtml = null
    if (slug) contentHtml = await getContentHtmlFromDb(slug)
    if (!contentHtml) contentHtml = await getContentHtmlFromUrl(candidate.url)

    candidate.content_html = contentHtml
    candidate.metricas = analyzeHtml(contentHtml)
    candidate.tipo = tipo
    candidate.slug = slug
    candidate.score = calculateCuratorScore(candidate, tipo)
  }

  // ── PASO 4: Seleccionar top N ──
  const selected = candidates
    .filter(c => c.score.total >= 25) // Minimo MEDIO
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, MAX_PAGES)

  console.log(`  [PASO 4] ${selected.length} paginas seleccionadas (de ${candidates.filter(c => c.score.total >= 25).length} >= MEDIO)\n`)

  if (selected.length === 0) {
    console.log('  [CURATOR] Ninguna pagina supero el umbral minimo.')
    return { ...results, status: 'no_candidates_above_threshold' }
  }

  // Listar seleccionadas
  for (const s of selected) {
    console.log(`  [${s.score.clasificacion}] score=${s.score.total} | CTR=${s.ctr.toFixed(2)}% | pos=${s.position.toFixed(1)} | ${s.url}`)
  }
  console.log('')

  // ── PASO 5: Diagnostico + Reescritura por cada pagina ──
  console.log('  [PASO 5] Diagnostico y reescritura...\n')

  for (const page of selected) {
    console.log(`  [CURATOR] Procesando: ${page.url}`)
    console.log(`    Tipo: ${page.tipo} | Score: ${page.score.total} (${page.score.clasificacion})`)
    console.log(`    CTR: ${page.ctr.toFixed(2)}% vs benchmark: ${page.score.benchmark}% | Gap: ${page.score.ctr_gap.toFixed(2)}%`)

    if (!page.content_html) {
      console.error(`    -> Sin HTML disponible. Saltando.`)
      results.skipped++
      continue
    }

    // ── 5a: Diagnostico GPT ──
    const diagResponse = await gptCall(
      diagnosticoPrompt.getSystemPrompt(),
      diagnosticoPrompt.getUserPrompt({
        url: page.url,
        tipo: page.tipo,
        posicion: page.position.toFixed(1),
        ctr: page.ctr.toFixed(2),
        benchmark: page.score.benchmark,
        impresiones: page.impressions,
        top_queries: page.top_queries,
        metricas: page.metricas,
        content_html: page.content_html,
      }),
      { moduleNumber: 11 }
    )

    if (diagResponse.budget_blocked) {
      console.warn('  [CURATOR] Presupuesto bloqueado. Deteniendo.')
      results.skipped += selected.length - results.curadas - results.drafts - results.failed
      break
    }

    if (!diagResponse.parsed) {
      console.error(`    -> Diagnostico fallo. Saltando.`)
      results.failed++
      continue
    }

    results.total_tokens += diagResponse.tokens_used || 0
    results.total_cost_usd += diagResponse.cost_usd || 0

    const diagnostico = diagResponse.parsed
    console.log(`    Diagnostico: ${diagnostico.diagnostico_principal}`)

    // ── 5b: Reescritura GPT (con aprendizajes de A/B tests) ──
    const promptModule = getPromptForType(page.tipo)
    const learningsBlock = formatLearningsForPrompt()

    const rewriteResponse = await gptCall(
      promptModule.getSystemPrompt() + learningsBlock,
      promptModule.getUserPrompt({
        url: page.url,
        top_queries: page.top_queries,
        posicion: page.position.toFixed(1),
        ctr: page.ctr.toFixed(2),
        benchmark: page.score.benchmark,
        impresiones: page.impressions,
        diagnostico,
        content_html: page.content_html,
      }),
      { moduleNumber: 11, maxTokens: 8192 }
    )

    if (rewriteResponse.budget_blocked) {
      console.warn('  [CURATOR] Presupuesto bloqueado en reescritura. Deteniendo.')
      results.skipped += selected.length - results.curadas - results.drafts - results.failed
      break
    }

    if (!rewriteResponse.parsed || !rewriteResponse.parsed.content_html_curado) {
      console.error(`    -> Reescritura fallo. Saltando.`)
      results.failed++
      continue
    }

    results.total_tokens += rewriteResponse.tokens_used || 0
    results.total_cost_usd += rewriteResponse.cost_usd || 0

    const curated = rewriteResponse.parsed
    const score = curated.confidence_score || 0

    console.log(`    Confidence: ${score} | Palabras: ${curated.palabras_antes} -> ${curated.palabras_despues}`)
    console.log(`    Cambios: ${(curated.cambios_realizados || []).join(', ')}`)

    // ── 5c: Decidir publicar o A/B test o draft ──
    if (score >= MIN_CONFIDENCE) {
      // Intentar activar A/B test si AB-TESTER esta disponible
      let usedAbTest = false
      const abEnabled = process.env.AB_TEST_DURATION_DAYS !== '0'

      if (abEnabled) {
        try {
          const abDb = await getDbPool()
          if (abDb) {
            const activeTests = await getActiveTests(abDb)
            if (activeTests.length < MAX_CONCURRENT) {
              const abResult = await activateAbTest(abDb, page.slug, page.content_html, curated.content_html_curado)
              if (abResult.success) {
                usedAbTest = true
                markOptimized(page.url, 'curator_ab')
                logAction('curator_ab_test', {
                  url: page.url,
                  slug: page.slug,
                  tipo: page.tipo,
                  score,
                  ctr_antes: page.ctr,
                  curator_score: page.score.total,
                  cambios: curated.cambios_realizados,
                })
                results.curadas++
                console.log(`    -> A/B TEST ACTIVADO (${activeTests.length + 1}/${MAX_CONCURRENT} slots)`)
              }
              await closePool(abDb)
            } else {
              console.log(`    -> A/B tests llenos (${activeTests.length}/${MAX_CONCURRENT}). Publicando directo.`)
              await closePool(abDb)
            }
          }
        } catch (err) {
          console.warn(`    -> A/B test no disponible: ${err.message}. Publicando directo.`)
        }
      }

      // Fallback: publicar directo si A/B no se activo
      if (!usedAbTest) {
        const dbResult = await updateContentHtml(page.slug, curated.content_html_curado)

        if (dbResult.success) {
          markOptimized(page.url, 'curator')
          logAction('curator_publish', {
            url: page.url,
            slug: page.slug,
            tipo: page.tipo,
            score,
            ctr_antes: page.ctr,
            curator_score: page.score.total,
            cambios: curated.cambios_realizados,
          })
          results.curadas++
          console.log(`    -> PUBLICADO DIRECTO`)

          // Enviar a IndexNow
          const indexResult = await sendToIndexNow(page.url)
          if (indexResult.success) {
            console.log(`    -> IndexNow: OK`)
          }
        } else {
          console.error(`    -> Error DB: ${dbResult.error}`)
          results.failed++
        }
      }

      // Registrar en historico de curaciones
      const mem = readMemory()
      if (!mem.paginas_curadas_historico) mem.paginas_curadas_historico = {}
      mem.paginas_curadas_historico[page.url] = {
        veces_curada: ((mem.paginas_curadas_historico[page.url] || {}).veces_curada || 0) + 1,
        ultima_curacion: new Date().toISOString(),
        ctr_antes: page.ctr,
        ctr_despues: null,
        mejora_confirmada: null,
        ab_test: usedAbTest,
        cambios: curated.cambios_realizados || [],
        secciones_añadidas: curated.secciones_añadidas || [],
      }
      if (!mem.paginas_curadas_semana) mem.paginas_curadas_semana = []
      mem.paginas_curadas_semana.push({
        url: page.url,
        slug: page.slug,
        tipo: page.tipo,
        score,
        ab_test: usedAbTest,
        fecha: new Date().toISOString(),
      })
      saveMemory(mem)
    } else {
      // Guardar como draft
      addDraft({
        tipo: 'content_curation',
        url: page.url,
        modulo: 'curator',
        score,
        data: curated,
      })
      saveDraft(page.url, page.slug, curated)
      logAction('curator_draft', { url: page.url, slug: page.slug, score })
      results.drafts++
      console.log(`    -> DRAFT (score ${score} < ${MIN_CONFIDENCE})`)
    }

    results.details.push({
      url: page.url,
      slug: page.slug,
      tipo: page.tipo,
      curator_score: page.score.total,
      clasificacion: page.score.clasificacion,
      ctr_antes: page.ctr,
      ctr_gap: page.score.ctr_gap,
      action: score >= MIN_CONFIDENCE ? 'published' : 'draft',
      confidence: score,
      cambios: curated.cambios_realizados || [],
      secciones_añadidas: curated.secciones_añadidas || [],
    })

    // Rate limiting (2s entre paginas — diagnostico + reescritura son 2 llamadas)
    await new Promise(r => setTimeout(r, 2000))
  }

  // ── PASO 8: Generar reporte ──
  console.log('\n  [PASO 8] Generando reporte...\n')

  const report = {
    fecha: new Date().toISOString(),
    agente: CURATOR_TAG,
    resumen: {
      candidatas_totales: candidates.length,
      seleccionadas: selected.length,
      curadas: results.curadas,
      drafts: results.drafts,
      failed: results.failed,
      skipped: results.skipped,
      tokens_usados: results.total_tokens,
      costo_usd: results.total_cost_usd,
    },
    impacto_curaciones_anteriores: results.impact_measured,
    detalle: results.details,
  }

  // Guardar reporte local
  const reportDir = path.resolve(REPORTS_DIR)
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, 'curator_report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`  [SAVE] ${reportPath}`)

  // Copiar al admin CMS
  try {
    const adminDir = AGENT.ADMIN_REPORTS_DIR || '/home/daniel/ManhwaImperialAdmin/reports'
    if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true })
    const adminPath = path.join(adminDir, 'curator_report.json')
    fs.writeFileSync(adminPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(`  [ADMIN] ${adminPath}`)
  } catch (err) {
    console.error(`  [ADMIN] Error copiando reporte: ${err.message}`)
  }

  console.log(`\n  [CURATOR] Resumen: ${results.curadas} publicadas, ${results.drafts} drafts, ${results.failed} fallidas, ${results.skipped} saltadas`)
  console.log(`  [CURATOR] Tokens: ${results.total_tokens} | Costo: $${results.total_cost_usd.toFixed(4)}`)

  return results
}

module.exports = { runCuratorAgent }
