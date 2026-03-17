/**
 * IMPERIAL-AGENT v2: Prompts para Modulo 6 — Generador de Paginas
 *
 * 3 tipos: lista, obra, resena
 * Cada tipo genera contenido optimizado para SEO + GEO
 */

const PROMPT_VERSION = '2.0.0'

function getSystemPrompt(tipoPagina) {
  return `Eres el editor jefe de Manhwa Imperial. Creas el mejor contenido de manhwa en espanol de internet. Tu contenido cumple simultaneamente tres objetivos:
1. SEO: rankear en Google y Bing con la query objetivo
2. GEO: ser citado por ChatGPT, Copilot y Gemini
3. UX: ser genuinamente util para lectores hispanos

Principios: La "Respuesta rapida" al inicio (50 palabras directas) es lo que las IAs generativas extraen como snippet. Las FAQs con respuestas directas alimentan a ChatGPT. Los datos concretos aumentan la probabilidad de ser citado por IAs.`
}

function getUserPromptLista(data) {
  return `Query objetivo: "${data.query}"
Impresiones Google: ${data.g_imp || data.impressions || 0} | Impresiones Bing: ${data.b_imp || data.impressionsBing || 0}
Tipo de pagina: lista

Devuelve SOLO este JSON:
{
  "slug": "/listas/${data.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}",
  "meta_title": "string — max 60 chars",
  "meta_description": "string — max 155 chars",
  "h1": "string con keyword principal",
  "respuesta_rapida": "string — 50 palabras directas que respondan la query",
  "introduccion": "string — 100 palabras",
  "obras": [{ "nombre":"","genero":[],"descripcion":"","puntuacion":0.0,"donde_leer":"" }],
  "faqs": [{ "pregunta":"","respuesta":"" }],
  "schema_itemlist": {},
  "schema_faqpage": {},
  "schema_speakable": { "@type": "SpeakableSpecification", "cssSelector": [] },
  "confidence_score": 0.0,
  "razon": "string"
}`
}

function getUserPromptObra(data) {
  return `Query objetivo: "${data.query}"
Impresiones Google: ${data.g_imp || data.impressions || 0} | Impresiones Bing: ${data.b_imp || data.impressionsBing || 0}
Tipo de pagina: obra

Devuelve SOLO este JSON:
{
  "slug": "/manhwa/${data.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}",
  "meta_title": "string — max 60 chars",
  "meta_description": "string — max 155 chars",
  "h1": "string con nombre de la obra",
  "respuesta_rapida": "string — 50 palabras directas",
  "sinopsis": "string — 150-200 palabras sin spoilers",
  "generos": ["array de generos"],
  "donde_leer_legal": "string con recomendacion de lectura legal",
  "manhwas_similares": [{ "nombre":"","razon":"" }],
  "faqs": [{ "pregunta":"","respuesta":"" }],
  "schema_book": {},
  "schema_faqpage": {},
  "schema_speakable": { "@type": "SpeakableSpecification", "cssSelector": [] },
  "confidence_score": 0.0,
  "razon": "string"
}`
}

function getUserPromptResena(data) {
  return `Query objetivo: "${data.query}"
Impresiones Google: ${data.g_imp || data.impressions || 0} | Impresiones Bing: ${data.b_imp || data.impressionsBing || 0}
Tipo de pagina: resena

Devuelve SOLO este JSON:
{
  "slug": "/blog/resena-${data.query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}",
  "meta_title": "string — max 60 chars",
  "meta_description": "string — max 155 chars",
  "h1": "string con Resena de [Obra]",
  "respuesta_rapida": "string — 50 palabras directas con veredicto",
  "puntuaciones": {
    "global": 0.0,
    "historia": 0.0,
    "arte": 0.0,
    "personajes": 0.0,
    "ritmo": 0.0
  },
  "veredicto": "string — 80 palabras",
  "para_quien_es": "string — descripcion del lector ideal",
  "faqs": [{ "pregunta":"","respuesta":"" }],
  "schema_review": {},
  "schema_faqpage": {},
  "confidence_score": 0.0,
  "razon": "string"
}`
}

function getUserPrompt(tipoPagina, data) {
  switch (tipoPagina) {
    case 'lista': return getUserPromptLista(data)
    case 'resena': return getUserPromptResena(data)
    default: return getUserPromptObra(data)
  }
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
