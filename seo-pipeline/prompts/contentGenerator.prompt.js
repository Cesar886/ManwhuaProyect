/**
 * IA-AGENT: Prompt versionado para generación de contenido (Content Gaps)
 * Versión: 1.0.0
 *
 * Genera prompts distintos según tipo_pagina: lista | obra | reseña
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt(tipoPagina) {
  const base = `Eres un editor experto en manhwa y manga para audiencia hispanohablante. Creas contenido detallado, optimizado para SEO y útil para lectores reales. NUNCA hagas keyword stuffing. El contenido debe ser original, informativo y con valor real.`

  const extras = {
    lista: `\nEspecialidad: listas/rankings de manhwa. Cada recomendación debe tener criterio editorial genuino.`,
    obra: `\nEspecialidad: páginas de obra/serie. Sinopsis atractivas sin spoilers, con datos precisos.`,
    reseña: `\nEspecialidad: reseñas críticas. Opinión balanceada con puntuación justificada.`,
  }

  return base + (extras[tipoPagina] || extras.obra)
}

function getUserPromptLista({ query, impressions, impressionsBing }) {
  const totalImp = impressions + (impressionsBing || 0)
  return `Crea una página completa para la query "${query}" con ${totalImp} impresiones combinadas en Google y Bing.

Estructura requerida:
- H1 con keyword principal (máx. 60 chars)
- Introducción de 80-100 palabras con contexto del género/tema
- Lista de 8-12 manhwas con: nombre, género, descripción de 40 palabras, por qué recomendarlo
- Párrafo de cierre con CTA hacia lectura
- Meta title y meta description optimizados
- Slug sugerido en formato: /listas/[keyword-slug]
- Schema JSON-LD tipo ItemList

Responde SOLO en JSON válido:
{
  "slug": "/listas/...",
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "contenido_html": "...",
  "schema_jsonld": {},
  "confidence_score": 0.0,
  "razon": "..."
}`
}

function getUserPromptObra({ query, impressions, impressionsBing }) {
  const totalImp = impressions + (impressionsBing || 0)
  return `Crea una página completa para la obra/serie "${query}" con ${totalImp} impresiones combinadas.

Estructura requerida:
- H1 con el nombre de la obra
- Sinopsis atractiva (150-200 palabras) sin spoilers mayores
- Ficha técnica: género, estado, autor (si se conoce), capítulos
- Sección "Dónde leer" con CTA
- Sección "Manhwas similares" (3-5 recomendaciones breves)
- Meta title y meta description optimizados
- Slug sugerido en formato: /manhwa/[slug]
- Schema JSON-LD tipo CreativeWork/ComicSeries

Responde SOLO en JSON válido:
{
  "slug": "/manhwa/...",
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "contenido_html": "...",
  "schema_jsonld": {},
  "confidence_score": 0.0,
  "razon": "..."
}`
}

function getUserPromptResena({ query, impressions, impressionsBing }) {
  const totalImp = impressions + (impressionsBing || 0)
  return `Crea una reseña completa para "${query}" con ${totalImp} impresiones combinadas.

Estructura requerida:
- H1 con "Reseña de [Obra]" (máx. 60 chars)
- Puntuación general (X/10) y desglose: Historia, Personajes, Arte, Ritmo
- Sección de historia (100 palabras, sin spoilers)
- Sección de personajes (80 palabras)
- Sección de arte/dibujo (60 palabras)
- Veredicto final (80 palabras) con CTA
- Meta title y meta description optimizados
- Slug sugerido en formato: /blog/resena-[slug]
- Schema JSON-LD tipo Review

Responde SOLO en JSON válido:
{
  "slug": "/blog/resena-...",
  "meta_title": "...",
  "meta_description": "...",
  "h1": "...",
  "contenido_html": "...",
  "schema_jsonld": {},
  "confidence_score": 0.0,
  "razon": "..."
}`
}

function getUserPrompt(tipoPagina, data) {
  switch (tipoPagina) {
    case 'lista': return getUserPromptLista(data)
    case 'reseña': return getUserPromptResena(data)
    default: return getUserPromptObra(data)
  }
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
