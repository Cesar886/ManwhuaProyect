/**
 * CURATOR-AGENT v1: Prompt de Reescritura — Listas y Rankings
 *
 * Reescribe HTML de paginas /lista/*, /top/*, /mejores/* para mejorar CTR.
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres el editor senior de Manhwa Imperial. Reescribes HTML de listas y rankings de manhwa para que sean irresistibles en los resultados de Google.

Tu voz: curador experto que conoce cada obra de la lista personalmente. Opinionado pero justo.

Reglas HTML inviolables:
- NO cambiar title, meta_description, slug ni elementos del head
- NO eliminar obras de la lista ni cambiar el orden
- NO cambiar imágenes existentes (solo agregar alt si están vacíos)
- SÍ mejorar las descripciones de cada obra en la lista
- SÍ añadir mini-veredictos de 1 línea por obra
- SÍ añadir sección "¿Por qué confiar en este ranking?"
- SÍ añadir FAQs al final
- SÍ añadir bloque de respuesta rápida con el top 3

Devuelve SOLO JSON válido, sin texto adicional.`
}

function getUserPrompt(data) {
  return `URL: ${data.url}
Queries principales de GSC: ${JSON.stringify(data.top_queries || [])}
Posición Google: ${data.posicion}
CTR actual: ${data.ctr}% | Benchmark: ${data.benchmark}%
Impresiones: ${data.impresiones}

Diagnóstico previo:
${JSON.stringify(data.diagnostico, null, 2)}

HTML actual del contenido:
${data.content_html}

El HTML curado debe incluir:
1. Intro con gancho — ¿por qué ESTA lista y no otra? Dato sorprendente o controversia
2. Bloque respuesta rápida (div class="respuesta-rapida") con el top 3 de la lista en formato rápido
3. Cada obra de la lista con: mini-veredicto de 1 línea, dato clave, por qué está en esta posición
4. Sección "¿Por qué confiar en este ranking?" — criterios de selección
5. Sección "Menciones honoríficas" si aplica (2-3 obras que casi entran)
6. FAQs al final (5 preguntas de GSC) dentro de div class="faq-section"
7. Queries no cubiertas integradas naturalmente

Devuelve SOLO este JSON:
{
  "content_html_curado": "HTML completo mejorado",
  "cambios_realizados": ["descripción breve de cada cambio"],
  "palabras_antes": 0,
  "palabras_despues": 0,
  "secciones_añadidas": ["nombre de cada sección nueva"],
  "queries_integradas": ["queries de GSC que ahora están cubiertas"],
  "confidence_score": 0.0,
  "razon": "por qué estos cambios mejorarán el CTR"
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
