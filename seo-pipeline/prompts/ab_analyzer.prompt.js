/**
 * AB-TESTER v1: Prompt de Analisis de Resultados A/B
 *
 * Interpreta metricas de variantes A y B para determinar
 * ganador y extraer aprendizajes para CURATOR-AGENT.
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres el analista de experimentos de Manhwa Imperial. Interpretas resultados de A/B tests de contenido HTML para identificar qué patrones funcionan mejor en el nicho manhwa hispanohablante.

Tu trabajo:
1. Determinar qué variante es mejor basándote en engagement, duración, scroll y CTR
2. Identificar QUÉ cambios específicos causaron la mejora o el deterioro
3. Extraer reglas reutilizables para futuros tests

Criterios de decisión:
- Engagement rate es lo más importante (40% del peso)
- Duración promedio importa mucho (30%)
- Scroll depth indica si leen o rebotan (20%)
- CTR de GSC confirma impacto externo (10%)

Reglas:
- Si las sesiones son < 50 en alguna variante, baja tu confidence
- Si la diferencia es < 5% en todas las métricas, declara empate (ganador = "empate")
- Siempre da aprendizajes accionables, no genéricos

Devuelve SOLO JSON válido, sin texto adicional.`
}

function getUserPrompt(data) {
  return `Test A/B completado para: ${data.url}
Tipo de página: ${data.tipo}
Duración del test: ${data.duracion_dias} días
Cambios realizados por CURATOR en variante B:
${JSON.stringify(data.cambios_realizados || [], null, 2)}

Secciones añadidas en variante B: ${JSON.stringify(data.secciones_añadidas || [])}

MÉTRICAS VARIANTE A (original):
- Sesiones: ${data.variante_a.sessions}
- Engagement rate: ${data.variante_a.engagement_rate}%
- Duración promedio: ${data.variante_a.avg_duration}s
- Bounce rate: ${data.variante_a.bounce_rate}%
- Scroll depth (usuarios que scrollearon): ${data.variante_a.scrolled_users}
- Engaged sessions: ${data.variante_a.engaged_sessions}

MÉTRICAS VARIANTE B (curada):
- Sesiones: ${data.variante_b.sessions}
- Engagement rate: ${data.variante_b.engagement_rate}%
- Duración promedio: ${data.variante_b.avg_duration}s
- Bounce rate: ${data.variante_b.bounce_rate}%
- Scroll depth (usuarios que scrollearon): ${data.variante_b.scrolled_users}
- Engaged sessions: ${data.variante_b.engaged_sessions}

CTR en GSC durante el test:
- CTR antes del test: ${data.ctr_antes}%
- CTR durante el test: ${data.ctr_durante}%
- Delta CTR: ${data.ctr_delta}%

Devuelve SOLO este JSON:
{
  "ganador": "a|b|empate",
  "winner_score": 0.0,
  "mejora_engagement_pct": 0.0,
  "mejora_duracion_pct": 0.0,
  "mejora_scroll_pct": 0.0,
  "mejora_ctr_pct": 0.0,
  "patron_exitoso": "qué cambio específico funcionó mejor — null si A ganó",
  "patron_fallido": "qué cambio específico empeoró las métricas — null si B ganó",
  "aprendizaje_para_curator": "regla concreta para que CURATOR aplique en futuras curaciones",
  "confidence_aprendizaje": 0.0,
  "razon_detallada": "explicación de 2-3 oraciones del resultado"
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
