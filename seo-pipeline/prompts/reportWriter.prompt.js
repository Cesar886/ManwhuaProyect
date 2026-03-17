/**
 * IMPERIAL-AGENT v3: Prompts para Modulo 9 — Reporte Ejecutivo Semanal
 */

const PROMPT_VERSION = '3.0.0'

function getSystemPrompt() {
  return `Analista de datos de Manhwa Imperial. Reportes ejecutivos en espanol.
Tono: directo, solo numeros y acciones. Sin relleno.
El reporte se muestra en el panel admin CMS — debe ser accionable.
Incluir tendencias: comparar con semana anterior.
Destacar: que funciono, que no funciono, que hacer la proxima semana.
Si hay problemas criticos (caidas >30%, errores tecnicos), ponerlos primero.`
}

function getUserPrompt(consolidatedData) {
  return `${JSON.stringify(consolidatedData, null, 2)}

Devuelve SOLO este JSON:
{
  "resumen_ejecutivo": "string — 3-4 lineas: que paso, que impacto tuvo, que sigue",
  "acciones_realizadas": [
    { "accion": "string", "modulo": "string", "url": "string", "resultado": "string" }
  ],
  "drafts_pendientes": [
    { "descripcion": "string", "modulo": "string", "score": 0.0, "prioridad": "alta|media|baja" }
  ],
  "metricas": {
    "clics_google": { "semana": 0, "anterior": 0, "cambio_pct": 0.0, "tendencia": "subiendo|estable|bajando" },
    "clics_bing": { "semana": 0, "anterior": 0, "cambio_pct": 0.0, "tendencia": "string" },
    "impresiones": { "semana": 0, "anterior": 0, "cambio_pct": 0.0 },
    "ctr_promedio": { "google": 0.0, "bing": 0.0 },
    "paginas_creadas": 0,
    "paginas_optimizadas": 0,
    "errores_corregidos": 0,
    "enlaces_internos_creados": 0
  },
  "geo": {
    "clics_copilot": 0,
    "clics_copilot_anterior": 0,
    "queries_pregunta_total": 0,
    "queries_pregunta_nuevas": 0,
    "paginas_con_faqpage": 0,
    "paginas_con_speakable": 0,
    "paginas_citadas_copilot": []
  },
  "costos": {
    "semana_usd": 0.00,
    "mes_usd": 0.00,
    "limite_usd": 20,
    "pct_usado": 0.0,
    "tokens_semana": 0,
    "alerta": "string o null"
  },
  "top_paginas_semana": [
    { "url": "string", "clics": 0, "cambio_pct": 0.0, "fuente": "google|bing|copilot" }
  ],
  "problemas_detectados": [
    { "problema": "string", "severidad": "critica|alta|media", "accion_sugerida": "string" }
  ],
  "proximas_acciones": [
    { "accion": "string", "modulo": "string", "prioridad": "1|2|3", "impacto_estimado": "string" }
  ]
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
