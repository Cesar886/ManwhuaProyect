/**
 * CURATOR-AGENT v1: Prompt de Diagnostico de HTML
 *
 * Analiza por que una pagina rankea bien pero tiene CTR bajo.
 * Detecta causas raiz en el contenido HTML.
 */

const PROMPT_VERSION = '1.0.0'

function getSystemPrompt() {
  return `Eres un auditor de contenido SEO especializado en sitios de manhwa en español. Analizas HTML de páginas que rankean bien pero tienen CTR bajo y detectas las causas exactas.

Tu trabajo es identificar por qué los usuarios ven la página en los resultados de Google pero NO hacen clic. Esto puede deberse a:
- Contenido vago que no responde la intención de búsqueda
- Falta de estructura (sin H2, sin listas, bloques de texto enormes)
- Introducción aburrida que no engancha
- Falta de datos concretos (año, capítulos, estado, puntuación)
- Sin sección de FAQs que capture snippets
- Sin respuesta rápida visible en los primeros párrafos
- Queries de GSC que el contenido no cubre

Devuelve SOLO JSON válido, sin texto adicional.`
}

function getUserPrompt(data) {
  return `URL: ${data.url}
Tipo de página: ${data.tipo}
Posición promedio Google: ${data.posicion}
CTR actual: ${data.ctr}% vs benchmark del tipo: ${data.benchmark}%
Impresiones últimos 90 días: ${data.impresiones}
Queries principales de GSC: ${JSON.stringify(data.top_queries || [])}

Métricas del HTML actual:
- Palabras: ${data.metricas.word_count}
- H2s: ${data.metricas.h2_count}
- H3s: ${data.metricas.h3_count}
- Tiene FAQ: ${data.metricas.has_faq}
- Tiene respuesta rápida: ${data.metricas.has_quick_answer}
- Tiene listas: ${data.metricas.has_list}
- Imágenes: ${data.metricas.img_count}
- Promedio palabras por sección: ${data.metricas.avg_section_words}

HTML completo del contenido:
${data.content_html}

Devuelve SOLO este JSON:
{
  "diagnostico_principal": "causa raíz en 1 frase",
  "problemas": [
    {
      "id": "p1",
      "tipo": "contenido_vago|sin_estructura|sin_gancho|sin_datos|muy_corto|sin_faq|intro_aburrida",
      "ubicacion_html": "qué etiqueta/sección del HTML tiene el problema",
      "descripcion": "qué está fallando exactamente",
      "solucion": "qué cambiar para mejorar el CTR"
    }
  ],
  "queries_no_cubiertas": ["queries de GSC que el contenido actual no responde"],
  "longitud_ideal_palabras": 0,
  "necesita_faq": true,
  "necesita_quick_answer": true,
  "seccion_mas_debil": "nombre de la sección HTML más débil"
}`
}

module.exports = { getSystemPrompt, getUserPrompt, PROMPT_VERSION }
