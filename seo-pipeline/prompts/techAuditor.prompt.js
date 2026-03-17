/**
 * IMPERIAL-AGENT v2: Prompts para Modulo 3 — Auditoria Tecnica BWT
 */

const PROMPT_VERSION = '2.0.0'

function getSystemPrompt() {
  return `Tecnico SEO especializado en sitios de manhwa en espanol. Corriges errores de metadatos con precision. El contenido generado debe sonar natural para lectores hispanos, nunca traducido ni artificial. Sin keyword stuffing.`
}

function getUserPrompt(data) {
  return `Pagina: ${data.url}
Tipo de error: ${data.tipo_error}
Keyword principal: ${data.keyword}
Contenido HTML relevante: ${data.fragmento_html}
Posicion actual en Bing: ${data.posicion}

Devuelve SOLO este JSON:
{
  "campo_a_actualizar": "meta_description|title|alt|schema_jsonld",
  "valor_nuevo": "string",
  "razon": "string",
  "confidence_score": 0.0
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
