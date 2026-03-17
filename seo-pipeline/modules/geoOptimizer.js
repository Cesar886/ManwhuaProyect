/**
 * IMPERIAL-AGENT v3: Modulo 7 — GEO Optimizer
 *
 * OBJETIVO: Ser citado en ChatGPT, Copilot y Gemini.
 *
 * Las IAs generativas priorizan:
 *   1. Respuesta directa al inicio del texto (schema Speakable)
 *   2. FAQs con respuestas verificables (schema FAQPage)
 *   3. Datos concretos: rankings, puntuaciones, anos
 *   4. Autoridad de nicho (schema Organization con knowsAbout)
 *
 * Deteccion de trafico GEO:
 *   BWT getCopilotStats -> clics desde Copilot por URL
 *   GSC -> queries con "como","cual","donde","que manhwa","recomiendas"
 *
 * Paginas a optimizar: top 10 por impresiones + queries tipo pregunta.
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')
const { gptCall } = require('../core/gptClient')
const { updateMeta } = require('../core/dbClient')
const { wasRecentlyOptimized, markOptimized, addDraft, getCostPercentage } = require('../core/agentMemory')
const { logAction, readJsonSafe, writeJsonAtomic } = require('./autonomousExecutor')
const geoPrompt = require('../prompts/geoOptimizer.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const GEO_LOG_PATH = path.resolve(__dirname, '..', 'logs', 'geo_optimizations.json')

// Patrones de queries informativas (las que citan IAs)
const GEO_PATTERNS = [
  /^(cu[áa]l|qu[ée]|c[óo]mo|d[óo]nde|por qu[ée]|mejor|mejores|top|ranking)/i,
  /manhwa.*(recomendar|recomendaci|similar|parecido|como)/i,
  /(recomienda|recomendacion|sugerencia|lista)/i,
  /\?.*/,
]

/**
 * Detectar queries con intencion informativa
 */
function detectGeoQueries(quickWins, contentGaps) {
  const candidates = []

  for (const qw of (quickWins || [])) {
    const query = qw.query || ''
    if (GEO_PATTERNS.some(p => p.test(query))) {
      candidates.push({
        query,
        page: qw.page,
        source: 'quick_wins',
        impressions: (qw.impresiones_google || 0) + (qw.impresiones_bing || 0),
        copilot_clicks: qw.copilot_clicks || 0,
        position: Math.min(qw.posicion_google || 100, qw.posicion_bing || 100),
      })
    }
  }

  for (const gap of (contentGaps || [])) {
    const query = gap.query || ''
    if (GEO_PATTERNS.some(p => p.test(query))) {
      candidates.push({
        query,
        page: null,
        source: 'content_gap',
        impressions: (gap.impresiones_google || 0) + (gap.impresiones_bing || 0),
        copilot_clicks: 0,
        position: null,
      })
    }
  }

  return candidates.sort((a, b) => b.impressions - a.impressions)
}

/**
 * Obtener contenido actual de una pagina
 */
async function getCurrentContent(url) {
  if (!url) return null
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'IMPERIAL-AGENT/2.0' },
    })
    const html = response.data
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)
    const schemaMatches = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)

    let existingSchemas = []
    if (schemaMatches) {
      for (const match of schemaMatches) {
        const jsonStr = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
        try { existingSchemas.push(JSON.parse(jsonStr)) } catch { /* malformado */ }
      }
    }

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    let plainText = ''
    if (bodyMatch) {
      plainText = bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500)
    }

    return { title: titleMatch?.[1] || '', h1: h1Match?.[1] || '', existingSchemas, plainText, html }
  } catch {
    return null
  }
}

/**
 * Generar Schema Organization para la home (agregar si no existe)
 */
function generateOrganizationSchema() {
  return geoPrompt.getOrganizationSchema(AGENT.SOCIAL_LINKS)
}

function extractSlug(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\/manhwa\/([^/]+)/)
    return match ? match[1] : pathname.split('/').filter(Boolean).pop() || null
  } catch { return null }
}

function detectPageType(url) {
  if (/\/listas?\//i.test(url)) return 'lista'
  if (/\/blog\/resena/i.test(url)) return 'resena'
  if (/\/genero\//i.test(url)) return 'taxonomia'
  if (/\/manhwa\//i.test(url)) return 'obra'
  return 'general'
}

/**
 * Combinar schemas generados
 */
function buildCombinedSchema(geoResult) {
  const schemas = []
  if (geoResult.schema_faqpage_actualizado) {
    schemas.push({ '@context': 'https://schema.org', ...geoResult.schema_faqpage_actualizado })
  }
  if (geoResult.schema_speakable) {
    schemas.push({ '@context': 'https://schema.org', '@type': 'WebPage', speakable: geoResult.schema_speakable })
  }
  return schemas.length === 1 ? schemas[0] : schemas
}

async function runGeoOptimizer(options = {}) {
  console.log('  [M7] GEO Optimizer — IAs Generativas...\n')

  if (!AGENT.OPENAI_API_KEY) {
    console.warn('  [M7] OPENAI_API_KEY no configurada.')
    return { status: 'disabled' }
  }

  const budget = getCostPercentage()
  if (budget.pct >= 95) {
    console.warn(`  [M7] Presupuesto al ${budget.pct.toFixed(1)}%. GEO pausado.`)
    return { status: 'budget_limit' }
  }

  // Cargar datos de modulos previos
  let quickWins = options.quickWins
  let contentGaps = options.contentGaps

  if (!quickWins) {
    const filePath = path.join(REPORTS_DIR, 'quick_wins_unificado.json')
    if (fs.existsSync(filePath)) {
      try { quickWins = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { quickWins = [] }
    }
  }
  if (!contentGaps) {
    const filePath = path.join(REPORTS_DIR, 'content_gaps_cross.json')
    if (fs.existsSync(filePath)) {
      try { contentGaps = JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { contentGaps = [] }
    }
  }

  // Detectar queries GEO
  const geoCandidates = detectGeoQueries(quickWins || [], contentGaps || [])

  if (geoCandidates.length === 0) {
    console.log('  [M7] No se detectaron queries con potencial GEO.')
    return { status: 'no_candidates', optimized: 0 }
  }

  // Top 10 con pagina existente, no optimizadas recientemente
  const candidates = geoCandidates
    .filter(c => c.page && !wasRecentlyOptimized(c.page, 7))
    .slice(0, AGENT.LIMITS.MAX_GEO_PER_RUN)

  console.log(`  [M7] ${geoCandidates.length} queries GEO, ${candidates.length} elegibles\n`)

  const results = {
    status: 'completed',
    optimized: 0,
    drafted: 0,
    failed: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    geo_signals: {
      total_copilot_clicks: geoCandidates.reduce((s, c) => s + (c.copilot_clicks || 0), 0),
      informational_queries: geoCandidates.length,
    },
    details: [],
  }

  for (const candidate of candidates) {
    const { query, page } = candidate

    console.log(`  [M7] GEO: "${query}" -> ${page}`)

    const currentContent = await getCurrentContent(page)

    // Detectar queries tipo pregunta para esta URL
    const queriesPregunta = geoCandidates
      .filter(c => c.page === page)
      .map(c => c.query)

    const aiResponse = await gptCall(
      geoPrompt.getSystemPrompt(),
      geoPrompt.getUserPrompt({
        url: page,
        tipo: detectPageType(page),
        html: currentContent?.plainText || '',
        queries_pregunta: queriesPregunta,
        clics_copilot: candidate.copilot_clicks || 0,
      }),
      { moduleNumber: 7, maxTokens: 4096 }
    )

    if (aiResponse.budget_blocked) {
      console.warn('  [M7] Presupuesto bloqueado.')
      break
    }

    if (!aiResponse.parsed) {
      console.error(`  [M7] IA no devolvio respuesta valida para "${query}"`)
      results.failed++
      continue
    }

    results.total_tokens += aiResponse.tokens_used || 0
    results.total_cost_usd += aiResponse.cost_usd || 0

    const geoResult = aiResponse.parsed
    const score = geoResult.confidence_score || 0

    if (score >= AGENT.CONFIDENCE_THRESHOLD) {
      // Actualizar en DB
      const slug = extractSlug(page)
      const schemaData = buildCombinedSchema(geoResult)

      let success = false
      if (slug) {
        const dbResult = await updateMeta(slug, { schema_jsonld: schemaData })
        success = dbResult.success
      }

      markOptimized(page, 'geoOptimizer')
      logAction('geo_publish', { url: page, query, score, success })
      results.optimized++
      console.log(`    -> GEO aplicado (score: ${score})`)
    } else {
      // Draft
      addDraft({
        tipo: 'geo_optimization',
        url: page,
        query,
        modulo: 'geoOptimizer',
        score,
        data: geoResult,
      })
      logAction('geo_draft', { url: page, query, score })
      results.drafted++
      console.log(`    -> Draft (score: ${score})`)
    }

    results.details.push({
      query,
      url: page,
      confidence: score,
      has_faq: !!(geoResult.faqs_adicionales?.length),
      has_speakable: !!geoResult.schema_speakable,
      has_quick_answer: !!geoResult.respuesta_rapida,
      action: score >= AGENT.CONFIDENCE_THRESHOLD ? 'published' : 'draft',
    })

    await new Promise(r => setTimeout(r, 1500))
  }

  // Log de optimizaciones GEO
  const geoLog = readJsonSafe(GEO_LOG_PATH)
  geoLog.push({ timestamp: new Date().toISOString(), ...results })
  writeJsonAtomic(GEO_LOG_PATH, geoLog)

  console.log(`\n  [M7] GEO: ${results.optimized} optimizados, ${results.drafted} drafts, ${results.failed} fallidos`)
  return results
}

module.exports = { runGeoOptimizer, detectGeoQueries, generateOrganizationSchema }
