/**
 * IA-AGENT: Optimizador Autónomo de Schema Markup
 *
 * Para cada página con CTR < 2% en quick_wins, genera un schema JSON-LD
 * mejorado que maximice la probabilidad de Rich Snippets.
 *
 * Flujo:
 *   CAPA 1 → Lee quick_wins con CTR bajo
 *   CAPA 2 → IA genera schema mejorado según tipo de página
 *   CAPA 3 → Aplica si confidence ≥ 0.75, draft si < 0.75
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')
const { callAI } = require('./aiReasoner')
const { executeSchemaOptimization, logAction } = require('./autonomousExecutor')
const schemaPrompt = require('../prompts/schemaOptimizer.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')

// IA-AGENT: Detectar tipo de página por URL
function detectPageType(url) {
  try {
    const pathname = new URL(url).pathname
    if (pathname.includes('/manhwa/') && pathname.includes('/capitulo/')) return 'chapter'
    if (pathname.includes('/manhwa/')) return 'series'
    if (pathname.includes('/genero/')) return 'collection'
    if (pathname.includes('/blog/')) return 'article'
    if (pathname.includes('/populares')) return 'itemlist'
    if (pathname.includes('/biblioteca')) return 'collection'
    return 'webpage'
  } catch {
    return 'webpage'
  }
}

// IA-AGENT: Extraer slug de URL
function extractSlug(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\/manhwa\/([^/]+)/)
    return match ? match[1] : pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

// IA-AGENT: Obtener schema actual de una página
async function getCurrentSchema(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'SEO-Agent/1.0' },
    })
    const html = response.data
    // Buscar JSON-LD en el HTML
    const schemaMatches = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
    if (schemaMatches) {
      const schemas = []
      for (const match of schemaMatches) {
        const jsonStr = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
        try {
          schemas.push(JSON.parse(jsonStr))
        } catch { /* schema malformado */ }
      }
      return schemas.length > 0 ? schemas : null
    }
  } catch { /* no se pudo obtener */ }
  return null
}

/**
 * IA-AGENT: Ejecutar optimización autónoma de schemas
 *
 * @param {Array} [quickWinsData] - Datos de quick wins (si no se pasa, lee del archivo)
 * @returns {Promise<Object>} Resumen de optimizaciones de schema
 */
async function runSchemaOptimizer(quickWinsData) {
  console.log('🏗️  Optimizador Autónomo de Schema Markup (IA)...\n')

  if (!AGENT.AI_API_KEY) {
    console.warn('  ⚠ AI_API_KEY no configurada. Módulo desactivado.')
    return { status: 'disabled', reason: 'AI_API_KEY not set' }
  }

  // CAPA 1: Obtener quick wins con CTR bajo
  let quickWins = quickWinsData
  if (!quickWins) {
    const filePath = path.join(REPORTS_DIR, 'quick_wins_unificado.json')
    if (!fs.existsSync(filePath)) {
      console.warn('  ⚠ No se encontró quick_wins_unificado.json.')
      return { status: 'no_data' }
    }
    quickWins = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  // IA-AGENT: Filtrar páginas con CTR < 2%
  const candidates = quickWins
    .filter(qw => {
      const ctr = qw.ctr_google || qw.ctr_bing || 0
      return ctr < AGENT.FILTERS.SCHEMA_MAX_CTR && qw.page
    })
    // Eliminar URLs duplicadas
    .filter((qw, i, arr) => arr.findIndex(q => q.page === qw.page) === i)
    .slice(0, AGENT.LIMITS.MAX_SCHEMAS_PER_RUN)

  if (candidates.length === 0) {
    console.log('  → No hay candidatos para optimización de schema.')
    return { status: 'no_candidates', optimized: 0 }
  }

  console.log(`  → ${candidates.length} páginas con CTR bajo seleccionadas\n`)

  const results = {
    status: 'completed',
    optimized: 0,
    drafted: 0,
    failed: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    details: [],
  }

  for (const candidate of candidates) {
    const { page: url, posicion_google, posicion_bing, ctr_google, ctr_bing } = candidate

    console.log(`  🏗️  Procesando: ${url}`)

    const pageType = detectPageType(url)
    const currentSchema = await getCurrentSchema(url)

    // CAPA 2: Llamar a la IA
    const systemPrompt = schemaPrompt.getSystemPrompt()
    const userPrompt = schemaPrompt.getUserPrompt({
      url,
      ctr: ctr_google || ctr_bing || 0,
      position: posicion_google || posicion_bing || 0,
      currentSchema,
      pageType,
    })

    const aiResponse = await callAI(systemPrompt, userPrompt, { maxTokens: 3000 })

    if (aiResponse.budget_exceeded) {
      console.warn('  ⚠ Presupuesto agotado.')
      break
    }

    if (!aiResponse.parsed || !aiResponse.parsed.schema_jsonld) {
      console.error(`    ❌ IA no devolvió schema válido para ${url}`)
      results.failed++
      continue
    }

    results.total_tokens += aiResponse.tokens_used
    results.total_cost_usd += aiResponse.cost_usd

    // CAPA 3: Ejecutar
    const slug = extractSlug(url)
    const execResult = await executeSchemaOptimization({
      url,
      slug,
      aiResult: aiResponse.parsed,
      tokensUsed: aiResponse.tokens_used,
      costUsd: aiResponse.cost_usd,
    })

    if (execResult.action === 'published') results.optimized++
    else if (execResult.action === 'draft') results.drafted++
    else results.failed++

    results.details.push({
      url,
      pageType,
      action: execResult.action,
      confidence: aiResponse.parsed.confidence_score,
      rich_snippet_target: aiResponse.parsed.rich_snippet_target,
    })

    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`\n  📊 Schemas: ${results.optimized} actualizados, ${results.drafted} drafts, ${results.failed} fallidos`)
  console.log(`  💰 Tokens: ${results.total_tokens} | Costo: $${results.total_cost_usd.toFixed(4)}\n`)

  return results
}

module.exports = { runSchemaOptimizer }
