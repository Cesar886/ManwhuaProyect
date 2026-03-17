/**
 * IA-AGENT: Optimizador Autónomo de Titles y Meta Descriptions
 *
 * Flujo completo:
 *   CAPA 1 → Lee quick_wins_unificado.json (datos de GSC + BWT)
 *   CAPA 2 → IA genera nuevos titles/metas optimizados para CTR
 *   CAPA 3 → Publica si confidence ≥ 0.75, draft si < 0.75
 *
 * Prioriza queries con posición 4-15 y más impresiones.
 * Respeta límite de MAX_TITLES_PER_RUN para control de costos.
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')
const { callAI, shouldPauseGeneration } = require('./aiReasoner')
const { executeTitleOptimization, logAction } = require('./autonomousExecutor')
const titlePrompt = require('../prompts/titleOptimizer.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')

/**
 * IA-AGENT: Obtener title y meta actual de una URL vía CMS API o fetch
 */
async function getCurrentMeta(url) {
  try {
    // Intentar obtener del CMS primero
    if (AGENT.CMS_API_KEY) {
      const slug = extractSlug(url)
      if (slug) {
        const response = await axios.get(`${AGENT.CMS_API_BASE}/series/${slug}`, {
          headers: { 'x-api-key': AGENT.CMS_API_KEY },
          timeout: 10000,
        })
        if (response.data) {
          return {
            title: response.data.meta_title || response.data.title || '',
            meta_description: response.data.meta_description || response.data.synopsis?.slice(0, 155) || '',
            slug,
          }
        }
      }
    }
  } catch { /* fallback a fetch */ }

  // Fallback: fetch HTML y parsear tags
  try {
    const response = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'SEO-Agent/1.0' } })
    const html = response.data
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)">/i)
    return {
      title: titleMatch?.[1] || '',
      meta_description: metaMatch?.[1] || '',
      slug: extractSlug(url),
    }
  } catch {
    return { title: '', meta_description: '', slug: extractSlug(url) }
  }
}

// IA-AGENT: Extraer slug de una URL de manhwaimperial.site
function extractSlug(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\/manhwa\/([^/]+)/)
    if (match) return match[1]
    // Intentar el último segmento como slug
    const parts = pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

/**
 * IA-AGENT: Ejecutar optimización autónoma de titles y meta descriptions
 *
 * @param {Array} [quickWinsData] - Datos de quick wins (si no se pasa, lee del archivo)
 * @returns {Promise<Object>} Resumen de optimizaciones
 */
async function runQuickWinsOptimizer(quickWinsData) {
  console.log('🔧 Optimizador Autónomo de Titles (IA)...\n')

  // IA-AGENT: Verificar que la API key de IA esté configurada
  if (!AGENT.AI_API_KEY) {
    console.warn('  ⚠ AI_API_KEY no configurada. Módulo desactivado.')
    return { status: 'disabled', reason: 'AI_API_KEY not set' }
  }

  // CAPA 1: Obtener datos de quick wins
  let quickWins = quickWinsData
  if (!quickWins) {
    const filePath = path.join(REPORTS_DIR, 'quick_wins_unificado.json')
    if (!fs.existsSync(filePath)) {
      console.warn('  ⚠ No se encontró quick_wins_unificado.json. Ejecutar pipeline primero.')
      return { status: 'no_data', reason: 'quick_wins_unificado.json not found' }
    }
    quickWins = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  // IA-AGENT: Filtrar candidatos para optimización de title
  const candidates = quickWins
    .filter(qw => {
      const bestPos = Math.min(qw.posicion_google || 100, qw.posicion_bing || 100)
      return bestPos >= AGENT.FILTERS.TITLE_OPT_MIN_POSITION &&
             bestPos <= AGENT.FILTERS.TITLE_OPT_MAX_POSITION &&
             (qw.impresiones_google + qw.impresiones_bing) >= AGENT.FILTERS.TITLE_OPT_MIN_IMPRESSIONS
    })
    .slice(0, AGENT.LIMITS.MAX_TITLES_PER_RUN)

  if (candidates.length === 0) {
    console.log('  → No hay candidatos para optimización de titles.')
    return { status: 'no_candidates', optimized: 0, drafted: 0 }
  }

  console.log(`  → ${candidates.length} candidatos seleccionados para optimización\n`)

  const results = {
    status: 'completed',
    optimized: 0,
    drafted: 0,
    failed: 0,
    skipped: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    details: [],
  }

  // CAPA 2 + CAPA 3: Para cada candidato, generar y ejecutar
  for (const candidate of candidates) {
    const { query, page: url, posicion_google, posicion_bing, impresiones_google, ctr_google } = candidate

    console.log(`  📝 Procesando: "${query}" → ${url}`)

    // Obtener meta actual
    const currentMeta = await getCurrentMeta(url)

    // CAPA 2: Llamar a la IA
    const systemPrompt = titlePrompt.getSystemPrompt()
    const userPrompt = titlePrompt.getUserPrompt({
      url,
      position: posicion_google || posicion_bing,
      keyword: query,
      impressions: impresiones_google + (candidate.impresiones_bing || 0),
      ctr: ctr_google || candidate.ctr_bing || 0,
      currentTitle: currentMeta.title,
      currentMeta: currentMeta.meta_description,
      positionBing: posicion_bing,
    })

    const aiResponse = await callAI(systemPrompt, userPrompt)

    if (aiResponse.budget_exceeded) {
      console.warn('  ⚠ Presupuesto semanal agotado. Deteniendo optimizaciones.')
      results.skipped += candidates.length - results.optimized - results.drafted - results.failed
      break
    }

    if (!aiResponse.parsed || !aiResponse.parsed.title) {
      console.error(`    ❌ IA no devolvió respuesta válida para "${query}"`)
      results.failed++
      continue
    }

    results.total_tokens += aiResponse.tokens_used
    results.total_cost_usd += aiResponse.cost_usd

    // CAPA 3: Ejecutar (publicar o draft)
    const execResult = await executeTitleOptimization({
      url,
      slug: currentMeta.slug || extractSlug(url),
      query,
      aiResult: aiResponse.parsed,
      tokensUsed: aiResponse.tokens_used,
      costUsd: aiResponse.cost_usd,
    })

    if (execResult.action === 'published') results.optimized++
    else if (execResult.action === 'draft') results.drafted++
    else results.failed++

    results.details.push({
      query,
      url,
      action: execResult.action,
      confidence: aiResponse.parsed.confidence_score,
      new_title: aiResponse.parsed.title,
    })

    // Pausa entre llamadas para rate limiting
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`\n  📊 Resumen: ${results.optimized} publicados, ${results.drafted} drafts, ${results.failed} fallidos`)
  console.log(`  💰 Tokens: ${results.total_tokens} | Costo: $${results.total_cost_usd.toFixed(4)}\n`)

  return results
}

module.exports = { runQuickWinsOptimizer }
