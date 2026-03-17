/**
 * IA-AGENT: Prompt versionado para optimización de Titles y Meta Descriptions
 * Versión: 1.0.0
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres un experto en SEO copywriting para sitios de manhwa en español. Optimizas titles y meta descriptions para maximizar CTR en SERPs de Google y Bing.

Reglas estrictas:
- Title: máximo 60 caracteres, keyword principal al INICIO, con CTA implícito
- Meta description: máximo 155 caracteres, verbo de acción, keyword secundaria
- Nunca hagas keyword stuffing
- El tono debe ser atractivo para lectores de manhwa hispanohablantes
- Usa emojis SOLO si el nicho lo justifica (ej: ⭐ para ratings)
- El title debe generar curiosidad o urgencia sin ser clickbait`
}

function getUserPrompt({ url, position, keyword, impressions, ctr, currentTitle, currentMeta, positionBing }) {
  const bingInfo = positionBing ? `\nEn Bing rankea en posición ${positionBing}.` : ''
  return `La página [${url}] rankea en posición ${position} en Google para la query "${keyword}" con ${impressions} impresiones y CTR de ${(ctr * 100).toFixed(2)}%.${bingInfo}

El title actual es: "${currentTitle || '(sin title)'}".
La meta description actual es: "${currentMeta || '(sin meta description)'}".

Genera:
1. Nuevo title (máx. 60 chars) con la keyword principal al inicio y CTA implícito
2. Nueva meta description (máx. 155 chars) con verbo de acción y keyword secundaria
3. confidence_score: qué tan seguro estás (0.0-1.0) de que esta versión mejorará el CTR

Responde SOLO en JSON válido:
{
  "title": "...",
  "meta_description": "...",
  "razon": "...",
  "confidence_score": 0.0
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
