/**
 * IMPERIAL-AGENT v3: Modulo 6 — Generador de Paginas Nuevas
 *
 * Top 5 gaps ALTA (o MEDIA si no hay ALTA).
 * GPT-4o genera pagina segun tipo: lista | obra | resena
 *
 * >= 0.75 -> insertar en DB + enviar a IndexNow
 * < 0.75  -> guardar en /drafts/ + notificar
 *
 * Este modulo es el mas costoso en tokens.
 * Se pausa automaticamente al 80% del limite mensual.
 */

const fs = require('fs')
const path = require('path')
const { AGENT } = require('../config/agentConfig')
const { gptCall } = require('../core/gptClient')
const { insertPage, slugExists } = require('../core/dbClient')
const { markPageCreated, markGapProcessed, addDraft, getCostPercentage } = require('../core/agentMemory')
const { smartIndex } = require('./smartIndexer')
const { logAction } = require('./autonomousExecutor')
const contentPrompt = require('../prompts/contentGenerator.prompt')

const REPORTS_DIR = path.resolve(process.env.REPORTS_DIR || './reports')
const DRAFTS_DIR = path.resolve('./drafts')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function runContentGapsGenerator(contentGapsData) {
  console.log('  [M6] Generador de Paginas (IA)...\n')

  if (!AGENT.OPENAI_API_KEY) {
    console.warn('  [M6] OPENAI_API_KEY no configurada.')
    return { status: 'disabled' }
  }

  // Verificar control de costos (este modulo se pausa al 80%)
  const budget = getCostPercentage()
  if (budget.pct >= AGENT.PAUSE_AT_PCT) {
    console.warn(`  [M6] Presupuesto al ${budget.pct.toFixed(1)}%. Modulo 6 pausado.`)
    return { status: 'paused', reason: `Budget at ${budget.pct.toFixed(1)}%` }
  }

  // Obtener datos de content gaps
  let contentGaps = contentGapsData
  if (!contentGaps) {
    const filePath = path.join(REPORTS_DIR, 'content_gaps_cross.json')
    if (!fs.existsSync(filePath)) {
      console.warn('  [M6] No se encontro content_gaps_cross.json')
      return { status: 'no_data' }
    }
    contentGaps = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  // v2: Top 5 ALTA, o MEDIA si no hay suficientes ALTA
  const alta = contentGaps.filter(g => g.prioridad_contenido === 'ALTA')
  const media = contentGaps.filter(g => g.prioridad_contenido === 'MEDIA')
  let candidates = alta.slice(0, AGENT.LIMITS.MAX_PAGES_PER_RUN)
  if (candidates.length < AGENT.LIMITS.MAX_PAGES_PER_RUN) {
    candidates = [...candidates, ...media.slice(0, AGENT.LIMITS.MAX_PAGES_PER_RUN - candidates.length)]
  }

  if (candidates.length === 0) {
    console.log('  [M6] No hay content gaps prioritarios.')
    return { status: 'no_candidates', generated: 0, drafted: 0 }
  }

  console.log(`  [M6] ${candidates.length} gaps seleccionados\n`)

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

    // Re-verificar presupuesto antes de cada generacion
    const currentBudget = getCostPercentage()
    if (currentBudget.pct >= AGENT.PAUSE_AT_PCT) {
      console.warn('  [M6] Presupuesto al limite. Pausando.')
      results.skipped += candidates.length - results.generated - results.drafted - results.failed
      break
    }

    console.log(`  [M6] Generando [${tipo_pagina}]: "${query}"`)

    // GPT-4o genera pagina
    const aiResponse = await gptCall(
      contentPrompt.getSystemPrompt(tipo_pagina),
      contentPrompt.getUserPrompt(tipo_pagina, {
        query,
        g_imp: impresiones_google || 0,
        b_imp: impresiones_bing || 0,
        impressions: impresiones_google || 0,
        impressionsBing: impresiones_bing || 0,
      }),
      { moduleNumber: 6, maxTokens: 6000 }
    )

    if (aiResponse.budget_blocked) {
      console.warn('  [M6] Presupuesto bloqueado.')
      results.skipped++
      break
    }

    const parsed = aiResponse.parsed
    if (!parsed || !parsed.slug) {
      console.error(`  [M6] IA no devolvio contenido valido para "${query}"`)
      results.failed++
      markGapProcessed(query, 'failed')
      continue
    }

    results.total_tokens += aiResponse.tokens_used || 0
    results.total_cost_usd += aiResponse.cost_usd || 0

    const score = parsed.confidence_score || 0

    if (score >= AGENT.CONFIDENCE_THRESHOLD) {
      // Verificar slug no duplicado
      const exists = await slugExists(parsed.slug)
      if (exists) {
        console.warn(`  [M6] Slug "${parsed.slug}" ya existe en DB. Omitiendo.`)
        results.failed++
        markGapProcessed(query, 'slug_exists')
        continue
      }

      // Construir contenido HTML
      const contenidoHtml = buildHtml(parsed, tipo_pagina)

      // Insertar en DB
      const dbResult = await insertPage({
        slug: parsed.slug,
        meta_title: parsed.meta_title,
        meta_description: parsed.meta_description,
        contenido_html: contenidoHtml,
        schema_jsonld: parsed.schema_itemlist || parsed.schema_book || parsed.schema_review || parsed.schema_faqpage,
      })

      if (dbResult.success) {
        const fullUrl = `${AGENT.SITE_URL}${parsed.slug}`
        markPageCreated(parsed.slug, query)
        markGapProcessed(query, 'published')
        logAction('contentGaps_publish', { url: fullUrl, query, slug: parsed.slug, score })
        results.generated++
        results.urls_publicadas.push(fullUrl)
        console.log(`    -> Publicado: ${fullUrl} (score: ${score})`)

        // Indexar inmediatamente
        try {
          await smartIndex(fullUrl, 'new_page')
          console.log(`    -> Enviado a IndexNow + Google`)
        } catch (err) {
          console.warn(`    -> Error indexando: ${err.message}`)
        }
      } else {
        console.error(`    -> Error DB: ${dbResult.error}`)
        results.failed++
        markGapProcessed(query, 'db_error')
      }
    } else {
      // Guardar como draft
      ensureDir(DRAFTS_DIR)
      const draftPath = path.join(DRAFTS_DIR, `${tipo_pagina}_${Date.now()}.json`)
      fs.writeFileSync(draftPath, JSON.stringify(parsed, null, 2), 'utf-8')

      addDraft({
        tipo: 'page_creation',
        slug: parsed.slug,
        query,
        modulo: 'contentGaps',
        score,
      })
      markGapProcessed(query, 'draft')
      logAction('contentGaps_draft', { query, slug: parsed.slug, score })
      results.drafted++
      console.log(`    -> Draft: ${draftPath} (score: ${score})`)
    }

    results.details.push({
      query,
      tipo_pagina,
      action: score >= AGENT.CONFIDENCE_THRESHOLD ? 'published' : 'draft',
      confidence: score,
      slug: parsed.slug,
    })

    // Pausa entre generaciones (costosas)
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n  [M6] Resumen: ${results.generated} publicadas, ${results.drafted} drafts, ${results.failed} fallidas`)
  return results
}

// Construir HTML a partir del resultado de GPT
function buildHtml(parsed, tipo) {
  let html = `<h1>${parsed.h1 || ''}</h1>\n`

  if (parsed.respuesta_rapida) {
    html += `<div class="respuesta-rapida"><p>${parsed.respuesta_rapida}</p></div>\n`
  }

  if (tipo === 'lista' && parsed.introduccion) {
    html += `<p>${parsed.introduccion}</p>\n`
    if (parsed.obras && Array.isArray(parsed.obras)) {
      html += '<div class="obras-lista">\n'
      parsed.obras.forEach((obra, i) => {
        html += `<div class="obra-item">\n`
        html += `  <h2>${i + 1}. ${obra.nombre}</h2>\n`
        if (obra.genero) html += `  <p class="genero">${Array.isArray(obra.genero) ? obra.genero.join(', ') : obra.genero}</p>\n`
        html += `  <p>${obra.descripcion || ''}</p>\n`
        if (obra.puntuacion) html += `  <p class="puntuacion">${obra.puntuacion}/10</p>\n`
        html += `</div>\n`
      })
      html += '</div>\n'
    }
  } else if (tipo === 'obra') {
    if (parsed.sinopsis) html += `<div class="sinopsis"><h2>Sinopsis</h2><p>${parsed.sinopsis}</p></div>\n`
    if (parsed.generos) html += `<p class="generos">Generos: ${Array.isArray(parsed.generos) ? parsed.generos.join(', ') : parsed.generos}</p>\n`
    if (parsed.donde_leer_legal) html += `<div class="donde-leer"><h2>Donde Leer</h2><p>${parsed.donde_leer_legal}</p></div>\n`
    if (parsed.manhwas_similares && Array.isArray(parsed.manhwas_similares)) {
      html += '<div class="similares"><h2>Manhwas Similares</h2>\n'
      parsed.manhwas_similares.forEach(s => {
        html += `<p><strong>${s.nombre}</strong>: ${s.razon || ''}</p>\n`
      })
      html += '</div>\n'
    }
  } else if (tipo === 'resena') {
    if (parsed.puntuaciones) {
      html += '<div class="puntuaciones">\n'
      html += `  <p>Global: ${parsed.puntuaciones.global}/10</p>\n`
      html += `  <p>Historia: ${parsed.puntuaciones.historia}/10</p>\n`
      html += `  <p>Arte: ${parsed.puntuaciones.arte}/10</p>\n`
      html += `  <p>Personajes: ${parsed.puntuaciones.personajes}/10</p>\n`
      html += `  <p>Ritmo: ${parsed.puntuaciones.ritmo}/10</p>\n`
      html += '</div>\n'
    }
    if (parsed.veredicto) html += `<div class="veredicto"><h2>Veredicto</h2><p>${parsed.veredicto}</p></div>\n`
    if (parsed.para_quien_es) html += `<div class="para-quien"><h2>Para Quien Es</h2><p>${parsed.para_quien_es}</p></div>\n`
  }

  // FAQs (comun a todos los tipos)
  if (parsed.faqs && Array.isArray(parsed.faqs)) {
    html += '<section class="faqs"><h2>Preguntas Frecuentes</h2>\n'
    parsed.faqs.forEach(faq => {
      html += `<div class="faq-item">\n  <h3>${faq.pregunta}</h3>\n  <p>${faq.respuesta}</p>\n</div>\n`
    })
    html += '</section>\n'
  }

  return html
}

module.exports = { runContentGapsGenerator }
