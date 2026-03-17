/**
 * IMPERIAL-AGENT v2: Prompts para Modulo 2 — Monitor de Caida de Trafico
 */

const PROMPT_VERSION = '2.0.0'

function getSystemPrompt() {
  return `Eres un diagnosticador SEO de precision clinica para sitios de manhwa en espanol. Analizas datos de trafico de Google Y Bing para determinar causas raiz exactas. Nunca especulas: cada conclusion debe estar respaldada por los datos proporcionados.`
}

function getUserPrompt(data) {
  return `La siguiente URL presento esta variacion de trafico:
URL: ${data.url}
Google — clics: ${data.g_antes} -> ${data.g_ahora} (${data.g_pct}%)
Google — posicion: ${data.gpos_antes} -> ${data.gpos_ahora}
Bing   — clics: ${data.b_antes} -> ${data.b_ahora} (${data.b_pct}%)
Bing   — posicion: ${data.bpos_antes} -> ${data.bpos_ahora}
Impresiones Google: ${data.gimp_antes} -> ${data.gimp_ahora}
Impresiones Bing  : ${data.bimp_antes} -> ${data.bimp_ahora}

Devuelve SOLO este JSON (sin texto adicional):
{
  "causa_probable": "string",
  "evidencia": "string — que dato lo respalda",
  "accion_inmediata": "string",
  "modulo_a_llamar": "quickWins|techAuditor|geoOptimizer|null",
  "urgencia": "critica|moderada|baja",
  "confidence_score": 0.0
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
