import { SITE_URL, SITE_NAME } from '@/config'
import { ORGANIZATION_DATA, META_TEMPLATES } from './constants'

/**
 * ============================================================================
 * GENERADORES DE JSON-LD (Schema.org)
 * ============================================================================
 * 
 * Estos schemas ayudan a Google a entender mejor el contenido del sitio
 * y pueden generar rich snippets en los resultados de búsqueda.
 */

// ============================================================================
// ORGANIZATION SCHEMA
// Se usa en todas las páginas para identificar el sitio
// ============================================================================
export function generateOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
      caption: SITE_NAME,
    },
    description: META_TEMPLATES.home.description,
    foundingDate: '2024',
    slogan: 'Tu biblioteca de manhwas #1 en español',
    sameAs: [],
  }
}

// ============================================================================
// WEBSITE SCHEMA CON SEARCHACTION
// Permite que Google muestre un buscador en los resultados
// ============================================================================
export function generateWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: META_TEMPLATES.home.description,
    inLanguage: 'es',
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/biblioteca?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function generateComicSeriesJsonLd(series) {
  if (!series) return null

  const title = series.title || 'Manhwa'
  const genres = series.genres?.map(g => typeof g === 'string' ? g : g.name).filter(Boolean) || []
  const chapterCount = series.chapters?.length || series.chapterCount || 0

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ComicSeries',
    '@id': `${SITE_URL}/manhwa/${series.slug}#series`,
    name: title,
    alternateName: series.alternativeTitles || [],
    headline: `Leer ${title} Manhwa en Español`,
    url: `${SITE_URL}/manhwa/${series.slug}`,
    description: series.synopsis || series.description || `Lee ${title} manhwa completo en español gratis. Disfruta de este manhwa en ${SITE_NAME}.`,
    inLanguage: 'es',
    genre: genres,
    // SEO: Indicar que es accesible gratuitamente
    isAccessibleForFree: true,
    // Tipo de contenido
    '@graph': [],
  }

  // Imagen de portada
  if (series.coverUrl || series.cover) {
    jsonLd.image = {
      '@type': 'ImageObject',
      url: series.coverUrl || series.cover,
      width: 460,
      height: 640,
    }
  }

  // Autor
  if (series.author) {
    jsonLd.author = {
      '@type': 'Person',
      name: typeof series.author === 'string' ? series.author : series.author.name,
    }
  }

  // Ilustrador (si es diferente del autor)
  if (series.artist && series.artist !== series.author) {
    jsonLd.illustrator = {
      '@type': 'Person',
      name: typeof series.artist === 'string' ? series.artist : series.artist.name,
    }
  }

  // Número de capítulos
  if (chapterCount > 0) {
    jsonLd.numberOfIssues = chapterCount
  }

  // Estado de la serie
  if (series.status) {
    const statusMap = {
      'ongoing': 'In Progress',
      'completed': 'Completed',
      'paused': 'On Hold',
      'cancelled': 'Cancelled',
    }
    jsonLd.creativeWorkStatus = statusMap[series.status] || series.status
  }

  // Rating - Solo incluir si hay votos reales (Google penaliza ratings sin votos)
  const ratingCount = parseInt(series.ratingCount) || 0
  const rawRating = parseFloat(series.rating) || 0
  if (rawRating > 0 && ratingCount > 0) {
    // Backend almacena en escala 1-10, convertir a 1-5 para el Schema
    const ratingValue = Math.min(5, Math.max(1, rawRating / 2))
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingValue.toFixed(1),
      bestRating: '5',
      worstRating: '1',
      ratingCount: String(ratingCount),
    }
  }

  // Fechas
  if (series.releaseYear || series.createdAt) {
    jsonLd.datePublished = series.releaseYear ? String(series.releaseYear) : new Date(series.createdAt).toISOString().split('T')[0]
  }
  if (series.updatedAt) {
    jsonLd.dateModified = new Date(series.updatedAt).toISOString()
  }

  // Publisher
  jsonLd.publisher = {
    '@id': `${SITE_URL}/#organization`,
  }

  return jsonLd
}

// ============================================================================
// FAQPAGE SCHEMA PARA PÁGINAS DE MANHWA
// Genera preguntas frecuentes para aparecer en Google
// ============================================================================
export function generateFAQJsonLd(series) {
  if (!series) return null

  const title = series.title || 'este manhwa'
  const chapterCount = series.chapters?.length || series.chapterCount || 0
  const genres = series.genres?.map(g => typeof g === 'string' ? g : g.name).filter(Boolean) || []
  const status = series.status === 'completed' ? 'completado' : series.status === 'paused' ? 'pausado' : 'en emisión'

  const faqs = [
    {
      question: `¿Dónde puedo leer ${title} manhwa en español?`,
      answer: `Puedes leer ${title} manhwa completo en español gratis en ${SITE_NAME}. Ofrecemos todos los capítulos disponibles con la mejor calidad de imagen y traducciones actualizadas.`,
    },
    {
      question: `¿Cuántos capítulos tiene ${title}?`,
      answer: `${title} tiene actualmente ${chapterCount} capítulo${chapterCount !== 1 ? 's' : ''} disponible${chapterCount !== 1 ? 's' : ''} para leer en español. El manhwa está ${status} y actualizamos regularmente con nuevos capítulos.`,
    },
    {
      question: `¿${title} es un manhwa o un manga?`,
      answer: `${title} es un manhwa, es decir, un cómic originario de Corea del Sur. A diferencia del manga japonés, los manhwas se leen de izquierda a derecha y generalmente están a todo color.`,
    },
  ]

  // Agregar FAQ de géneros si existen
  if (genres.length > 0) {
    faqs.push({
      question: `¿De qué género es ${title}?`,
      answer: `${title} es un manhwa de ${genres.join(', ')}. Es una excelente opción si te gustan las historias de ${genres.slice(0, 2).join(' y ')}.`,
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

// ============================================================================
// CHAPTER/ISSUE SCHEMA
// Schema para páginas de capítulos individuales
// ============================================================================
/**
 * Genera JSON-LD para capítulos individuales (ComicIssue)
 *
 * IMPORTANTE para Google Rich Snippets:
 * - aggregateRating solo se incluye si se pasan datos de rating específicos del capítulo
 * - NO se copia el rating de la serie al capítulo (Google detecta datos duplicados
 *   idénticos en miles de páginas y anula los Rich Snippets)
 *
 * @param {Object} series - Datos de la serie
 * @param {string|number} chapterNum - Número del capítulo
 * @param {number|null} pageCount - Número de páginas
 * @param {Object|null} chapterRating - Rating específico del capítulo { rating, ratingCount }
 */
export function generateChapterJsonLd(series, chapterNum, pageCount = null, chapterRating = null) {
  if (!series) return null

  const title = series.title || series.slug?.replace(/-/g, ' ')
  const n = Number(chapterNum)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ComicIssue',
    '@id': `${SITE_URL}/manhwa/${series.slug}/capitulo/${chapterNum}#chapter`,
    issueNumber: n,
    name: `${title} Capítulo ${chapterNum}`,
    headline: `Leer ${title} Capítulo ${chapterNum} - Manhwa Online Gratis`,
    url: `${SITE_URL}/manhwa/${series.slug}/capitulo/${chapterNum}`,
    description: `Lee ${title} Capítulo ${chapterNum} manhwa online gratis en español. Disfruta de la mejor calidad de imagen en ${SITE_NAME}.`,
    inLanguage: 'es',
    isAccessibleForFree: true,
    isPartOf: {
      '@type': 'ComicSeries',
      '@id': `${SITE_URL}/manhwa/${series.slug}#series`,
      name: title,
      url: `${SITE_URL}/manhwa/${series.slug}`,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
  }

  // Número de páginas si está disponible
  if (pageCount) {
    jsonLd.numberOfPages = pageCount
  }

  // Imagen de portada de la serie
  if (series.coverUrl || series.cover) {
    jsonLd.image = series.coverUrl || series.cover
  }

  // Fecha de publicación del capítulo si está disponible
  const chapter = series.chapters?.find(c => Number(c.number) === n)
  if (chapter?.publishedAt) {
    jsonLd.datePublished = new Date(chapter.publishedAt).toISOString()
  }

  // Rating ESPECÍFICO del capítulo - Solo si hay votos reales propios
  // NO copiar el rating de la serie (Google penaliza datos duplicados idénticos)
  if (chapterRating) {
    const ratingCount = parseInt(chapterRating.ratingCount) || 0
    const rawRating = parseFloat(chapterRating.rating) || 0
    if (rawRating > 0 && ratingCount > 0) {
      jsonLd.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: rawRating.toFixed(1),
        bestRating: '5',
        worstRating: '1',
        ratingCount: String(ratingCount),
      }
    }
  }

  return jsonLd
}

export function generateBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url ? `${SITE_URL}${item.url}` : undefined,
    })),
  }
}

// ============================================================================
// COLLECTIONPAGE SCHEMA PARA PÁGINAS DE GÉNERO/CATEGORÍA
// ============================================================================
export function generateCollectionPageJsonLd(genre, manhwas = [], totalCount = 0) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/genero/${genre.toLowerCase().replace(/\s+/g, '-')}#collection`,
    name: `Manhwa de ${genre} en Español`,
    description: `Los mejores manhwas de ${genre} para leer gratis en español. Encuentra manhwas de ${genre} actualizados diariamente.`,
    url: `${SITE_URL}/genero/${genre.toLowerCase().replace(/\s+/g, '-')}`,
    inLanguage: 'es',
    numberOfItems: totalCount || manhwas.length,
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
  }

  // Lista de items si hay manhwas
  if (manhwas.length > 0) {
    jsonLd.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: manhwas.length,
      itemListElement: manhwas.slice(0, 10).map((manhwa, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'ComicSeries',
          name: manhwa.title,
          url: `${SITE_URL}/manhwa/${manhwa.slug}`,
          image: manhwa.coverUrl || manhwa.cover,
        },
      })),
    }
  }

  return jsonLd
}

// ============================================================================
// ITEMLIST SCHEMA PARA RANKINGS Y LISTAS
// ============================================================================
export function generateItemListJsonLd(title, items = [], listType = 'ranking') {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    description: `Lista de ${title.toLowerCase()} en ${SITE_NAME}`,
    numberOfItems: items.length,
    itemListOrder: listType === 'ranking' ? 'https://schema.org/ItemListOrderDescending' : 'https://schema.org/ItemListUnordered',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'ComicSeries',
        name: item.title,
        url: `${SITE_URL}/manhwa/${item.slug}`,
        ...(item.coverUrl || item.cover ? { image: item.coverUrl || item.cover } : {}),
      },
    })),
  }
}

// ============================================================================
// WEBPAGE SCHEMA PARA PÁGINAS ESTÁTICAS
// ============================================================================
export function generateWebPageJsonLd(pageType, title, description, url) {
  return {
    '@context': 'https://schema.org',
    '@type': pageType,
    name: title,
    description: description,
    url: `${SITE_URL}${url}`,
    inLanguage: 'es',
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
  }
}
