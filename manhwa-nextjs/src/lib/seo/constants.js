/**
 * ============================================================================
 * CONSTANTES SEO - Manhwa Imperial
 * ============================================================================
 * 
 * Este archivo centraliza todas las keywords, configuraciones y textos SEO
 * para mantener consistencia en todo el sitio y facilitar la optimización.
 * 
 * KEYWORDS OBJETIVO (orden de prioridad):
 * 1. manhwa
 * 2. leer manhwa
 * 3. manhwa en español
 * 4. manhwa online
 * 5. manhwa gratis
 * 6. mejores manhwas
 * 7. manhwa de romance
 * 8. manhwa de acción
 * 9. manhwa web
 * 10. webtoon español
 */

import { SITE_URL, SITE_NAME } from '@/config'

// ============================================================================
// KEYWORDS GLOBALES DE ALTA PRIORIDAD
// Estas keywords deben aparecer en todas las páginas de forma natural
// ============================================================================
export const GLOBAL_KEYWORDS = [
  // Prioridad Máxima (1-5)
  'manhwa',
  'leer manhwa',
  'manhwa en español',
  'manhwa online',
  'manhwa gratis',
  // Prioridad Alta (6-10)
  'mejores manhwas',
  'manhwa de romance',
  'manhwa de acción',
  'manhwa web',
  'webtoon español',
  // Palabras clave complementarias
  'leer manhwa online',
  'biblioteca de manhwas',
  'manhwa completo',
  'comics coreanos',
  'webtoon gratis',
  'manhwa traducido',
  'manhwas nuevos',
  'manhwa actualizado',
]

// ============================================================================
// KEYWORDS POR TIPO DE PÁGINA
// ============================================================================
export const PAGE_KEYWORDS = {
  home: [
    'manhwa',
    'leer manhwa',
    'manhwa en español',
    'manhwa online',
    'manhwa gratis',
    'webtoon español',
    'leer manhwa online',
    'biblioteca de manhwas',
    'manhwa web',
    'mejores manhwas',
    'comics coreanos en español',
    'manhwa actualizados',
    'manhwas nuevos',
    'leer webtoon gratis',
    'manhwa completo',
  ],
  
  biblioteca: [
    'biblioteca manhwa',
    'catálogo manhwa',
    'buscar manhwa',
    'manhwa por género',
    'lista de manhwas',
    'manhwa español completo',
    'todos los manhwas',
    'colección de manhwas',
    'manhwa online gratis',
    'leer manhwa gratis',
  ],
  
  populares: [
    'manhwa populares',
    'top manhwa',
    'ranking manhwa',
    'mejores manhwas',
    'manhwa trending',
    'manhwa recomendados',
    'manhwa más leídos',
    'manhwa famosos',
    'manhwa español populares',
    'top webtoon español',
  ],

  blog: [
    'blog manhwa',
    'sitios para leer manhwa en español',
    'tapas webtoon en español',
    'real manga manhwa en español',
    'diferencias manga manhwa',
    'mejores plataformas manhwa',
    'guía manhwa principiantes',
    'manhwa recomendados en español',
    'donde leer manhwa gratis',
    'webtoon español comparativa',
  ],
}

// ============================================================================
// KEYWORDS POR GÉNERO
// Mapeo de géneros a keywords SEO optimizadas
// ============================================================================
export const GENRE_SEO = {
  'accion': {
    title: 'Manhwa de Acción',
    keywords: ['manhwa de acción', 'manhwa accion español', 'mejores manhwas de acción', 'leer manhwa acción', 'manhwa peleas', 'manhwa combates', 'webtoon acción español'],
    description: 'acción, peleas épicas y combates intensos',
  },
  'acción': {
    title: 'Manhwa de Acción',
    keywords: ['manhwa de acción', 'manhwa accion español', 'mejores manhwas de acción', 'leer manhwa acción', 'manhwa peleas', 'manhwa combates', 'webtoon acción español'],
    description: 'acción, peleas épicas y combates intensos',
  },
  'romance': {
    title: 'Manhwa de Romance',
    keywords: ['manhwa de romance', 'manhwa romance español', 'mejores manhwas de romance', 'leer manhwa romance', 'manhwa amor', 'manhwa romántico', 'webtoon romance español'],
    description: 'romance, amor y relaciones',
  },
  'fantasia': {
    title: 'Manhwa de Fantasía',
    keywords: ['manhwa de fantasía', 'manhwa fantasia español', 'mejores manhwas de fantasía', 'leer manhwa fantasía', 'manhwa magia', 'manhwa isekai', 'webtoon fantasía español'],
    description: 'fantasía, magia y mundos extraordinarios',
  },
  'fantasía': {
    title: 'Manhwa de Fantasía',
    keywords: ['manhwa de fantasía', 'manhwa fantasia español', 'mejores manhwas de fantasía', 'leer manhwa fantasía', 'manhwa magia', 'manhwa isekai', 'webtoon fantasía español'],
    description: 'fantasía, magia y mundos extraordinarios',
  },
  'drama': {
    title: 'Manhwa de Drama',
    keywords: ['manhwa de drama', 'manhwa drama español', 'mejores manhwas de drama', 'leer manhwa drama', 'manhwa emocional', 'webtoon drama español'],
    description: 'drama, emociones intensas e historias conmovedoras',
  },
  'comedia': {
    title: 'Manhwa de Comedia',
    keywords: ['manhwa de comedia', 'manhwa comedia español', 'mejores manhwas de comedia', 'leer manhwa comedia', 'manhwa divertido', 'manhwa gracioso', 'webtoon comedia español'],
    description: 'comedia, humor y situaciones divertidas',
  },
  'escolar': {
    title: 'Manhwa Escolar',
    keywords: ['manhwa escolar', 'manhwa escuela español', 'mejores manhwas escolar', 'leer manhwa escolar', 'manhwa instituto', 'manhwa estudiantes', 'webtoon escolar español'],
    description: 'historias escolares, vida estudiantil y juventud',
  },
  'artes marciales': {
    title: 'Manhwa de Artes Marciales',
    keywords: ['manhwa artes marciales', 'manhwa murim español', 'mejores manhwas murim', 'leer manhwa artes marciales', 'manhwa cultivación', 'manhwa wuxia', 'webtoon murim español'],
    description: 'artes marciales, murim y cultivación',
  },
  'terror': {
    title: 'Manhwa de Terror',
    keywords: ['manhwa de terror', 'manhwa terror español', 'mejores manhwas de terror', 'leer manhwa terror', 'manhwa horror', 'manhwa miedo', 'webtoon terror español'],
    description: 'terror, horror y suspenso',
  },
  'ciencia ficción': {
    title: 'Manhwa de Ciencia Ficción',
    keywords: ['manhwa ciencia ficción', 'manhwa sci-fi español', 'mejores manhwas ciencia ficción', 'leer manhwa sci-fi', 'manhwa futuro', 'webtoon ciencia ficción español'],
    description: 'ciencia ficción, tecnología y futurismo',
  },
  'aventura': {
    title: 'Manhwa de Aventura',
    keywords: ['manhwa de aventura', 'manhwa aventura español', 'mejores manhwas de aventura', 'leer manhwa aventura', 'manhwa exploración', 'webtoon aventura español'],
    description: 'aventura, exploración y viajes épicos',
  },
  'supernatural': {
    title: 'Manhwa Supernatural',
    keywords: ['manhwa supernatural', 'manhwa sobrenatural español', 'mejores manhwas supernatural', 'leer manhwa supernatural', 'manhwa espíritus', 'manhwa demonios', 'webtoon supernatural español'],
    description: 'elementos sobrenaturales, espíritus y demonios',
  },
  'misterio': {
    title: 'Manhwa de Misterio',
    keywords: ['manhwa de misterio', 'manhwa misterio español', 'mejores manhwas de misterio', 'leer manhwa misterio', 'manhwa detective', 'webtoon misterio español'],
    description: 'misterio, investigación y enigmas',
  },
  'historico': {
    title: 'Manhwa Histórico',
    keywords: ['manhwa histórico', 'manhwa historico español', 'mejores manhwas históricos', 'leer manhwa histórico', 'manhwa época', 'webtoon histórico español'],
    description: 'ambientación histórica y épocas pasadas',
  },
  'histórico': {
    title: 'Manhwa Histórico',
    keywords: ['manhwa histórico', 'manhwa historico español', 'mejores manhwas históricos', 'leer manhwa histórico', 'manhwa época', 'webtoon histórico español'],
    description: 'ambientación histórica y épocas pasadas',
  },
  'venganza': {
    title: 'Manhwa de Venganza',
    keywords: ['manhwa de venganza', 'manhwa venganza español', 'mejores manhwas de venganza', 'leer manhwa venganza', 'manhwa revancha', 'webtoon venganza español'],
    description: 'venganza, revancha y justicia',
  },
  'isekai': {
    title: 'Manhwa Isekai',
    keywords: ['manhwa isekai', 'manhwa isekai español', 'mejores manhwas isekai', 'leer manhwa isekai', 'manhwa otro mundo', 'manhwa reencarnación', 'webtoon isekai español'],
    description: 'isekai, reencarnación y otros mundos',
  },
  'sistema': {
    title: 'Manhwa con Sistema',
    keywords: ['manhwa con sistema', 'manhwa sistema español', 'mejores manhwas con sistema', 'leer manhwa sistema', 'manhwa leveling', 'manhwa game', 'webtoon sistema español'],
    description: 'sistemas de juego, leveling y poderes',
  },
}

// ============================================================================
// TEXTOS SEO REUTILIZABLES
// Contenido visible optimizado para SEO
// ============================================================================
export const SEO_CONTENT = {
  home: {
    h1: 'Leer Manhwa en Español Online Gratis',
    introText: `Bienvenido a ${SITE_NAME}, tu biblioteca definitiva para leer manhwa en español gratis. Somos el mejor sitio para disfrutar de manhwas, webtoons y comics coreanos traducidos profesionalmente. Actualizamos diariamente con los últimos capítulos de tus series favoritas.`,
    whatIsManhwa: {
      title: '¿Qué es un Manhwa?',
      text: 'Un manhwa es un cómic o novela gráfica originaria de Corea del Sur. A diferencia del manga japonés, los manhwas se leen de izquierda a derecha y suelen publicarse a todo color. En Manhwa Imperial encontrarás los mejores manhwas traducidos al español, incluyendo géneros como romance, acción, fantasía, drama y más. Nuestra biblioteca de manhwas se actualiza constantemente con nuevos títulos y capítulos.',
    },
    sections: {
      latest: 'Últimos Manhwas Actualizados',
      popular: 'Manhwas Populares en Español',
      genres: 'Explora Manhwas por Género',
      collection: 'Colección de Manhwas',
    },
  },
  
  manhwaDetail: {
    getH1: (title) => title, // El título es el H1
    getInfoSection: (title) => `Información del Manhwa ${title}`,
    getSynopsisTitle: (title) => `Sinopsis de ${title} Manhwa`,
    getChaptersTitle: (title) => `Capítulos de ${title} - Leer Manhwa Online`,
    getSimilarTitle: (title) => `Manhwas Similares a ${title}`,
    getFaqTitle: (title) => `Preguntas Frecuentes sobre ${title}`,
    getIntroText: (title, genres = [], chapterCount = 0) => {
      const genreText = genres.length > 0 
        ? `Es un manhwa de ${genres.slice(0, 2).join(' y ')}.` 
        : ''
      return `Lee ${title} manhwa completo en español gratis. ${genreText} ${chapterCount > 0 ? `Tiene ${chapterCount} capítulos disponibles para leer online.` : ''} Disfruta de este manhwa en ${SITE_NAME} con la mejor calidad de imagen.`
    },
  },
  
  chapter: {
    getH1: (title, num) => `${title} Capítulo ${num}`,
    getContinueReading: (title) => `Continuar leyendo ${title}`,
    getDescription: (title, num) => `Leer ${title} Capítulo ${num} online gratis en español. Navega fácilmente entre capítulos y disfruta de la mejor calidad de lectura de manhwa.`,
  },
  
  genre: {
    getH1: (genre) => `Manhwa de ${genre} en Español`,
    getWhatIs: (genre) => `¿Qué es un Manhwa de ${genre}?`,
    getAllGenre: (genre) => `Todos los Manhwas de ${genre}`,
    getDescription: (genre, genreDesc = '') => `Los mejores manhwas de ${genre} para leer gratis en español. Encuentra manhwas de ${genreDesc || genre} actualizados diariamente. Tu biblioteca de manhwas de ${genre} en ${SITE_NAME}.`,
    getWhatIsText: (genre, genreDesc = '') => `Los manhwas de ${genre} se caracterizan por sus historias llenas de ${genreDesc || genre}. Este género es uno de los más populares entre los lectores de manhwa en español. En ${SITE_NAME} encontrarás una amplia selección de manhwas de ${genre}, desde los clásicos más queridos hasta los títulos más recientes y trending.`,
  },
  
  biblioteca: {
    h1: 'Biblioteca de Manhwas - Catálogo Completo en Español',
    introText: `Explora nuestra biblioteca completa de manhwas en español. Tenemos miles de manhwas disponibles para leer gratis, organizados por género, estado y popularidad. Usa nuestro buscador para encontrar tu próximo manhwa favorito o navega por categorías.`,
  },
}

// ============================================================================
// TEMPLATE PARA META TAGS
// Funciones generadoras de meta tags optimizados
// ============================================================================
export const META_TEMPLATES = {
  home: {
    title: `Leer Manhwa Online Gratis en Español - ${SITE_NAME}`,
    description: 'Lee manhwa online gratis en español. Miles de manhwas y webtoons coreanos actualizados a diario. Tu biblioteca de manhwas en español favorita.',
    keywords: PAGE_KEYWORDS.home,
  },
  
  manhwa: (series) => {
    const title = series?.title || 'Manhwa'
    const genres = (series?.genres || []).map(g => typeof g === 'string' ? g : g?.name).filter(Boolean)
    const status = series?.status === 'completed' ? 'Completo' : series?.status === 'paused' ? 'Pausado' : 'En emisión'
    const chapterCount = series?.chapters?.length || series?.chapterCount || '?'
    
    return {
      title: `Leer ${title} Manhwa Online Gratis en Español | ${SITE_NAME}`,
      description: `Lee ${title} manhwa completo en español gratis. ${chapterCount} capítulos disponibles. Géneros: ${genres.join(', ') || 'Manhwa'}. Estado: ${status}. El mejor sitio para leer manhwas.`,
      keywords: [
        `leer ${title}`,
        `${title} manhwa`,
        `${title} en español`,
        `${title} online`,
        `${title} gratis`,
        `${title} todos los capitulos`,
        `manhwa ${title}`,
        `donde leer ${title}`,
        ...genres.map(g => `manhwa de ${g.toLowerCase()}`),
        'leer manhwa online',
        'manhwa español',
      ],
    }
  },
  
  chapter: (series, chapterNum) => {
    const title = series?.title || 'Manhwa'
    const genres = (series?.genres || []).map(g => typeof g === 'string' ? g : g?.name).filter(Boolean).slice(0, 2)
    
    return {
      title: `${title} Capítulo ${chapterNum} - Leer Manhwa Online Gratis | ${SITE_NAME}`,
      description: `Lee ${title} Capítulo ${chapterNum} manhwa online gratis en español. ${genres.length > 0 ? `Manhwa de ${genres.join(' y ')}.` : ''} Siguiente capítulo disponible.`,
      keywords: [
        `${title} capítulo ${chapterNum}`,
        `leer ${title} capitulo ${chapterNum}`,
        `${title} manhwa capitulo ${chapterNum}`,
        `manhwa ${title}`,
        'leer manhwa online',
        `${title} cap ${chapterNum}`,
        `${title} ${chapterNum} español`,
      ],
    }
  },
  
  biblioteca: {
    title: `Biblioteca Manhwa Imperial | Lee Manhwas en Español Gratis`,
    description: 'Explora la biblioteca completa de manhwas en español. Filtra por género, busca tus series favoritas y lee manhwa online gratis. ¡Miles de títulos actualizados!',
    keywords: PAGE_KEYWORDS.biblioteca,
  },

  genre: (genre) => {
    const genreLower = genre.toLowerCase()
    const genreData = GENRE_SEO[genreLower] || {}
    
    return {
      title: `Manhwa de ${genre} en Español - Leer Online Gratis | ${SITE_NAME}`,
      description: `Los mejores manhwas de ${genre} para leer gratis en español. Encuentra manhwas de ${genreData.description || genre} actualizados diariamente. Tu biblioteca de manhwas de ${genre}.`,
      keywords: genreData.keywords || [
        `manhwa de ${genreLower}`,
        `manhwa ${genreLower} español`,
        `mejores manhwas de ${genreLower}`,
        `leer manhwa ${genreLower}`,
        `manhwa ${genreLower} online`,
        `manhwa ${genreLower} gratis`,
        `webtoon ${genreLower} español`,
      ],
    }
  },
}

// ============================================================================
// SCHEMA.ORG BASE DATA
// Datos base para generar JSON-LD
// ============================================================================
export const ORGANIZATION_DATA = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/logo.png`,
    width: 512,
    height: 512,
  },
  sameAs: [
    // Agregar redes sociales cuando estén disponibles
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: ['Spanish'],
  },
}

export const WEBSITE_DATA = {
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: META_TEMPLATES.home.description,
  inLanguage: 'es',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/biblioteca?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

// ============================================================================
// HELPERS DE ALT TEXT PARA IMÁGENES
// ============================================================================
export const getImageAlt = {
  cover: (title) => `${title} manhwa - Leer en español`,
  chapterPage: (title, chapterNum, pageNum) => `${title} Capítulo ${chapterNum} - Página ${pageNum}`,
  genreBanner: (genre) => `Manhwas de ${genre} - Leer online`,
}

// ============================================================================
// ANCHOR TEXT OPTIMIZADOS
// ============================================================================
export const getAnchorText = {
  readMore: 'Ver más manhwas',
  title: (title) => `Leer ${title} manhwa`,
  genre: (genre) => `Manhwa de ${genre}`,
  chapter: (title, num) => `Leer ${title} capítulo ${num}`,
  seeAll: 'Ver todos los manhwas',
  fullRanking: 'Ver ranking completo de manhwas',
}
