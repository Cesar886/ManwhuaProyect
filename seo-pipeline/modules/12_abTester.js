/**
 * AB-TESTER v1: Autonomous A/B Testing Engine
 * Manhwa Imperial (manhwaimperial.site)
 *
 * Extension de CURATOR-AGENT. En vez de publicar HTML curado
 * directamente, crea un A/B test para medir impacto real.
 *
 * A los 14 dias publica la variante ganadora y registra
 * aprendizajes para mejorar futuras curaciones.
 *
 * Schedule: 0 4 * * 5 (Viernes 4 AM)
 *
 * Flujo viernes:
 *   1. Leer ab_tests_activos de agent_memory
 *   2. Verificar tests que cumplieron 14 dias
 *   3. Consultar GA4 Data API por metricas
 *   4. Consultar GSC por CTR en el periodo
 *   5. Calcular winner_score
 *   6. Prompt GPT-4o analisis del resultado
 *   7. Publicar ganador en content_html de DB
 *   8. Limpiar campos AB, enviar a IndexNow
 *   9. Guardar aprendizaje en ab_learnings.json
 *  10. Reporte al CMS
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')
const { gptCall } = require('../core/gptClient')
const { readMemory, saveMemory, markOptimized } = require('../core/agentMemory')
const { getSchema } = require('../core/dbClient')
const { logAction } = require('./autonomousExecutor')
const abAnalyzerPrompt = require('../prompts/ab_analyzer.prompt')

// Configuracion
const AB_TESTER_TAG = 'AB-TESTER-v1'
const MAX_CONCURRENT = parseInt(process.env.AB_MAX_CONCURRENT_TESTS) || 10
const MIN_SESSIONS = parseInt(process.env.AB_MIN_SESSIONS_TO_DECIDE) || 50
const TEST_DURATION_DAYS = parseInt(process.env.AB_TEST_DURATION_DAYS) || 14
const ABORT_CTR_DROP_PCT = parseInt(process.env.AB_ABORT_CTR_DROP_PCT) || 30
const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const LEARNINGS_PATH = path.resolve('./data/ab_learnings.json')

// ══════════════════════════════════════════════════
// DB HELPERS — Leer/escribir campos A/B
// ══════════════════════════════════════════════════

async function getDbPool() {
  const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()
  if (dbType === 'mysql') {
    const mysql = require('mysql2/promise')
    return {
      type: 'mysql',
      pool: await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        connectionLimit: 3,
      }),
    }
  } else if (dbType === 'mongodb') {
    const { MongoClient } = require('mongodb')
    const uri = process.env.MONGODB_URI ||
      `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME}`
    const client = new MongoClient(uri)
    await client.connect()
    return { type: 'mongodb', pool: client.db(process.env.DB_NAME), client }
  }
  return null
}

async function closePool(dbInfo) {
  if (!dbInfo) return
  try {
    if (dbInfo.type === 'mysql') await dbInfo.pool.end()
    else if (dbInfo.type === 'mongodb') await dbInfo.client.close()
  } catch { /* ya cerrada */ }
}

/**
 * Activar A/B test para una pagina
 */
async function activateAbTest(dbInfo, slug, originalHtml, curatedHtml) {
  if (!dbInfo) return { success: false, error: 'Sin DB' }

  try {
    if (dbInfo.type === 'mysql') {
      const [result] = await dbInfo.pool.query(
        `UPDATE pages SET
          html_variant_a = ?,
          html_variant_b = ?,
          ab_test_active = TRUE,
          ab_test_start = NOW(),
          ab_test_variant_a_sessions = 0,
          ab_test_variant_b_sessions = 0,
          ab_winner = NULL,
          ab_test_end = NULL,
          updated_at = NOW(),
          updated_by = ?
        WHERE slug = ?`,
        [originalHtml, curatedHtml, AB_TESTER_TAG, slug]
      )
      return { success: result.affectedRows > 0 }
    } else {
      const result = await dbInfo.pool.collection('pages').updateOne(
        { slug },
        {
          $set: {
            html_variant_a: originalHtml,
            html_variant_b: curatedHtml,
            ab_test_active: true,
            ab_test_start: new Date(),
            ab_test_variant_a_sessions: 0,
            ab_test_variant_b_sessions: 0,
            ab_winner: null,
            ab_test_end: null,
            updated_at: new Date(),
            updated_by: AB_TESTER_TAG,
          },
        }
      )
      return { success: result.matchedCount > 0 }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Obtener tests activos de la DB
 */
async function getActiveTests(dbInfo) {
  if (!dbInfo) return []

  try {
    if (dbInfo.type === 'mysql') {
      const [rows] = await dbInfo.pool.query(
        `SELECT id, slug, ab_test_start, ab_test_variant_a_sessions,
                ab_test_variant_b_sessions, html_variant_a, html_variant_b
         FROM pages WHERE ab_test_active = TRUE`
      )
      return rows
    } else {
      return await dbInfo.pool.collection('pages')
        .find({ ab_test_active: true })
        .project({
          slug: 1, ab_test_start: 1,
          ab_test_variant_a_sessions: 1, ab_test_variant_b_sessions: 1,
          html_variant_a: 1, html_variant_b: 1,
        })
        .toArray()
    }
  } catch (err) {
    console.error(`  [AB-TEST] Error leyendo tests activos: ${err.message}`)
    return []
  }
}

/**
 * Publicar ganador y limpiar campos AB
 */
async function publishWinner(dbInfo, slug, winnerHtml, winner) {
  if (!dbInfo) return { success: false }

  try {
    if (dbInfo.type === 'mysql') {
      const schema = getSchema()
      const contentCol = 'content_html'
      // Detectar nombre real de la columna content
      if (schema?.columns) {
        for (const [, info] of Object.entries(schema.columns)) {
          if (info.detected.content_html) {
            // Usar el nombre detectado
            break
          }
        }
      }

      const [result] = await dbInfo.pool.query(
        `UPDATE pages SET
          ${contentCol} = ?,
          ab_test_active = FALSE,
          ab_winner = ?,
          ab_test_end = NOW(),
          html_variant_a = NULL,
          html_variant_b = NULL,
          ab_test_variant_a_sessions = 0,
          ab_test_variant_b_sessions = 0,
          updated_at = NOW(),
          updated_by = ?
        WHERE slug = ?`,
        [winnerHtml, winner, AB_TESTER_TAG, slug]
      )
      return { success: result.affectedRows > 0 }
    } else {
      const result = await dbInfo.pool.collection('pages').updateOne(
        { slug },
        {
          $set: {
            content_html: winnerHtml,
            ab_test_active: false,
            ab_winner: winner,
            ab_test_end: new Date(),
            html_variant_a: null,
            html_variant_b: null,
            ab_test_variant_a_sessions: 0,
            ab_test_variant_b_sessions: 0,
            updated_at: new Date(),
            updated_by: AB_TESTER_TAG,
          },
        }
      )
      return { success: result.matchedCount > 0 }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Abortar test y restaurar variante A
 */
async function abortTest(dbInfo, slug, originalHtml) {
  if (!dbInfo) return { success: false }

  try {
    if (dbInfo.type === 'mysql') {
      const [result] = await dbInfo.pool.query(
        `UPDATE pages SET
          content_html = ?,
          ab_test_active = FALSE,
          ab_winner = 'a',
          ab_test_end = NOW(),
          html_variant_a = NULL,
          html_variant_b = NULL,
          updated_at = NOW(),
          updated_by = ?
        WHERE slug = ?`,
        [originalHtml, AB_TESTER_TAG, slug]
      )
      return { success: result.affectedRows > 0 }
    } else {
      const result = await dbInfo.pool.collection('pages').updateOne(
        { slug },
        {
          $set: {
            content_html: originalHtml,
            ab_test_active: false,
            ab_winner: 'a',
            ab_test_end: new Date(),
            html_variant_a: null,
            html_variant_b: null,
            updated_at: new Date(),
            updated_by: AB_TESTER_TAG,
          },
        }
      )
      return { success: result.matchedCount > 0 }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ══════════════════════════════════════════════════
// GA4 DATA API — Metricas de engagement
// ══════════════════════════════════════════════════

async function fetchGA4Metrics(slug, startDate, endDate) {
  const propertyId = process.env.GA4_PROPERTY_ID
  const keyPath = process.env.GA4_SERVICE_ACCOUNT_KEY
  if (!propertyId || !keyPath) {
    console.warn('  [AB-TEST] GA4 no configurado (GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_KEY)')
    return null
  }

  try {
    const { GoogleAuth } = require('google-auth-library')
    const auth = new GoogleAuth({
      keyFile: path.resolve(keyPath),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const client = await auth.getClient()

    // Metricas por variante usando custom event dimension
    const variants = {}
    for (const variant of ['a', 'b']) {
      const response = await client.request({
        url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        method: 'POST',
        data: {
          dateRanges: [{
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [
            { name: 'sessions' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
            { name: 'engagedSessions' },
            { name: 'scrolledUsers' },
            { name: 'engagementRate' },
          ],
          dimensionFilter: {
            andGroup: {
              expressions: [
                {
                  filter: {
                    fieldName: 'pagePath',
                    stringFilter: { matchType: 'CONTAINS', value: slug },
                  },
                },
                {
                  filter: {
                    fieldName: 'customEvent:ab_variant',
                    stringFilter: { matchType: 'EXACT', value: variant },
                  },
                },
              ],
            },
          },
        },
      })

      const row = response.data.rows?.[0]
      if (row) {
        variants[variant] = {
          sessions: parseInt(row.metricValues[0]?.value) || 0,
          avg_duration: parseFloat(row.metricValues[1]?.value) || 0,
          bounce_rate: parseFloat(row.metricValues[2]?.value) || 0,
          engaged_sessions: parseInt(row.metricValues[3]?.value) || 0,
          scrolled_users: parseInt(row.metricValues[4]?.value) || 0,
          engagement_rate: parseFloat(row.metricValues[5]?.value) || 0,
        }
      } else {
        variants[variant] = {
          sessions: 0, avg_duration: 0, bounce_rate: 0,
          engaged_sessions: 0, scrolled_users: 0, engagement_rate: 0,
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500))
    }

    return variants
  } catch (err) {
    console.error(`  [AB-TEST] Error GA4: ${err.message}`)
    return null
  }
}

// ══════════════════════════════════════════════════
// GSC — CTR durante periodo del test
// ══════════════════════════════════════════════════

async function fetchGscCtrForPeriod(url, startDate, endDate) {
  const credPath = process.env.GOOGLE_CREDENTIALS_PATH
  const siteUrl = process.env.GSC_SITE_URL
  if (!credPath || !siteUrl) return null

  try {
    const { GoogleAuth } = require('google-auth-library')
    const auth = new GoogleAuth({
      keyFile: path.resolve(credPath),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    const client = await auth.getClient()

    const response = await client.request({
      url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      method: 'POST',
      data: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['page'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'page', expression: url, operator: 'equals' }],
        }],
        rowLimit: 1,
      },
    })

    const row = response.data.rows?.[0]
    if (row) {
      return {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
        position: row.position,
      }
    }
  } catch (err) {
    console.error(`  [AB-TEST] Error GSC CTR: ${err.message}`)
  }
  return null
}

// ══════════════════════════════════════════════════
// FORMULA DE DECISION
// ══════════════════════════════════════════════════

function calculateWinnerScore(metricsA, metricsB, ctrDelta) {
  const engDelta = (metricsB.engagement_rate - metricsA.engagement_rate) * 100
  const durDelta = metricsA.avg_duration > 0
    ? ((metricsB.avg_duration - metricsA.avg_duration) / metricsA.avg_duration) * 100
    : 0
  const scrollDelta = metricsA.scrolled_users > 0
    ? ((metricsB.scrolled_users - metricsA.scrolled_users) / metricsA.scrolled_users) * 100
    : 0

  const winnerScore =
    engDelta * 0.40 +
    durDelta * 0.30 +
    scrollDelta * 0.20 +
    (ctrDelta * 100) * 0.10

  return {
    winner_score: winnerScore,
    engagement_delta: engDelta,
    duration_delta: durDelta,
    scroll_delta: scrollDelta,
    ctr_delta: ctrDelta,
  }
}

// ══════════════════════════════════════════════════
// APRENDIZAJES
// ══════════════════════════════════════════════════

function readLearnings() {
  try {
    if (fs.existsSync(LEARNINGS_PATH)) {
      return JSON.parse(fs.readFileSync(LEARNINGS_PATH, 'utf-8'))
    }
  } catch { /* corrupto */ }
  return { reglas_activas: [], historial: [] }
}

function saveLearnings(learnings) {
  const dir = path.dirname(LEARNINGS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = LEARNINGS_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(learnings, null, 2), 'utf-8')
  fs.renameSync(tmp, LEARNINGS_PATH)
}

function addLearning(analysis, testData) {
  const learnings = readLearnings()

  const entry = {
    fecha: new Date().toISOString(),
    url: testData.url,
    tipo: testData.tipo,
    ganador: analysis.ganador,
    patron_exitoso: analysis.patron_exitoso,
    patron_fallido: analysis.patron_fallido,
    aprendizaje: analysis.aprendizaje_para_curator,
    confidence: analysis.confidence_aprendizaje,
    mejora_engagement_pct: analysis.mejora_engagement_pct,
  }

  learnings.historial.push(entry)

  // Agregar como regla activa si tiene alta confidence
  if (analysis.confidence_aprendizaje >= 0.7 && analysis.aprendizaje_para_curator) {
    // No duplicar reglas similares
    const exists = learnings.reglas_activas.some(r =>
      r.aprendizaje === analysis.aprendizaje_para_curator
    )
    if (!exists) {
      learnings.reglas_activas.push({
        aprendizaje: analysis.aprendizaje_para_curator,
        confidence: analysis.confidence_aprendizaje,
        basado_en: testData.url,
        tipo_pagina: testData.tipo,
        fecha: new Date().toISOString(),
      })
      // Mantener max 20 reglas activas (las mas recientes)
      if (learnings.reglas_activas.length > 20) {
        learnings.reglas_activas = learnings.reglas_activas.slice(-20)
      }
    }
  }

  // Mantener max 100 entradas de historial
  if (learnings.historial.length > 100) {
    learnings.historial = learnings.historial.slice(-100)
  }

  saveLearnings(learnings)
  return entry
}

/**
 * Obtener reglas activas para inyectar en prompts de CURATOR
 */
function getActiveLearnings() {
  const learnings = readLearnings()
  return learnings.reglas_activas || []
}

/**
 * Formatear aprendizajes como bloque de texto para SYSTEM prompt
 */
function formatLearningsForPrompt() {
  const rules = getActiveLearnings()
  if (rules.length === 0) return ''

  const lines = rules.map((r, i) =>
    `${i + 1}. [${r.tipo_pagina}] ${r.aprendizaje} (confidence: ${r.confidence})`
  )

  return `\n\nAPRENDIZAJES DE A/B TESTS ANTERIORES (aplica estas reglas):
${lines.join('\n')}`
}

// ══════════════════════════════════════════════════
// INDEXNOW
// ══════════════════════════════════════════════════

async function sendToIndexNow(url) {
  const key = process.env.INDEXNOW_KEY
  if (!key) return { success: false }

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
  } catch {
    return { success: false }
  }
}

// ══════════════════════════════════════════════════
// PROTECCION ANTI-PERDIDA
// ══════════════════════════════════════════════════

async function checkCtrDrop(url, testStart) {
  // CTR 14 dias antes del test
  const preStart = new Date(testStart.getTime() - 14 * 24 * 60 * 60 * 1000)
  const preEnd = new Date(testStart)
  const preCtr = await fetchGscCtrForPeriod(url, preStart, preEnd)

  // CTR durante el test
  const duringCtr = await fetchGscCtrForPeriod(url, testStart, new Date())

  if (!preCtr || !duringCtr || preCtr.ctr === 0) return { drop: false, preCtr, duringCtr }

  const dropPct = ((preCtr.ctr - duringCtr.ctr) / preCtr.ctr) * 100

  return {
    drop: dropPct > ABORT_CTR_DROP_PCT,
    dropPct,
    ctr_antes: preCtr.ctr,
    ctr_durante: duringCtr.ctr,
  }
}

// ══════════════════════════════════════════════════
// PIPELINE PRINCIPAL — VIERNES
// ══════════════════════════════════════════════════

async function runAbTester() {
  console.log('==================================================')
  console.log('  AB-TESTER v1 — A/B Testing Engine')
  console.log(`  ${new Date().toISOString().split('T')[0]}`)
  console.log('==================================================\n')

  const results = {
    status: 'completed',
    tests_evaluated: 0,
    winners_published: 0,
    tests_extended: 0,
    tests_aborted: 0,
    learnings_added: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    details: [],
  }

  const dbInfo = await getDbPool()
  if (!dbInfo) {
    console.error('  [AB-TEST] No se pudo conectar a la DB.')
    return { status: 'db_error' }
  }

  try {
    // ── PASO 1: Leer tests activos ──
    console.log('  [PASO 1] Leyendo A/B tests activos...\n')
    const activeTests = await getActiveTests(dbInfo)
    console.log(`  [AB-TEST] ${activeTests.length} tests activos\n`)

    if (activeTests.length === 0) {
      console.log('  [AB-TEST] Sin tests activos. Nada que evaluar.')
      await closePool(dbInfo)
      return { ...results, status: 'no_active_tests' }
    }

    const siteUrl = AGENT.SITE_URL

    for (const test of activeTests) {
      const slug = test.slug
      const testStart = new Date(test.ab_test_start)
      const daysSinceStart = (Date.now() - testStart.getTime()) / (24 * 60 * 60 * 1000)
      const url = `${siteUrl}/manhwa/${slug}`

      console.log(`  [AB-TEST] Test: ${slug}`)
      console.log(`    Inicio: ${testStart.toISOString().split('T')[0]} | Dias: ${daysSinceStart.toFixed(0)}`)
      console.log(`    Sesiones A: ${test.ab_test_variant_a_sessions} | B: ${test.ab_test_variant_b_sessions}`)

      // ── PASO 2: Verificar proteccion anti-perdida ──
      const ctrCheck = await checkCtrDrop(url, testStart)
      if (ctrCheck.drop) {
        console.error(`    [CRITICO] CTR cayo ${ctrCheck.dropPct.toFixed(1)}% -> ABORTANDO`)
        const abortResult = await abortTest(dbInfo, slug, test.html_variant_a)
        if (abortResult.success) {
          logAction('ab_test_abort', { slug, reason: 'ctr_drop', drop_pct: ctrCheck.dropPct })
          results.tests_aborted++
          await sendToIndexNow(url)
        }
        results.details.push({
          slug, action: 'aborted', reason: 'ctr_drop',
          ctr_drop_pct: ctrCheck.dropPct,
        })
        continue
      }

      // ── PASO 2b: Verificar si cumplio duracion ──
      if (daysSinceStart < TEST_DURATION_DAYS) {
        console.log(`    Aun no cumple ${TEST_DURATION_DAYS} dias. Esperando.`)
        continue
      }

      results.tests_evaluated++

      // ── PASO 3: Verificar sesiones minimas ──
      const sessionsA = test.ab_test_variant_a_sessions || 0
      const sessionsB = test.ab_test_variant_b_sessions || 0

      if (sessionsA < MIN_SESSIONS || sessionsB < MIN_SESSIONS) {
        // Verificar si ya se extendio
        const memory = readMemory()
        const testKey = `ab_extended_${slug}`
        if (memory[testKey]) {
          console.log(`    Sesiones insuficientes y ya fue extendido. Decidiendo con datos disponibles.`)
        } else {
          console.log(`    Sesiones insuficientes (A:${sessionsA}, B:${sessionsB} < ${MIN_SESSIONS}). Extendiendo 7 dias.`)
          memory[testKey] = true
          saveMemory(memory)
          results.tests_extended++
          results.details.push({ slug, action: 'extended', sessions_a: sessionsA, sessions_b: sessionsB })
          continue
        }
      }

      // ── PASO 3-4: Obtener metricas GA4 + GSC ──
      console.log(`    Obteniendo metricas GA4...`)
      const ga4Metrics = await fetchGA4Metrics(slug, testStart, new Date())

      // Fallback a sesiones de DB si GA4 no esta configurado
      let metricsA, metricsB
      if (ga4Metrics) {
        metricsA = ga4Metrics.a
        metricsB = ga4Metrics.b
      } else {
        // Sin GA4, usar solo contadores de sesiones de la DB
        console.warn(`    GA4 no disponible. Usando solo sesiones de DB.`)
        metricsA = {
          sessions: sessionsA, engagement_rate: 0, avg_duration: 0,
          bounce_rate: 0, scrolled_users: 0, engaged_sessions: 0,
        }
        metricsB = {
          sessions: sessionsB, engagement_rate: 0, avg_duration: 0,
          bounce_rate: 0, scrolled_users: 0, engaged_sessions: 0,
        }
      }

      // CTR de GSC
      const gscDuring = await fetchGscCtrForPeriod(url, testStart, new Date())
      const ctrDelta = ctrCheck.ctr_antes && gscDuring
        ? (gscDuring.ctr - ctrCheck.ctr_antes) / 100
        : 0

      // ── PASO 5: Calcular winner_score ──
      const scoring = calculateWinnerScore(metricsA, metricsB, ctrDelta)
      console.log(`    Winner score: ${scoring.winner_score.toFixed(2)}`)

      // ── PASO 6: Analisis GPT ──
      let analysis = null
      if (AGENT.OPENAI_API_KEY) {
        // Obtener info del test de memory
        const memory = readMemory()
        const curatorHistorico = memory.paginas_curadas_historico || {}
        const curatorEntry = curatorHistorico[url] || {}

        const tipo = slug.match(/^(lista|top|mejores)/) ? 'lista'
          : slug.match(/^(resena|review)/) ? 'resena'
            : slug.match(/^(genero|tag)/) ? 'genero'
              : 'obra'

        const aiResponse = await gptCall(
          abAnalyzerPrompt.getSystemPrompt(),
          abAnalyzerPrompt.getUserPrompt({
            url,
            tipo,
            duracion_dias: Math.round(daysSinceStart),
            cambios_realizados: curatorEntry.cambios || [],
            secciones_añadidas: curatorEntry.secciones_añadidas || [],
            variante_a: metricsA,
            variante_b: metricsB,
            ctr_antes: ctrCheck.ctr_antes || 0,
            ctr_durante: gscDuring?.ctr || 0,
            ctr_delta: ctrDelta * 100,
          }),
          { moduleNumber: 12 }
        )

        if (!aiResponse.budget_blocked && aiResponse.parsed) {
          analysis = aiResponse.parsed
          results.total_tokens += aiResponse.tokens_used || 0
          results.total_cost_usd += aiResponse.cost_usd || 0
        }
      }

      // Determinar ganador
      const winner = analysis?.ganador ||
        (scoring.winner_score > 0 ? 'b' : 'a')
      const winnerHtml = winner === 'b' ? test.html_variant_b : test.html_variant_a

      console.log(`    Ganador: variante ${winner.toUpperCase()}`)

      // ── PASO 7: Publicar ganador ──
      const pubResult = await publishWinner(dbInfo, slug, winnerHtml, winner)

      if (pubResult.success) {
        markOptimized(url, 'ab_tester')
        logAction('ab_test_winner', {
          slug, winner,
          winner_score: scoring.winner_score,
          sessions_a: sessionsA,
          sessions_b: sessionsB,
          engagement_delta: scoring.engagement_delta,
        })
        results.winners_published++
        console.log(`    -> Publicado variante ${winner.toUpperCase()}`)

        // ── PASO 8: IndexNow ──
        const indexResult = await sendToIndexNow(url)
        if (indexResult.success) console.log(`    -> IndexNow: OK`)

        // ── PASO 9: Guardar aprendizaje ──
        if (analysis) {
          addLearning(analysis, { url, tipo: analysis.ganador === 'b' ? 'mejora' : 'sin_mejora' })
          results.learnings_added++
          console.log(`    -> Aprendizaje: ${analysis.aprendizaje_para_curator || '(sin aprendizaje)'}`)
        }

        // Limpiar flag de extension
        const mem = readMemory()
        delete mem[`ab_extended_${slug}`]
        saveMemory(mem)
      } else {
        console.error(`    -> Error publicando: ${pubResult.error}`)
      }

      results.details.push({
        slug,
        action: 'resolved',
        winner,
        winner_score: scoring.winner_score,
        sessions_a: sessionsA,
        sessions_b: sessionsB,
        engagement_delta: scoring.engagement_delta,
        duration_delta: scoring.duration_delta,
        ctr_delta: ctrDelta,
        analysis: analysis ? {
          patron_exitoso: analysis.patron_exitoso,
          aprendizaje: analysis.aprendizaje_para_curator,
        } : null,
      })

      // Rate limiting
      await new Promise(r => setTimeout(r, 1500))
    }

    // ── PASO 10: Generar reporte ──
    console.log('\n  [PASO 10] Generando reporte...\n')

    const report = {
      fecha: new Date().toISOString(),
      agente: AB_TESTER_TAG,
      resumen: {
        tests_activos: activeTests.length,
        evaluados: results.tests_evaluated,
        ganadores_publicados: results.winners_published,
        extendidos: results.tests_extended,
        abortados: results.tests_aborted,
        aprendizajes: results.learnings_added,
        tokens: results.total_tokens,
        costo_usd: results.total_cost_usd,
      },
      reglas_activas: getActiveLearnings(),
      detalle: results.details,
    }

    // Guardar reportes
    const reportDir = path.resolve(REPORTS_DIR)
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
    const reportPath = path.join(reportDir, 'ab_tester_report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(`  [SAVE] ${reportPath}`)

    try {
      const adminDir = AGENT.ADMIN_REPORTS_DIR || '/home/daniel/ManhwaImperialAdmin/reports'
      if (!fs.existsSync(adminDir)) fs.mkdirSync(adminDir, { recursive: true })
      const adminPath = path.join(adminDir, 'ab_tester_report.json')
      fs.writeFileSync(adminPath, JSON.stringify(report, null, 2), 'utf-8')
      console.log(`  [ADMIN] ${adminPath}`)
    } catch (err) {
      console.error(`  [ADMIN] Error: ${err.message}`)
    }

    console.log(`\n  [AB-TEST] Resumen: ${results.winners_published} ganadores, ${results.tests_extended} extendidos, ${results.tests_aborted} abortados`)

  } finally {
    await closePool(dbInfo)
  }

  return results
}

module.exports = {
  runAbTester,
  activateAbTest,
  getActiveTests,
  getActiveLearnings,
  formatLearningsForPrompt,
  getDbPool,
  closePool,
  MAX_CONCURRENT,
}
