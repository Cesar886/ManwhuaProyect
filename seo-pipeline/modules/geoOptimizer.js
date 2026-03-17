/**
 * IMPERIAL-AGENT: Módulo 7 — GEO Optimizer
 *
 * OBJETIVO: Aparecer citado en ChatGPT, Copilot y Gemini.
 *
 * Las IAs generativas priorizan:
 *   - Respuestas directas al inicio del texto
 *   - Schema FAQPage + Speakable bien formados
 *   - Datos concretos y verificables (rankings, puntuaciones)
 *   - Schema Organization con sameAs a redes sociales
 *
 * Flujo:
 *   1. Identificar páginas con potencial GEO (queries informativas)
 *   2. IA genera: respuesta rápida, FAQs, Schema FAQPage + Speakable
 *   3. Publicar si confidence ≥ 0.75
 *
 * Señales monitoreadas:
 *   - BWT: clics desde Copilot
 *   - GSC: queries tipo "cómo", "cuál", "dónde", "qué manhwa"
 *   - Referrers de chatgpt.com, copilot.microsoft.com
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')
const { callAI } = require('./aiReasoner')
const { logAction, readJsonSafe, writeJsonAtomic } = require('./autonomousExecutor')
const geoPrompt = require('../prompts/geoOptimizer.prompt')
const {
  wasRecentlyOptimized,
  markOptimized,
  getCostPercentage,
} = require('../core/agentMemory')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const GEO_LOG_PATH = path.resolve(__dirname, '..', 'logs', 'geo_optimizations.json')

/**
 * GEO: Detectar queries con intención informativa (las que citan IAs)
 */
function detectGeoQueries(quickWins, contentGaps) {
  const geoPatterns = [
    /^(cu[áa]l|qu[ée]|c[óo]mo|d[óo]nde|por qu[ée]|mejor|mejores|top|ranking)/i,
    /manhwa.*(recomendar|recomendaci|similar|parecido|como)/i,
    /(recomienda|recomendacion|sugerencia|lista)/i,
    /\?.*/,
  ]

  const candidates = []

  // Filtrar queries informativas de quick wins
  for (const qw of (quickWins || [])) {
    const query = qw.query || ''
    if (geoPatterns.some(p => p.test(query))) {
      candidates.push({
        query,
        page: qw.page,
        source: 'quick_wins',
        impressions: (qw.impresiones_google || 0) + (qw.impresiones_bing || 0),
        copilot_impressions: qw.copilot_impressions || 0,
        copilot_clicks: qw.copilot_clicks || 0,
        position: Math.min(qw.posicion_google || 100, qw.posicion_bing || 100),
      })
    }
  }

  // Filtrar content gaps informativos
  for (const gap of (contentGaps || [])) {
    const query = gap.query || ''
    if (geoPatterns.some(p => p.test(query))) {
      candidates.push({
        query,
        page: null,
        source: 'content_gap',
        impressions: (gap.impresiones_google || 0) + (gap.impresiones_bing || 0),
        copilot_impressions: 0,
        copilot_clicks: 0,
        position: null,
      })
    }
  }

  // Ordenar por impresiones (mayor potencial GEO primero)
  return candidates.sort((a, b) => b.impressions - a.impressions)
}

/**
 * GEO: Obtener contenido actual de una página para mejorar
 */
async function getCurrentContent(url) {
  if (!url) return null
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Imperial-SEO-Agent/1.0' },
    })
    const html = response.data

    // Extraer title, h1, primeros párrafos, schema existente
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

    // Extraer texto plano de los primeros 500 chars del body
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

    return {
      title: titleMatch?.[1] || '',
      h1: h1Match?.[1] || '',
      existingSchemas,
      plainText,
    }
  } catch {
    return null
  }
}

/**
 * GEO: Generar Schema Organization para la home
 */
function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Manhwa Imperial',
    url: AGENT.SITE_URL || 'https://manhwaimperial.site',
    inLanguage: 'es',
    description: 'Tu portal de manhwa, manga y webtoons en español. Recomendaciones, reseñas y las mejores series.',
    sameAs: [
      // Agregar redes sociales del sitio
    ].filter(Boolean),
  }
}

/**
 * IMPERIAL-AGENT: Ejecutar optimización GEO
 *
 * @param {Object} [options] - Datos de módulos previos
 * @returns {Promise<Object>} Resumen de optimizaciones GEO
 */
async function runGeoOptimizer(options = {}) {
  console.log('🌐 GEO Optimizer — Optimización para IAs Generativas...\n')

  if (!AGENT.AI_API_KEY) {
    console.warn('  ⚠ AI_API_KEY no configurada. Módulo desactivado.')
    return { status: 'disabled', reason: 'AI_API_KEY not set' }
  }

  // Verificar presupuesto
  const budget = getCostPercentage()
  if (budget.pct >= 95) {
    console.warn(`  ⚠ Presupuesto al ${budget.pct.toFixed(1)}%. GEO Optimizer pausado.`)
    return { status: 'budget_limit', pct: budget.pct }
  }

  // Cargar datos de módulos previos
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

  // Detectar queries con potencial GEO
  const geoCandidates = detectGeoQueries(quickWins || [], contentGaps || [])

  if (geoCandidates.length === 0) {
    console.log('  → No se detectaron queries con potencial GEO.')
    return { status: 'no_candidates', optimized: 0 }
  }

  // Limitar a 10 por ejecución
  const maxPerRun = parseInt(process.env.MAX_GEO_PER_RUN) || 10
  const candidates = geoCandidates
    .filter(c => c.page && !wasRecentlyOptimized(c.page, 7))
    .slice(0, maxPerRun)

  console.log(`  → ${geoCandidates.length} queries GEO detectadas, ${candidates.length} elegibles\n`)

  const results = {
    status: 'completed',
    optimized: 0,
    drafted: 0,
    failed: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    geo_signals: {
      total_copilot_impressions: geoCandidates.reduce((s, c) => s + c.copilot_impressions, 0),
      total_copilot_clicks: geoCandidates.reduce((s, c) => s + c.copilot_clicks, 0),
      informational_queries: geoCandidates.length,
    },
    details: [],
  }

  for (const candidate of candidates) {
    const { query, page } = candidate

    console.log(`  🌐 GEO: "${query}" → ${page}`)

    // Obtener contenido actual
    const currentContent = await getCurrentContent(page)

    // Llamar a la IA con prompt GEO
    const systemPrompt = geoPrompt.getSystemPrompt()
    const userPrompt = geoPrompt.getUserPrompt({
      url: page,
      query,
      currentTitle: currentContent?.title || '',
      currentH1: currentContent?.h1 || '',
      existingSchemas: currentContent?.existingSchemas || [],
      currentText: currentContent?.plainText || '',
      copilotImpressions: candidate.copilot_impressions,
      copilotClicks: candidate.copilot_clicks,
      position: candidate.position,
      impressions: candidate.impressions,
    })

    const aiResponse = await callAI(systemPrompt, userPrompt, { maxTokens: 4096 })

    if (aiResponse.budget_exceeded) {
      console.warn('  ⚠ Presupuesto semanal agotado.')
      break
    }

    if (!aiResponse.parsed) {
      console.error(`    ❌ IA no devolvió respuesta válida para "${query}"`)
      results.failed++
      continue
    }

    results.total_tokens += aiResponse.tokens_used
    results.total_cost_usd += aiResponse.cost_usd

    const geoResult = aiResponse.parsed
    const confidence = geoResult.confidence_score || 0

    if (confidence >= AGENT.CONFIDENCE_THRESHOLD) {
      console.log(`    ✅ Score ${confidence} ≥ ${AGENT.CONFIDENCE_THRESHOLD} → Aplicando optimización GEO`)

      // Intentar actualizar vía CMS API
      let success = false
      if (AGENT.CMS_API_KEY) {
        try {
          const slug = extractSlug(page)
          if (slug) {
            const updateData = {}
            if (geoResult.respuesta_rapida) {
              updateData.geo_quick_answer = geoResult.respuesta_rapida
            }
            if (geoResult.faqs) {
              updateData.geo_faqs = geoResult.faqs
            }
            if (geoResult.schema_faqpage) {
              updateData.schema_faqpage = geoResult.schema_faqpage
            }
            if (geoResult.schema_speakable) {
              updateData.schema_speakable = geoResult.schema_speakable
            }

            const response = await axios.patch(
              `${AGENT.CMS_API_BASE}/series/${slug}`,
              updateData,
              {
                headers: {
                  'x-api-key': AGENT.CMS_API_KEY,
                  'Content-Type': 'application/json',
                },
                timeout: 15000,
              }
            )
            success = response.status >= 200 && response.status < 300
          }
        } catch (err) {
          console.warn(`    ⚠ Error CMS: ${err.message}`)
        }
      }

      // También intentar vía DB directa
      try {
        const dbClient = require('../core/dbClient')
        const slug = extractSlug(page)
        if (slug) {
          const schemaData = buildCombinedSchema(geoResult)
          const dbResult = await dbClient.updateMeta(slug, {
            schema_jsonld: schemaData,
          })
          if (dbResult.success) success = true
        }
      } catch { /* DB no disponible */ }

      markOptimized(page, 'geoOptimizer')

      logAction({
        modulo: 'geoOptimizer',
        accion: success ? 'geo_optimizado' : 'geo_fallo',
        url_afectada: page,
        query,
        confidence_score: confidence,
        tokens_ia_usados: aiResponse.tokens_used,
        costo_estimado_usd: aiResponse.cost_usd,
        resultado: success ? 'exitoso' : 'fallido',
        razon_ia: geoResult.razon,
        tiene_faq: !!(geoResult.faqs?.length),
        tiene_speakable: !!geoResult.schema_speakable,
        tiene_respuesta_rapida: !!geoResult.respuesta_rapida,
      })

      results.optimized++
    } else {
      console.log(`    📝 Score ${confidence} < ${AGENT.CONFIDENCE_THRESHOLD} → Draft`)

      // Guardar como draft
      const draftsPath = path.resolve(__dirname, '..', 'drafts', 'drafts_geo.json')
      const drafts = readJsonSafe(draftsPath)
      drafts.push({
        timestamp: new Date().toISOString(),
        url: page,
        query,
        ...geoResult,
        tokens_used: aiResponse.tokens_used,
        cost_usd: aiResponse.cost_usd,
      })
      writeJsonAtomic(draftsPath, drafts)

      results.drafted++
    }

    results.details.push({
      query,
      url: page,
      confidence,
      has_faq: !!(geoResult.faqs?.length),
      has_speakable: !!geoResult.schema_speakable,
      has_quick_answer: !!geoResult.respuesta_rapida,
      action: confidence >= AGENT.CONFIDENCE_THRESHOLD ? 'published' : 'draft',
    })

    await new Promise(r => setTimeout(r, 1500))
  }

  // Guardar log de optimizaciones GEO
  const geoLog = readJsonSafe(GEO_LOG_PATH)
  geoLog.push({
    timestamp: new Date().toISOString(),
    ...results,
  })
  writeJsonAtomic(GEO_LOG_PATH, geoLog)

  console.log(`\n  📊 GEO: ${results.optimized} optimizados, ${results.drafted} drafts, ${results.failed} fallidos`)
  console.log(`  🌐 Señales GEO: ${results.geo_signals.informational_queries} queries informativas, ${results.geo_signals.total_copilot_clicks} clics Copilot`)
  console.log(`  💰 Tokens: ${results.total_tokens} | Costo: $${results.total_cost_usd.toFixed(4)}\n`)

  return results
}

/**
 * GEO: Combinar schemas generados en un array JSON-LD
 */
function buildCombinedSchema(geoResult) {
  const schemas = []

  if (geoResult.schema_faqpage) {
    schemas.push({
      '@context': 'https://schema.org',
      ...geoResult.schema_faqpage,
    })
  }

  if (geoResult.schema_speakable) {
    schemas.push({
      '@context': 'https://schema.org',
      ...geoResult.schema_speakable,
    })
  }

  if (geoResult.datos_estadisticos) {
    // Datos verificables mejoran citabilidad en IAs
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `Estadísticas: ${geoResult.query || ''}`,
      description: geoResult.datos_estadisticos.join('. '),
    })
  }

  return schemas.length === 1 ? schemas[0] : schemas
}

/**
 * GEO: Extraer slug de URL
 */
function extractSlug(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\/manhwa\/([^/]+)/)
    return match ? match[1] : pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

module.exports = { runGeoOptimizer, detectGeoQueries, generateOrganizationSchema }
