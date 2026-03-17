/**
 * IMPERIAL-AGENT v2: Modulo 4 — Quick Wins Optimizer
 *
 * Fuente: Rango C — queries posicion 4-15, impresiones > 100
 * Cruzar GSC + BWT. Maximo 20 URLs por ejecucion semanal.
 *
 * Prioridad:
 *   ALTA  posicion 4-8  + impresiones > 300
 *   MEDIA posicion 8-12 + impresiones > 150
 *   BAJA  posicion 12-15 + impresiones > 100
 *
 * Flujo: datos -> GPT-4o optimiza -> publicar si >= 0.75 o draft
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { AGENT } = require('../config/agentConfig')
const { gptCall } = require('../core/gptClient')
const { wasRecentlyOptimized, markOptimized, addDraft } = require('../core/agentMemory')
const { updateMeta } = require('../core/dbClient')
const titlePrompt = require('../prompts/titleOptimizer.prompt')
const { logAction } = require('./autonomousExecutor')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')

// Extraer slug de URL
function extractSlug(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\/manhwa\/([^/]+)/)
    if (match) return match[1]
    const parts = pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch { return null }
}

// Detectar tipo de pagina por URL
function detectPageType(url) {
  if (/\/listas?\//i.test(url)) return 'lista'
  if (/\/blog\/resena/i.test(url)) return 'resena'
  if (/\/genero\//i.test(url)) return 'taxonomia'
  if (/\/manhwa\//i.test(url)) return 'obra'
  if (/\/capitulo\//i.test(url)) return 'capitulo'
  return 'general'
}

// Obtener meta actual via CMS o fetch
async function getCurrentMeta(url) {
  try {
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
            schema: response.data.schema_jsonld || null,
            slug,
          }
        }
      }
    }
  } catch { /* fallback */ }

  try {
    const response = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'IMPERIAL-AGENT/2.0' } })
    const html = response.data
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
    const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)">/i)
    const schemaMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)
    return {
      title: titleMatch?.[1] || '',
      meta_description: metaMatch?.[1] || '',
      schema: schemaMatch?.[1] ? JSON.parse(schemaMatch[1]) : null,
      slug: extractSlug(url),
    }
  } catch {
    return { title: '', meta_description: '', schema: null, slug: extractSlug(url) }
  }
}

// Clasificar prioridad segun v2
function classifyPriority(pos, imp) {
  if (pos <= 8 && imp >= 300) return 'ALTA'
  if (pos <= 12 && imp >= 150) return 'MEDIA'
  if (pos <= 15 && imp >= 100) return 'BAJA'
  return null
}

async function runQuickWinsOptimizer(quickWinsData) {
  console.log('  [M4] Quick Wins Optimizer (IA)...\n')

  if (!AGENT.OPENAI_API_KEY) {
    console.warn('  [M4] OPENAI_API_KEY no configurada. Modulo desactivado.')
    return { status: 'disabled' }
  }

  // Obtener datos de quick wins
  let quickWins = quickWinsData
  if (!quickWins) {
    const filePath = path.join(REPORTS_DIR, 'quick_wins_unificado.json')
    if (!fs.existsSync(filePath)) {
      console.warn('  [M4] No se encontro quick_wins_unificado.json')
      return { status: 'no_data' }
    }
    quickWins = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  // Filtrar y priorizar candidatos v2
  const candidates = quickWins
    .map(qw => {
      const bestPos = Math.min(qw.posicion_google || 100, qw.posicion_bing || 100)
      const totalImp = (qw.impresiones_google || 0) + (qw.impresiones_bing || 0)
      const priority = classifyPriority(bestPos, totalImp)
      return { ...qw, bestPos, totalImp, priority }
    })
    .filter(qw => qw.priority !== null)
    .filter(qw => !wasRecentlyOptimized(qw.page, 7)) // No repetir <1 semana
    .sort((a, b) => {
      const order = { ALTA: 0, MEDIA: 1, BAJA: 2 }
      if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority]
      return b.totalImp - a.totalImp
    })
    .slice(0, AGENT.LIMITS.MAX_TITLES_PER_RUN)

  if (candidates.length === 0) {
    console.log('  [M4] No hay candidatos para optimizacion.')
    return { status: 'no_candidates', optimized: 0, drafted: 0 }
  }

  console.log(`  [M4] ${candidates.length} candidatos seleccionados\n`)

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

  for (const candidate of candidates) {
    const url = candidate.page
    const query = candidate.query

    console.log(`  [M4] "${query}" [${candidate.priority}] -> ${url}`)

    // Obtener meta actual
    const currentMeta = await getCurrentMeta(url)

    // GPT-4o genera optimizacion
    const aiResponse = await gptCall(
      titlePrompt.getSystemPrompt(),
      titlePrompt.getUserPrompt({
        url,
        keyword: query,
        gpos: candidate.posicion_google,
        bpos: candidate.posicion_bing,
        imp: candidate.totalImp,
        ctr: candidate.ctr_google ? (candidate.ctr_google * 100).toFixed(2) : '0',
        title_actual: currentMeta.title,
        meta_actual: currentMeta.meta_description,
        schema_actual: currentMeta.schema,
        tipo: detectPageType(url),
      }),
      { moduleNumber: 4 }
    )

    if (aiResponse.budget_blocked) {
      console.warn('  [M4] Presupuesto bloqueado. Deteniendo.')
      results.skipped += candidates.length - results.optimized - results.drafted - results.failed
      break
    }

    if (!aiResponse.parsed || !aiResponse.parsed.title) {
      console.error(`  [M4] IA no devolvio respuesta valida para "${query}"`)
      results.failed++
      continue
    }

    results.total_tokens += aiResponse.tokens_used || 0
    results.total_cost_usd += aiResponse.cost_usd || 0

    const parsed = aiResponse.parsed
    const score = parsed.confidence_score || 0

    if (score >= AGENT.CONFIDENCE_THRESHOLD) {
      // Publicar directamente en DB
      const slug = currentMeta.slug || extractSlug(url)
      const dbResult = await updateMeta(slug, {
        title: parsed.title,
        meta_description: parsed.meta_description,
        schema_jsonld: parsed.schema_jsonld,
      })

      if (dbResult.success) {
        markOptimized(url, 'quickWins')
        logAction('quickWins_publish', { url, query, title: parsed.title, score })
        results.optimized++
        console.log(`    -> Publicado (score: ${score})`)
      } else {
        results.failed++
        console.error(`    -> Error DB: ${dbResult.error}`)
      }
    } else {
      // Guardar como draft
      addDraft({
        tipo: 'title_optimization',
        url,
        query,
        modulo: 'quickWins',
        score,
        data: parsed,
      })
      logAction('quickWins_draft', { url, query, score })
      results.drafted++
      console.log(`    -> Draft (score: ${score})`)
    }

    results.details.push({
      query, url,
      action: score >= AGENT.CONFIDENCE_THRESHOLD ? 'published' : 'draft',
      confidence: score,
      new_title: parsed.title,
      priority: candidate.priority,
    })

    // Rate limiting
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`\n  [M4] Resumen: ${results.optimized} publicados, ${results.drafted} drafts, ${results.failed} fallidos`)
  return results
}

module.exports = { runQuickWinsOptimizer }
