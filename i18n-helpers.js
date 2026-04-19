// Helpers de idioma puros y sin estado. Extraídos de server.js para poder
// testearlos en aislamiento (tests/i18n.test.js) y para que cualquier otro
// módulo del proyecto (query-rewriter, workers, migraciones) los reuse sin
// cargar toda la lógica HTTP.

const SUPPORTED_LANGS = Object.freeze(['es', 'en']);
const DEFAULT_LANG = 'es';

// Normaliza el idioma. Solo acepta valores de SUPPORTED_LANGS; cualquier otra
// cosa → default. Tolera prefijos tipo "en-US", "es_MX", "es-419", espacios y
// mayúsculas.
function normalizeLang(value) {
    if (value == null) return DEFAULT_LANG;
    let raw;
    try { raw = String(value).toLowerCase().trim(); }
    catch { return DEFAULT_LANG; }
    if (!raw) return DEFAULT_LANG;
    const primary = raw.split(/[-_;,\s]/)[0];
    return SUPPORTED_LANGS.includes(primary) ? primary : DEFAULT_LANG;
}

// Heurística ligera para detectar idioma por contenido. Devuelve 'es', 'en' o
// null si no es claro. Solo detecta señales MUY obvias (palabras funcionales
// exclusivas de un idioma).
const EN_SIGNAL_RE = /\b(the|with|about|looking|recommend|where|similar to|reincarnat|revenge|system|hunter|tower|dungeon|female|male lead|want|need|please|find me|isekai)\b/i;
const ES_SIGNAL_RE = /\b(el|la|los|las|con|sobre|buscando|recomienda|donde|similar a|reencarna|venganza|sistema|cazador|torre|mazmorra|chica|protagonista|quiero|necesito|por favor|busca|enseñ|parecid)\b/i;

function inferLangFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.toLowerCase();
    const en = EN_SIGNAL_RE.test(t);
    const es = ES_SIGNAL_RE.test(t);
    if (en && !es) return 'en';
    if (es && !en) return 'es';
    return null;
}

module.exports = {
    SUPPORTED_LANGS,
    DEFAULT_LANG,
    normalizeLang,
    inferLangFromText,
    EN_SIGNAL_RE,
    ES_SIGNAL_RE,
};
