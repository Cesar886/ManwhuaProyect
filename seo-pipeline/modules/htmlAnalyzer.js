/**
 * CURATOR-AGENT v1: Analizador de HTML
 *
 * Extrae metricas de calidad del contenido HTML de una pagina:
 *   word_count, h2_count, h3_count, has_faq, has_quick_answer,
 *   has_list, img_count, avg_section_words
 *
 * Tambien detecta tipo de pagina por slug/URL.
 */

/**
 * Extraer metricas de calidad de un bloque HTML
 * @param {string} html - content_html completo
 * @returns {Object} metricas
 */
function analyzeHtml(html) {
  if (!html || typeof html !== 'string') {
    return {
      word_count: 0,
      h2_count: 0,
      h3_count: 0,
      has_faq: false,
      has_quick_answer: false,
      has_list: false,
      img_count: 0,
      avg_section_words: 0,
    }
  }

  // Extraer texto plano (sin tags)
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = textOnly.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length

  // Contar encabezados
  const h2Matches = html.match(/<h2[\s>]/gi) || []
  const h3Matches = html.match(/<h3[\s>]/gi) || []

  // Detectar FAQs
  const hasFaq = /faq|preguntas?\s*frecuentes|faqpage/i.test(html) ||
    /"@type"\s*:\s*"FAQPage"/i.test(html)

  // Detectar quick answer / respuesta rapida
  const hasQuickAnswer = /respuesta[_-]?rapida|quick[_-]?answer|featured[_-]?snippet/i.test(html) ||
    /class="[^"]*respuesta[^"]*"/i.test(html)

  // Detectar listas
  const hasList = /<[ou]l[\s>]/i.test(html)

  // Contar imagenes
  const imgMatches = html.match(/<img[\s>]/gi) || []

  // Calcular promedio de palabras por seccion (entre h2s)
  let avgSectionWords = 0
  if (h2Matches.length > 0) {
    const sections = html.split(/<h2[\s>]/i)
    const sectionWordCounts = sections.slice(1).map(section => {
      const sectionText = section
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return sectionText.split(/\s+/).filter(w => w.length > 0).length
    })
    if (sectionWordCounts.length > 0) {
      avgSectionWords = Math.round(
        sectionWordCounts.reduce((a, b) => a + b, 0) / sectionWordCounts.length
      )
    }
  }

  return {
    word_count: wordCount,
    h2_count: h2Matches.length,
    h3_count: h3Matches.length,
    has_faq: hasFaq,
    has_quick_answer: hasQuickAnswer,
    has_list: hasList,
    img_count: imgMatches.length,
    avg_section_words: avgSectionWords,
  }
}

/**
 * Detectar tipo de pagina por URL/slug
 * @param {string} url
 * @returns {string} obra|lista|resena|genero|general
 */
function detectPageType(url) {
  if (/\/(obra|manhwa)\//i.test(url)) return 'obra'
  if (/\/(lista|top|mejores)\//i.test(url)) return 'lista'
  if (/\/(resena|review)\//i.test(url)) return 'resena'
  if (/\/(genero|tag)\//i.test(url)) return 'genero'
  return 'general'
}

/**
 * Benchmarks de CTR por tipo de pagina
 */
const CTR_BENCHMARKS = {
  obra: 4.0,
  lista: 5.5,
  resena: 3.5,
  genero: 2.5,
  general: 3.0,
}

/**
 * Detectar imagenes sin alt text
 * @param {string} html
 * @returns {number} cantidad de imgs sin alt
 */
function countImagesWithoutAlt(html) {
  if (!html) return 0
  const imgs = html.match(/<img[^>]*>/gi) || []
  return imgs.filter(img => {
    const altMatch = img.match(/alt\s*=\s*"([^"]*)"/i)
    return !altMatch || altMatch[1].trim() === ''
  }).length
}

module.exports = {
  analyzeHtml,
  detectPageType,
  CTR_BENCHMARKS,
  countImagesWithoutAlt,
}
