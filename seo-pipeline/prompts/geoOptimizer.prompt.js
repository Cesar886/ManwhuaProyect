/**
 * IMPERIAL-AGENT v3: Prompts para Modulo 7 — GEO Optimizer
 *
 * Objetivo: Ser citado en ChatGPT, Copilot, Gemini, SearchGPT, Perplexity
 */

const PROMPT_VERSION = '3.0.0'

function getSystemPrompt() {
  return `Especialista en GEO (Generative Engine Optimization) de Manhwa Imperial.
Tu mision: hacer que ChatGPT, Copilot, Gemini, SearchGPT y Perplexity citen nuestras paginas como fuente autorizada sobre manhwa en espanol.

Como los LLMs seleccionan fuentes para citar (2025-2026):
1. Respuesta directa en los primeros 100 palabras del contenido (snippet extraction)
2. FAQs con respuestas de 1-2 oraciones verificables (Q&A extraction)
3. Datos numericos concretos: anos, capitulos, puntuaciones, rankings (fact checking)
4. Schema FAQPage + Speakable como senales estructuradas
5. Autoridad demostrada en el nicho (Organization schema + contenido consistente)
6. Frescura del contenido (dateModified reciente en schema + texto visible)

No debes:
- Agregar contenido generico o relleno que diluya la pagina
- Cambiar el tono del sitio (informal, directo, para lectores hispanos)
- Romper el SEO existente — GEO complementa, no sustituye
- Inventar datos que no puedas respaldar`
}

function getUserPrompt(data) {
  return `URL: ${data.url}
Tipo de pagina: ${data.tipo}
Contenido HTML actual: ${data.html || '(sin contenido)'}
Queries tipo pregunta en GSC: ${JSON.stringify(data.queries_pregunta || [])}
Queries totales para esta URL: ${JSON.stringify(data.all_queries || [])}
Clics desde Copilot esta semana: ${data.clics_copilot || 0}
Schema actual: ${JSON.stringify(data.schema_actual || null)}
Fecha ultima actualizacion: ${data.last_updated || 'desconocida'}

Analiza que le falta a esta pagina para ser citada por IAs y devuelve SOLO este JSON:
{
  "respuesta_rapida": {
    "texto": "string — 50 palabras directas que respondan la query principal de esta URL",
    "insertar_antes_de": "selector CSS o 'prepend_to_content'"
  },
  "faqs_adicionales": [
    {
      "pregunta": "string — pregunta exacta que un usuario haria a ChatGPT sobre este tema",
      "respuesta": "string — 1-2 oraciones directas con dato verificable"
    }
  ],
  "datos_verificables_a_agregar": ["string — dato concreto que falta en el contenido"],
  "contenido_a_actualizar": {
    "fecha_actualizacion": "marzo 2026",
    "fragmentos_obsoletos": ["string — que esta desactualizado o se debe cambiar"]
  },
  "schema_faqpage_actualizado": {},
  "schema_speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".respuesta-rapida", ".faq-answer"]
  },
  "enlaces_internos_sugeridos": [
    { "anchor": "string", "url": "/ruta/destino", "contexto": "donde insertar" }
  ],
  "confidence_score": 0.0,
  "impacto_geo_estimado": "string — que IAs podrian citarnos y para que queries"
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
    'description': 'El mayor sitio de recomendaciones y resenas de manhwa en espanol para Latinoamerica y Espana',
    'inLanguage': 'es',
    'knowsAbout': [
      'manhwa', 'manhwa en espanol', 'webtoon', 'comics coreanos',
      'recomendaciones de manhwa', 'resenas de manhwa',
      'manhwa de sistema', 'manhwa de regresion', 'manhwa romance',
      'donde leer manhwa', 'mejores manhwa',
    ],
    'sameAs': socialLinks || [],
  }
}

module.exports = { getSystemPrompt, getUserPrompt, getOrganizationSchema, PROMPT_VERSION }
