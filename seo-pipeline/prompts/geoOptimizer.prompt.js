/**
 * IMPERIAL-AGENT: Prompt versionado para GEO Optimizer
 * Versión: 1.0.0
 *
 * Objetivo: Optimizar contenido para ser citado por IAs generativas
 * (ChatGPT, Copilot, Gemini)
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres un experto en GEO (Generative Engine Optimization) para sitios de manhwa en español. Tu objetivo es optimizar páginas para que las IAs generativas (ChatGPT, Copilot, Gemini) citen el contenido de Manhwa Imperial en sus respuestas.

Las IAs generativas priorizan:
1. Respuestas directas y concisas al inicio del texto (snippet de 50 palabras)
2. Schema FAQPage bien formado con preguntas y respuestas claras
3. Schema Speakable apuntando a secciones clave del contenido
4. Datos concretos y verificables: rankings, puntuaciones, cifras específicas
5. Contenido estructurado con H2/H3 que respondan preguntas específicas
6. Listas numeradas y comparativas que las IAs puedan extraer fácilmente

Reglas:
- La "respuesta rápida" debe ser autosuficiente (50 palabras exactas)
- Cada FAQ debe tener respuesta en 2-3 oraciones directas
- Los datos estadísticos deben ser verificables o basados en información pública
- Schema debe ser JSON-LD válido según schema.org
- Todo en español, tono informativo y experto
- NO inventar datos falsos (puntuaciones, fechas de publicación, etc.)`
}

function getUserPrompt({ url, query, currentTitle, currentH1, existingSchemas, currentText, copilotImpressions, copilotClicks, position, impressions }) {
  const copilotInfo = copilotImpressions > 0
    ? `\nSeñales Copilot: ${copilotImpressions} impresiones, ${copilotClicks} clics desde Copilot.`
    : ''

  return `Optimiza esta página de Manhwa Imperial para IAs generativas:

URL: ${url}
Query principal: "${query}"
Posición actual: ${position || 'desconocida'}
Impresiones totales (Google+Bing): ${impressions}${copilotInfo}

Contenido actual:
- Title: "${currentTitle || '(sin title)'}"
- H1: "${currentH1 || '(sin H1)'}"
- Texto actual (primeros 500 chars): "${currentText || '(sin contenido)'}"
- Schemas existentes: ${existingSchemas.length > 0 ? JSON.stringify(existingSchemas) : '(ninguno)'}

Genera las siguientes optimizaciones GEO:

1. respuesta_rapida: Texto de exactamente 50 palabras que responda directamente a la query. Debe ser autosuficiente para que una IA lo cite tal cual.

2. faqs: Array de 5 FAQs relacionadas con la query. Cada una con:
   - pregunta: pregunta natural que un usuario haría
   - respuesta: respuesta directa en 2-3 oraciones (40-60 palabras)

3. schema_faqpage: Schema JSON-LD tipo FAQPage completo con las 5 FAQs

4. schema_speakable: Schema JSON-LD tipo WebPage con propiedad speakable apuntando a los selectores CSS de las secciones clave

5. datos_estadisticos: Array de 3 datos estadísticos verificables sobre el tema (ej: "Según MAL, Solo Leveling tiene una puntuación de 8.67/10")

Responde SOLO en JSON válido:
{
  "respuesta_rapida": "...",
  "faqs": [
    { "pregunta": "...", "respuesta": "..." }
  ],
  "schema_faqpage": {
    "@type": "FAQPage",
    "mainEntity": [...]
  },
  "schema_speakable": {
    "@type": "WebPage",
    "speakable": { "@type": "SpeakableSpecification", "cssSelector": ["..."] }
  },
  "datos_estadisticos": ["...", "...", "..."],
  "mejoras_sugeridas": ["..."],
  "confidence_score": 0.0,
  "razon": "..."
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
