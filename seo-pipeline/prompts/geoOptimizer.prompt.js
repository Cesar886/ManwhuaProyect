/**
 * IMPERIAL-AGENT v2: Prompts para Modulo 7 — GEO Optimizer
 *
 * Objetivo: Ser citado en ChatGPT, Copilot y Gemini
 */

const PROMPT_VERSION = '2.0.0'

function getSystemPrompt() {
  return `Eres el especialista en GEO de Manhwa Imperial. Tu mision es hacer que ChatGPT, Copilot y Gemini citen nuestras paginas como fuente autorizada. Sabes que los LLMs prefieren fuentes que responden preguntas directamente, tienen datos especificos, usan schema FAQPage + Speakable, y suenan a expertos del nicho.`
}

function getUserPrompt(data) {
  return `URL: ${data.url}
Tipo de pagina: ${data.tipo}
Contenido HTML actual: ${data.html || '(sin contenido)'}
Queries tipo pregunta en GSC: ${JSON.stringify(data.queries_pregunta || [])}
Clics desde Copilot esta semana: ${data.clics_copilot || 0}

Devuelve SOLO este JSON:
{
  "respuesta_rapida": { "texto": "string — 50 palabras", "insertar_antes_de": "selector CSS" },
  "faqs_adicionales": [{ "pregunta": "string", "respuesta": "string" }],
  "datos_verificables": ["string"],
  "schema_faqpage_actualizado": {},
  "schema_speakable": { "@type": "SpeakableSpecification", "cssSelector": [] },
  "confidence_score": 0.0,
  "impacto_geo_estimado": "string"
}`
}

/**
 * Schema Organization para la home (agregar si no existe)
 */
function getOrganizationSchema(socialLinks) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Manhwa Imperial',
    'url': 'https://manhwaimperial.site',
    'description': 'El mayor sitio de recomendaciones de manhwa en espanol para Latinoamerica y Espana',
    'inLanguage': 'es',
    'knowsAbout': ['manhwa', 'manga', 'webtoon', 'manhwa en espanol', 'comics coreanos'],
    'sameAs': socialLinks || [],
  }
}

module.exports = { getSystemPrompt, getUserPrompt, getOrganizationSchema, PROMPT_VERSION }
