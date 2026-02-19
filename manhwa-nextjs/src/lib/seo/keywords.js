/**
 * Generador avanzado de keywords SEO para manhwa
 * Optimizado para mercados hispanohablantes con alta conversión
 */

const GENRE_EXPANSION = {
  'acción': ['peleas', 'combates', 'poderes', 'batalla'],
  'accion': ['peleas', 'combates', 'poderes', 'batalla'],
  'romance': ['amor', 'pareja', 'romantico', 'shojo'],
  'fantasía': ['magia', 'medieval', 'isekai', 'otro mundo'],
  'fantasia': ['magia', 'medieval', 'isekai', 'otro mundo'],
  'escolar': ['instituto', 'estudiantes', 'high school', 'academia'],
  'escuela': ['instituto', 'estudiantes', 'high school', 'academia'],
  'drama': ['emocional', 'tragedia', 'intenso'],
  'comedia': ['divertido', 'humor', 'gracioso'],
  'terror': ['miedo', 'horror', 'suspenso', 'oscuro'],
  'horror': ['miedo', 'terror', 'suspenso', 'oscuro'],
  'adulto': ['maduro'],
  'artes marciales': ['murim', 'cultivacion', 'artes marciales'],
  'aventura': ['exploracion', 'viaje', 'quest'],
  'ciencia ficción': ['sci-fi', 'futuro', 'tecnologia'],
  'ciencia ficcion': ['sci-fi', 'futuro', 'tecnologia'],
  'misterio': ['detective', 'enigma', 'investigacion'],
  'supernatural': ['sobrenatural', 'espiritus', 'demonios'],
  'venganza': ['revancha', 'justicia'],
  'thriller': ['suspenso', 'tension', 'intriga'],
  'historico': ['historia', 'epoca', 'antiguo'],
  'histórico': ['historia', 'epoca', 'antiguo'],
  'politica': ['reino', 'poder', 'conspiracion'],
  'política': ['reino', 'poder', 'conspiracion'],
  'juego': ['gaming', 'sistema', 'leveling'],
}

const CURRENT_YEAR = new Date().getFullYear()

/**
 * Genera keywords SEO para la página de detalles de un manhwa
 * @param {Object} series - Datos de la serie
 * @param {string} series.title - Título del manhwa
 * @param {Array} series.genres - Géneros [{name: string}] o string[]
 * @param {string} [series.author] - Autor
 * @param {string} [series.status] - Estado: ongoing, completed, paused
 * @param {string} [series.contentType] - manhwa, manga, manhua
 * @param {string[]} [series.alternativeTitles] - Títulos alternativos
 * @returns {string[]} Array de keywords ordenadas por prioridad
 */
export function generateSeriesKeywords(series) {
  if (!series?.title) return ['manhwa en español', 'leer manhwa gratis']

  const title = series.title
  const genres = (series.genres || []).map(g => typeof g === 'string' ? g : g?.name).filter(Boolean)
  const author = typeof series.author === 'string' ? series.author : series.author?.name || ''
  const type = series.contentType || 'manhwa'
  const altTitles = series.alternativeTitles || []

  const kw = new Set()
  const add = (k) => { if (k && k.trim()) kw.add(k.trim()) }

  // A. TRANSACCIONALES (alta conversión) — PRIMERO
  add(`leer ${title} online gratis`)
  add(`leer ${title}`)
  add(`leer ${title} en español`)
  add(`leer ${title} online`)
  add(`leer ${title} gratis`)
  add(`leer ${title} completo`)
  add(`${title} leer online gratis`)
  add(`${title} todos los capitulos gratis`)
  add(`${title} capitulos completos`)
  add(`${title} online gratis español`)
  add(`${title} sin registro`)
  add(`${title} lectura gratuita`)

  // B. MARCA/TÍTULO
  add(title)
  add(`${title} manhwa`)
  add(`${title} webtoon`)
  add(`${title} en español`)
  add(`${title} manga`)
  add(`${title} comic`)
  add(`${title} serie`)
  add(`${title} historia`)

  // Títulos alternativos
  for (const alt of altTitles.slice(0, 3)) {
    add(alt)
    add(`${alt} manhwa`)
    add(`leer ${alt}`)
  }

  // C. BÚSQUEDA POR VOZ
  add(`donde puedo leer ${title}`)
  add(`donde leer ${title} gratis`)
  add(`como leer ${title} en español`)
  add(`pagina para leer ${title}`)

  // D. AI OVERVIEWS / INFORMACIONALES
  add(`que es ${title}`)
  add(`de que trata ${title}`)
  add(`vale la pena leer ${title}`)
  add(`cuantos capitulos tiene ${title}`)

  // E. DESCUBRIMIENTO
  add(`manhwa parecido a ${title}`)
  add(`manhwa similar a ${title}`)
  add(`${title} recomendaciones`)
  add(`manhwa como ${title}`)
  add(`alternativas a ${title}`)
  add(`si te gusto ${title}`)

  // F. ESTADO/ACTUALIZACIÓN
  add(`${title} capitulo nuevo`)
  add(`${title} ultimo capitulo`)
  add(`${title} actualizado`)
  add(`${title} capitulos nuevos`)

  // G. GÉNEROS DINÁMICOS
  for (const genre of genres) {
    const gl = genre.toLowerCase()
    add(`${type} de ${gl}`)
    add(`${type} ${gl} español`)
    add(`mejor ${type} ${gl}`)
    add(`${type} ${gl} recomendado`)

    // Expansión semántica
    const expanded = GENRE_EXPANSION[gl]
    if (expanded) {
      for (const term of expanded.slice(0, 2)) {
        add(`${type} ${term}`)
      }
    }
  }

  // H. LSI/SEMÁNTICAS
  add(`comic coreano ${title}`)
  add(`webtoon coreano español`)
  add(`${title} full color`)
  add(`${title} en castellano`)
  add(`${title} latinoamerica`)

  // I. INTENCIÓN COMERCIAL
  add(`${title} gratis sin anuncios`)
  add(`mejor pagina para ${title}`)

  // J. TENDENCIA/TEMPORADA
  add(`${title} ${CURRENT_YEAR}`)
  add(`manhwa nuevos ${CURRENT_YEAR}`)

  // K. UNIVERSALES DE ALTO VOLUMEN
  add('leer manhwa gratis')
  add('manhwa en español')
  add('webtoon gratis español')
  add('manhwa online')
  add(`manhwa ${CURRENT_YEAR}`)
  add('manhwa completo')

  // Autor si existe
  if (author) {
    add(`${author} manhwa`)
    add(`${author} obras`)
  }

  // Limitar a 55 keywords máximo
  return [...kw].slice(0, 55)
}

/**
 * Genera keywords SEO para la página de un capítulo específico
 * @param {Object} series - Datos de la serie
 * @param {string|number} chapterNum - Número del capítulo
 * @returns {string[]} Array de keywords ordenadas por prioridad
 */
export function generateChapterKeywords(series, chapterNum) {
  if (!series?.title) return ['leer manhwa gratis', 'manhwa en español']

  const title = series.title
  const n = Number(chapterNum)
  const type = series.contentType || 'manhwa'

  const kw = new Set()
  const add = (k) => { if (k && k.trim()) kw.add(k.trim()) }

  // A. ESPECÍFICAS DEL CAPÍTULO (prioridad máxima)
  add(`${title} capitulo ${n}`)
  add(`${title} cap ${n}`)
  add(`leer ${title} capitulo ${n}`)
  add(`${title} capitulo ${n} español`)
  add(`${title} capitulo ${n} online`)
  add(`${title} capitulo ${n} gratis`)
  add(`${title} ${n}`)
  add(`${title} chapter ${n}`)
  add(`${title} episodio ${n}`)
  add(`${title} cap ${n} español`)
  add(`ver ${title} capitulo ${n}`)
  add(`${title} capitulo ${n} completo`)

  // B. LONG-TAIL CAPÍTULO
  add(`leer ${title} capitulo ${n} online gratis`)
  add(`${title} cap ${n} sin registro`)
  add(`donde leer ${title} ${n}`)
  add(`${title} capitulo ${n} en español latino`)
  add(`${title} ${n} lectura gratis`)
  add(`${title} cap ${n} completo español`)
  add(`ver online ${title} ${n}`)

  // C. NAVEGACIÓN CONTEXTUAL
  if (n > 1) add(`${title} capitulo ${n - 1}`)
  add(`${title} capitulo ${n + 1}`)
  add(`${title} capitulos`)
  add(`lista de capitulos ${title}`)
  add(`${title} todos los caps`)
  add(`${title} indice`)

  // D. ENGAGEMENT
  add(`${title} ${n} opinion`)
  add(`${title} capitulo ${n} resumen`)
  add(`que pasa en ${title} ${n}`)
  add(`${title} ${n} spoilers`)
  add(`${title} capitulo ${n} analisis`)

  // E. UNIVERSALES
  add('leer manhwa gratis')
  add('manhwa en español')
  add('webtoon gratis español')
  add(`${type} online`)

  // Limitar a 35 keywords máximo
  return [...kw].slice(0, 35)
}
