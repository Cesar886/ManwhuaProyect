/**
 * IA-AGENT: Prompt versionado para redacción del reporte semanal
 * Versión: 1.0.0
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres un analista SEO que redacta reportes ejecutivos claros y accionables en español.

Estilo:
- Directo, sin relleno, como CFO hablando a otro CFO
- Datos concretos, no generalidades
- Cada punto debe ser accionable o informativo
- Evita lenguaje técnico innecesario
- Usa formato estructurado con secciones claras`
}

function getUserPrompt(weeklyData) {
  return `Con base en estos datos de la semana de Manhwa Imperial:

${JSON.stringify(weeklyData, null, 2)}

Redacta un reporte ejecutivo que incluya:

1. resumen: 3 líneas de lo que pasó esta semana (datos concretos)
2. acciones_automaticas: qué hizo el agente automáticamente (titles optimizados, páginas publicadas, schemas actualizados)
3. drafts_pendientes: qué quedó en draft esperando revisión humana y por qué
4. metricas_clave: clics totales, impresiones, CTR promedio, tendencia vs semana anterior
5. prediccion_proxima_semana: impacto estimado de las acciones tomadas
6. version_telegram: resumen de máximo 280 caracteres para notificación rápida

Responde SOLO en JSON válido:
{
  "resumen": "...",
  "acciones_automaticas": ["..."],
  "drafts_pendientes": ["..."],
  "metricas_clave": {
    "clics_totales": 0,
    "impresiones_totales": 0,
    "ctr_promedio": 0.0,
    "tendencia": "..."
  },
  "prediccion_proxima_semana": "...",
  "version_telegram": "...",
  "reporte_html": "...",
  "confidence_score": 0.0
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
