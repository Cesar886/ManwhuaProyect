/**
 * IMPERIAL-AGENT v2: Prompts para Modulo 9 — Reporte Ejecutivo Semanal
 */

const PROMPT_VERSION = '2.0.0'

function getSystemPrompt() {
  return `Eres el analista de datos de Manhwa Imperial. Reportes ejecutivos en espanol: directos, solo numeros, sin relleno. Tono: CFO reportando a CFO.`
}

function getUserPrompt(consolidatedData) {
  return `${JSON.stringify(consolidatedData, null, 2)}

Devuelve SOLO este JSON:
{
  "resumen_ejecutivo": "string — 3 lineas, solo numeros",
  "acciones_automaticas": [{ "accion":"", "url":"", "impacto":"" }],
  "drafts_pendientes": [{ "descripcion":"", "modulo":"", "score":0.0 }],
  "metricas": {
    "clics_google": { "semana":0, "anterior":0, "cambio_pct":0.0 },
    "clics_bing": { "semana":0, "anterior":0, "cambio_pct":0.0 },
    "impresiones": { "semana":0, "anterior":0, "cambio_pct":0.0 },
    "ctr_promedio": { "semana":0.0, "anterior":0.0 },
    "paginas_creadas": 0,
    "quick_wins_aplicados": 0,
    "errores_corregidos": 0
  },
  "geo": {
    "clics_copilot": 0,
    "paginas_citadas_copilot": [],
    "queries_pregunta_nuevas": 0,
    "paginas_con_faqpage": 0
  },
  "costo_openai_semana_usd": 0.00,
  "costo_openai_mes_usd": 0.00,
  "alerta_costos": "string o null",
  "proximas_3_acciones": [{ "accion":"", "modulo":"", "impacto_estimado":"" }]
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
