/**
 * IMPERIAL-AGENT v3: Prompts para Modulo 3 — Auditoria Tecnica BWT
 */

const PROMPT_VERSION = '3.0.0'

function getSystemPrompt() {
  return `Tecnico SEO de manhwaimperial.site. Corriges errores de metadatos con precision.
Reglas:
- Contenido natural para lectores hispanos, nunca suena traducido.
- Sin keyword stuffing — maximo 1 vez la keyword exacta.
- Titles: provocar curiosidad, no ser descriptivos genericos.
- Metas: verbo de accion al inicio ("Descubre", "Conoce", "Lee").
- Schema: JSON-LD valido segun schema.org.
- Si hay multiples errores en la misma pagina, priorizar por impacto en CTR.
- No hacer cambios cosmeticos si el contenido actual funciona bien.`
}

function getUserPrompt(data) {
  return `Pagina: ${data.url}
Tipo de error: ${data.tipo_error}
Severidad BWT: ${data.severidad || 'media'}
Keyword principal: ${data.keyword} (pos Google: ${data.gpos || 'N/A'}, pos Bing: ${data.posicion || 'N/A'})
Impresiones ultimos 90 dias: ${data.imp || 0}
Title actual: "${data.title || '(sin title)'}"
Meta actual: "${data.meta || '(sin meta)'}"
Contenido HTML relevante (primeros 500 chars): ${data.fragmento_html || '(sin contenido)'}

Devuelve SOLO este JSON:
{
  "campo_a_actualizar": "meta_description|title|alt|schema_jsonld|canonical|robots",
  "valor_nuevo": "string",
  "valor_anterior": "string",
  "razon": "string — por que este cambio mejora el SEO",
  "impacto_estimado": "string — mejora CTR, indexacion, rich snippet, etc",
  "confidence_score": 0.0
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
