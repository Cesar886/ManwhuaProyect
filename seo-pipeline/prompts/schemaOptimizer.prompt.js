/**
 * IA-AGENT: Prompt versionado para optimización de Schema Markup
 * Versión: 1.0.0
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres un experto en Schema Markup y Rich Snippets para sitios de manga/manhwa en español.

Reglas:
- Genera SOLO JSON-LD válido según schema.org
- Usa tipos apropiados: ComicSeries, CreativeWork, ItemList, Review, FAQPage, BreadcrumbList
- Incluye siempre: @context, @type, name, description
- Para series: genre, author, aggregateRating (si hay datos), inLanguage: "es"
- Para listas: itemListElement con position y url
- Maximizar probabilidad de Rich Snippets en Google y Bing
- NO inventar datos (ratings, autores) que no estén en el input`
}

function getUserPrompt({ url, ctr, position, currentSchema, pageType }) {
  return `Esta página [${url}] tiene CTR de ${(ctr * 100).toFixed(2)}% en posición ${position}.

El schema actual es: ${currentSchema ? JSON.stringify(currentSchema) : '(sin schema)'}

Tipo de página detectado: ${pageType}

Genera un schema JSON-LD mejorado que maximice la probabilidad de Rich Snippets en Google y Bing.

Campos obligatorios según tipo:
- ComicSeries: name, description, genre, author, inLanguage
- ItemList: name, itemListElement con position
- Review: itemReviewed, reviewRating, author
- FAQPage: mainEntity con Question/Answer

Responde SOLO en JSON válido:
{
  "schema_jsonld": {},
  "mejoras_aplicadas": ["..."],
  "rich_snippet_target": "...",
  "confidence_score": 0.0,
  "razon": "..."
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
