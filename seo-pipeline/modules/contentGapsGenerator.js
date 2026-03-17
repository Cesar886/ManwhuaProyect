/**
 * IA-AGENT: Generador Autónomo de Páginas (Content Gaps)
 *
 * Flujo completo:
 *   CAPA 1 → Lee content_gaps_cross.json (datos de GSC + BWT)
 *   CAPA 2 → IA genera página completa según tipo (lista/obra/reseña)
 *   CAPA 3 → Publica si confidence ≥ 0.75, draft si < 0.75
 *
 * Control de costos: Este módulo es el más costoso en tokens.
 * Se pausa automáticamente al 80% del límite semanal.
 */

const fs = require('fs')
const path = require('path')
const { AGENT } = require('../config/agentConfig')
const { callAI, shouldPauseGeneration } = require('./aiReasoner')
const { executePageCreation, logAction } = require('./autonomousExecutor')
const { smartIndex } = require('./smartIndexer')
const contentPrompt = require('../prompts/contentGenerator.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')

/**
 * IA-AGENT: Ejecutar generación autónoma de páginas para content gaps
 *
 * @param {Array} [contentGapsData] - Datos de content gaps (si no se pasa, lee del archivo)
 * @returns {Promise<Object>} Resumen de generación
 */
async function runContentGapsGenerator(contentGapsData) {
  console.log('📄 Generador Autónomo de Páginas (IA)...\n')

  // IA-AGENT: Verificar API key
  if (!AGENT.AI_API_KEY) {
    console.warn('  ⚠ AI_API_KEY no configurada. Módulo desactivado.')
    return { status: 'disabled', reason: 'AI_API_KEY not set' }
  }

  // IA-AGENT: Verificar control de costos
  if (shouldPauseGeneration()) {
    console.warn('  ⚠ Generación de páginas pausada: uso de tokens al 80%+ del límite semanal.')
    console.warn('  → Solo quickWinsOptimizer (más barato) seguirá activo.')
    return { status: 'paused', reason: 'Weekly token budget at 80%+' }
  }

  // CAPA 1: Obtener datos de content gaps
  let contentGaps = contentGapsData
  if (!contentGaps) {
    const filePath = path.join(REPORTS_DIR, 'content_gaps_cross.json')
    if (!fs.existsSync(filePath)) {
      console.warn('  ⚠ No se encontró content_gaps_cross.json. Ejecutar pipeline primero.')
      return { status: 'no_data', reason: 'content_gaps_cross.json not found' }
    }
    contentGaps = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  // IA-AGENT: Filtrar y priorizar candidatos
  const candidates = contentGaps
    .filter(gap => {
      const totalImp = (gap.impresiones_google || 0) + (gap.impresiones_bing || 0)
      return totalImp >= AGENT.FILTERS.CONTENT_GAP_MIN_IMPRESSIONS &&
             (gap.prioridad_contenido === 'ALTA' || gap.prioridad_contenido === 'MEDIA')
    })
    .slice(0, AGENT.LIMITS.MAX_PAGES_PER_RUN)

  if (candidates.length === 0) {
    console.log('  → No hay content gaps prioritarios para generar páginas.')
    return { status: 'no_candidates', generated: 0, drafted: 0 }
  }

  console.log(`  → ${candidates.length} content gaps seleccionados para generación\n`)

  const results = {
    status: 'completed',
    generated: 0,
    drafted: 0,
    failed: 0,
    skipped: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    urls_publicadas: [],
    details: [],
  }

  for (const gap of candidates) {
    const { query, tipo_pagina, impresiones_google, impresiones_bing } = gap

    // IA-AGENT: Re-verificar presupuesto antes de cada generación (es costosa)
    if (shouldPauseGeneration()) {
      console.warn('  ⚠ Presupuesto al 80%+. Pausando generación de páginas restantes.')
      results.skipped += candidates.length - results.generated - results.drafted - results.failed
      break
    }

    console.log(`  📝 Generando página [${tipo_pagina}]: "${query}"`)

    // CAPA 2: Llamar a la IA con prompt según tipo
    const systemPrompt = contentPrompt.getSystemPrompt(tipo_pagina)
    const userPrompt = contentPrompt.getUserPrompt(tipo_pagina, {
      query,
      impressions: impresiones_google || 0,
      impressionsBing: impresiones_bing || 0,
    })

    const aiResponse = await callAI(systemPrompt, userPrompt, { maxTokens: 6000 })

    if (aiResponse.budget_exceeded) {
      console.warn('  ⚠ Presupuesto semanal agotado.')
      results.skipped++
      break
    }

    if (!aiResponse.parsed || !aiResponse.parsed.contenido_html) {
      console.error(`    ❌ IA no devolvió contenido válido para "${query}"`)
      results.failed++
      continue
    }

    results.total_tokens += aiResponse.tokens_used
    results.total_cost_usd += aiResponse.cost_usd

    // CAPA 3: Ejecutar (publicar o draft)
    const execResult = await executePageCreation({
      query,
      tipoPagina: tipo_pagina,
      aiResult: aiResponse.parsed,
      tokensUsed: aiResponse.tokens_used,
      costUsd: aiResponse.cost_usd,
    })

    if (execResult.action === 'published') {
      results.generated++
      if (execResult.url) {
        results.urls_publicadas.push(execResult.url)
        // AUTO-EXEC: Enviar URL nueva a IndexNow + Google para indexación rápida
        try {
          await smartIndex(execResult.url, 'new_page')
          console.log(`    🔗 URL enviada a IndexNow + Google Indexing`)
        } catch (err) {
          console.warn(`    ⚠ Error indexando: ${err.message}`)
        }
      }
    } else if (execResult.action === 'draft') {
      results.drafted++
    } else {
      results.failed++
    }

    results.details.push({
      query,
      tipo_pagina,
      action: execResult.action,
      confidence: aiResponse.parsed.confidence_score,
      slug: aiResponse.parsed.slug,
    })

    // Pausa mayor entre generaciones (más tokens = más pausa)
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n  📊 Resumen: ${results.generated} publicadas, ${results.drafted} drafts, ${results.failed} fallidas`)
  console.log(`  💰 Tokens: ${results.total_tokens} | Costo: $${results.total_cost_usd.toFixed(4)}\n`)

  return results
}

module.exports = { runContentGapsGenerator }
