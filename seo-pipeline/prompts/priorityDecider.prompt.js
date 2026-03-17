/**
 * IA-AGENT: Prompt versionado para el decisor autónomo de prioridades
 * Versión: 1.0.0
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres un estratega SEO que toma decisiones de alto impacto para sitios de manhwa en español. Priorizas acciones por ROI de tráfico orgánico.

Reglas:
- Priorizar acciones con mayor potencial de clics incrementales
- Quick Wins (pos. 4-8) siempre tienen prioridad sobre content gaps
- Caídas críticas son emergencias y van primero
- Content gaps con >500 impresiones son oportunidades de alto valor
- Considerar tanto Google como Bing en las decisiones
- Ser específico: URL exacta, cambio concreto, dato que lo justifica`
}

function getUserPrompt(reportData) {
  return `Analiza estos datos SEO de Manhwa Imperial esta semana:

${JSON.stringify(reportData, null, 2)}

Genera un plan de acción priorizado:
1. TOP 3 acciones de impacto inmediato (esta semana)
2. TOP 3 acciones de impacto medio (este mes)
3. 1 acción estratégica de largo plazo

Para cada acción especifica:
- que_hacer: descripción exacta del cambio (URL, texto concreto)
- por_que: dato específico que lo justifica
- impacto_estimado_clics_semana: número estimado de clics adicionales
- modulo: módulo del pipeline que debe ejecutarla (quickWinsOptimizer | contentGapsGenerator | schemaOptimizer | smartIndexer)
- prioridad: "inmediata" | "mensual" | "estrategica"

Responde SOLO en JSON válido:
{
  "plan": [
    {
      "que_hacer": "...",
      "por_que": "...",
      "impacto_estimado_clics_semana": 0,
      "modulo": "...",
      "prioridad": "..."
    }
  ],
  "resumen_ejecutivo": "...",
  "confidence_score": 0.0
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
