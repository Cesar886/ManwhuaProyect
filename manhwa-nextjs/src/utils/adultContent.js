export const isTruthyAdultFlag = (value) => (
  value === true || value === 1 || value === '1' || value === 'true'
);

export const isAdultSeries = (series) => {
  if (!series) return false;

  // Check top-level flags
  if (isTruthyAdultFlag(series.isAdult) || isTruthyAdultFlag(series.is_adult)) {
    return true;
  }

  // Check nested flags object (API often returns flags nested)
  if (series.flags && typeof series.flags === 'object') {
    if (isTruthyAdultFlag(series.flags.isAdult) || isTruthyAdultFlag(series.flags.is_adult)) {
      return true;
    }
  }

  const genres = Array.isArray(series.genres) ? series.genres : [];
  const ADULT_GENRES = [
    'adult', 'hentai', 'ecchi', 'smut', 'mature',
    'ntr', 'milf', 'mujer mayor', 'madrastra',
    'madre e hija', 'amigos con derechos', 'relacion secreta',
  ];
  return genres.some((genre) => {
    const name = (typeof genre === 'string' ? genre : genre?.name || '').toLowerCase();
    return ADULT_GENRES.some((ag) => name.includes(ag));
  });
};

export const getChapterCount = (series) => {
  const count = Number(
    series?.chapterCount ??
    series?.chaptersCount ??
    series?.chapters_count ??
    series?.totalChapters ??
    series?.total_chapters ??
    series?.chapter_total ??
    0
  );
  if (Number.isFinite(count) && count > 0) return count;
  if (Array.isArray(series?.chapters)) return series.chapters.length;
  return 0;
};

export const hasAvailableChapters = (series) => getChapterCount(series) > 0;

export const filterNonAdultSeries = (seriesList = []) =>
  seriesList.filter((series) => !isAdultSeries(series));

export const filterAvailableSeries = (seriesList = []) =>
  seriesList.filter((series) => !isAdultSeries(series) && hasAvailableChapters(series));

// ───────────────────────────────────────────────────────────
// Filtrado por idioma (robusto)
// ───────────────────────────────────────────────────────────

export const SUPPORTED_LANGS = ['es', 'en'];
export const DEFAULT_LANG = 'es';

// Aliases comunes → código ISO-639-1. Amplía aquí si el CMS emite otras formas.
const LANG_ALIASES = {
  es: 'es', spa: 'es', esp: 'es', spanish: 'es', español: 'es', espanol: 'es',
  'es-es': 'es', 'es-mx': 'es', 'es-la': 'es', 'es-419': 'es', castellano: 'es',
  en: 'en', eng: 'en', english: 'en', ingles: 'en', inglés: 'en',
  'en-us': 'en', 'en-gb': 'en',
};

/**
 * Normaliza cualquier valor a un código de idioma soportado ('es' | 'en') o null.
 * Acepta strings, arrays, objetos {code}/{lang}, mayúsculas, locales con región.
 */
export const normalizeLangCode = (value) => {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const code = normalizeLangCode(item);
      if (code) return code;
    }
    return null;
  }

  if (typeof value === 'object') {
    return normalizeLangCode(value.code || value.lang || value.language || value.locale || null);
  }

  const raw = String(value).toLowerCase().trim();
  if (!raw) return null;

  if (LANG_ALIASES[raw]) return LANG_ALIASES[raw];

  // Fallback: tomar los primeros 2 chars (maneja 'es-MX', 'en_US', etc.)
  const short = raw.split(/[-_]/)[0].slice(0, 3);
  if (LANG_ALIASES[short]) return LANG_ALIASES[short];

  return null;
};

// WeakMap para memoizar el cálculo de idiomas por serie. Reduce trabajo
// repetido cuando la misma lista pasa por varios filtros/componentes.
const SERIES_LANG_CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

/**
 * Devuelve el/los idiomas de una serie como array de códigos soportados.
 * Revisa campos: language, languages, lang, locale, idioma. Soporta arrays o
 * strings separados por coma. Si nada es detectable, devuelve [] (no asume).
 */
export const getSeriesLanguages = (series) => {
  if (!series || typeof series !== 'object') return [];

  if (SERIES_LANG_CACHE && SERIES_LANG_CACHE.has(series)) {
    return SERIES_LANG_CACHE.get(series);
  }

  const candidates = [
    series.language,
    series.languages,
    series.lang,
    series.locale,
    series.idioma,
  ];

  const found = new Set();

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const code = normalizeLangCode(item);
        if (code) found.add(code);
      }
      continue;
    }

    if (typeof candidate === 'string' && candidate.includes(',')) {
      for (const part of candidate.split(',')) {
        const code = normalizeLangCode(part);
        if (code) found.add(code);
      }
      continue;
    }

    const code = normalizeLangCode(candidate);
    if (code) found.add(code);
  }

  const result = Array.from(found);
  if (SERIES_LANG_CACHE) SERIES_LANG_CACHE.set(series, result);
  return result;
};

/**
 * ¿La serie coincide con el idioma pedido?
 * - Si la serie declara idiomas, debe incluir `target`.
 * - Si NO declara idiomas (legacy), se considera que coincide con DEFAULT_LANG
 *   (para no vaciar la biblioteca antes de migrar todo el catálogo).
 *
 * Controlable vía opciones:
 *   { strict: true }       → legacy sin idioma queda FUERA (útil en producción tras migrar).
 *   { legacyLang: 'en' }   → cambia a qué idioma se asignan los legacy.
 */
export const matchesLanguage = (series, lang = DEFAULT_LANG, options = {}) => {
  const { strict = false, legacyLang = DEFAULT_LANG } = options;
  const target = normalizeLangCode(lang) || DEFAULT_LANG;

  const langs = getSeriesLanguages(series);
  if (langs.length === 0) {
    if (strict) return false;
    return (normalizeLangCode(legacyLang) || DEFAULT_LANG) === target;
  }
  return langs.includes(target);
};

/**
 * Filtra series por idioma. La URL determina el idioma:
 *   /en/...   → solo series con language === 'en'
 *   / (es)    → solo series con language === 'es'
 *
 * Acepta las mismas `options` que matchesLanguage().
 */
export const filterByLanguage = (seriesList = [], lang = DEFAULT_LANG, options = {}) => {
  if (!Array.isArray(seriesList)) return [];
  return seriesList.filter((series) => matchesLanguage(series, lang, options));
};

/**
 * Compuesto: filtro de disponibilidad (no-adulto + con capítulos) + filtro por idioma.
 * Usar este en páginas públicas donde la URL implica un idioma.
 */
export const filterAvailableSeriesForLang = (seriesList = [], lang = DEFAULT_LANG, options = {}) =>
  filterByLanguage(filterAvailableSeries(seriesList), lang, options);
