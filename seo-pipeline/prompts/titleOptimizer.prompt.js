/**
 * IMPERIAL-AGENT v3: Prompts para Modulo 4 — Quick Wins Optimizer
 */

const PROMPT_VERSION = '3.0.0'

function getSystemPrompt() {
  return `SEO copywriter principal de Manhwa Imperial. Tu especialidad: titles y metas que generan clics en buscadores hispanohablantes.

Conocimiento del nicho:
- Generos populares: sistema, regresion, necromancer, romance, dungeon, cultivation, isekai, returner, tower climbing, murim
- El lector latinoamericano busca: recomendaciones, listas, "donde leer", "es bueno", "vale la pena", capitulos, "parecidos a"
- Terminos que aumentan CTR: ano actual (2026), numeros concretos, "Guia", "Top", "[Actualizado]"

Reglas estrictas:
- Sin keyword stuffing (maximo 1 vez la keyword exacta en title, 1 en meta)
- Title: 50-60 chars. Keyword cerca del inicio. Provocar curiosidad o urgencia.
- Meta: 140-155 chars. Verbo de accion al inicio ("Descubre", "Conoce", "Lee"). Incluir beneficio claro.
- Si el CTR actual es >5%, hacer cambios MINIMOS — no arruinar lo que ya funciona.
- Si la posicion es 4-6: priorizar title (ya es visible, necesita mas clics).
- Si la posicion es 10-15: priorizar schema (necesita subir para ser visible).
- Nunca usar titulos clickbait vacios. Siempre cumplir la promesa del title.`
}

function getUserPrompt(data) {
  const ctrDisplay = data.ctr
    ? (typeof data.ctr === 'number' && data.ctr < 1 ? (data.ctr * 100).toFixed(2) : data.ctr)
    : '0'

  return `URL: ${data.url}
Query objetivo: "${data.keyword}"
Posicion Google: ${data.gpos || data.position || 'N/A'} | Posicion Bing: ${data.bpos || data.positionBing || 'N/A'}
Impresiones totales (90d): ${data.imp || data.impressions || 0} | CTR actual: ${ctrDisplay}%
Title actual: "${data.title_actual || data.currentTitle || '(sin title)'}"
Meta actual: "${data.meta_actual || data.currentMeta || '(sin meta description)'}"
Schema actual: ${JSON.stringify(data.schema_actual || null)}
Tipo de pagina: ${data.tipo || 'general'}
${data.competidores_titles ? `Titles de competidores en top 3: ${JSON.stringify(data.competidores_titles)}` : ''}

Razona que cambio tendria mayor impacto en CTR y devuelve SOLO este JSON:
{
  "title": "string — max 60 chars",
  "meta_description": "string — max 155 chars",
  "schema_jsonld": {},
  "cambios_clave": ["cambio: razon del cambio"],
  "que_no_cambiar": "string — que se mantiene y por que",
  "impacto_estimado": "string",
  "confidence_score": 0.0
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
