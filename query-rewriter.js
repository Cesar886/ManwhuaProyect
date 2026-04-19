const { QUERY_EXPANSIONS } = require('./query-expansions');

let logger = {
    info: (msg, data) => console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg, data: data || null })),
    warn: (msg, data) => console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg, data: data || null }))
};

function setLogger(l) {
    if (l) logger = l;
}

const CONCEPT_KEYS = Object.keys(QUERY_EXPANSIONS || {}).filter(k => !k.includes(' '));
const CONCEPT_KEY_SET = new Set(CONCEPT_KEYS);

// Palabras de relleno que nunca deben ser "corregidas" a un título ni a un
// concepto: son genéricas y casi siempre aparecen sin ser parte del tema real.
const REWRITE_STOP_WORDS = new Set([
    'similar', 'similars', 'like', 'the', 'and', 'for', 'with', 'about',
    'recommend', 'find', 'read', 'please', 'something', 'anything',
    'manhwa', 'manhwas', 'manga', 'mangas', 'manhua', 'manhuas', 'webtoon', 'webtoons',
    'parecido', 'parecidos', 'parecida', 'parecidas', 'como', 'similares',
    'recomienda', 'recomiendame', 'recomendacion', 'recomendaciones',
    'algo', 'algun', 'alguna', 'sobre', 'que', 'para', 'con', 'los', 'las',
    'una', 'uno', 'del', 'este', 'esta', 'estos', 'estas', 'donde', 'puedo', 'leer'
]);

function normalize(text) {
    return (text || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Levenshtein clásico con matriz 1D para ahorrar memoria. Corte temprano cuando
// cualquier fila mínima supera `maxDist` evita calcular pares irrelevantes.
function levenshtein(a, b, maxDist = Infinity) {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > maxDist) return maxDist + 1;
    if (la === 0) return lb;
    if (lb === 0) return la;

    let prev = new Array(lb + 1);
    let curr = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= lb; j++) {
            const cost = (ca === b.charCodeAt(j - 1)) ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost
            );
            if (curr[j] < rowMin) rowMin = curr[j];
        }
        if (rowMin > maxDist) return maxDist + 1;
        [prev, curr] = [curr, prev];
    }
    return prev[lb];
}

// Umbral de distancia por longitud del token. Para tokens cortos (4-5 chars) solo
// aceptamos 1 edición; a partir de 6 permitimos 2. Nunca corregimos tokens muy
// cortos (≤3): "sol" → "solo" sería una corrección peligrosa.
function maxConceptDist(tokenLen) {
    if (tokenLen < 4) return 0;
    if (tokenLen <= 5) return 1;
    return 2;
}

function fixConceptTypos(tokens) {
    const corrections = [];
    const out = tokens.slice();

    for (let i = 0; i < out.length; i++) {
        const t = out[i];
        if (!t || t.length < 4) continue;
        if (REWRITE_STOP_WORDS.has(t)) continue;
        if (CONCEPT_KEY_SET.has(t)) continue; // ya es una key válida

        const limit = maxConceptDist(t.length);
        if (limit === 0) continue;

        let bestKey = null;
        let bestDist = limit + 1;
        let tie = false;

        for (const key of CONCEPT_KEYS) {
            if (Math.abs(key.length - t.length) > limit) continue;
            const d = levenshtein(t, key, limit);
            if (d > limit) continue;
            if (d < bestDist) {
                bestDist = d;
                bestKey = key;
                tie = false;
            } else if (d === bestDist && key !== bestKey) {
                tie = true;
            }
        }

        // Rechazar empates: si dos keys están igual de cerca, no hay ganador
        // claro ("mago" vs "magi" si ambos existieran). Preferimos no tocar.
        if (!bestKey || tie) continue;

        // Distancia 2 exige longitud suficiente (≥6) para evitar reemplazar
        // palabras ambiguas que casualmente están a 2 ediciones de un concepto.
        if (bestDist === 2 && t.length < 6) continue;

        out[i] = bestKey;
        corrections.push({ from: t, to: bestKey, kind: 'concept', dist: bestDist });
    }

    return { tokens: out, corrections };
}

// --- Corrección de títulos ---

// Distancia máxima aceptada para que un n-grama se considere "typo" de un título.
// Escala con la longitud para que títulos largos admitan más edits absolutos
// sin que títulos cortos acepten matches débiles.
function maxTitleDist(titleLen) {
    if (titleLen < 5) return 0;
    if (titleLen < 8) return 1;
    if (titleLen < 12) return 2;
    return Math.min(3, Math.floor(titleLen * 0.2));
}

function fixTitleTypos(queryText, normTokens, seriesCache) {
    if (!Array.isArray(seriesCache) || seriesCache.length === 0) {
        return { text: queryText, correction: null };
    }

    // Buscamos el mejor match entre n-gramas de 1-4 tokens y los títulos del
    // catálogo. El n-grama completo se compara con el título limpio completo:
    // es una corrección de typo, no una búsqueda por subcadena.
    let best = null; // { ngram, ngramStart, ngramEnd, series, dist, normDist }

    const maxN = Math.min(4, normTokens.length);
    for (let n = maxN; n >= 1; n--) {
        for (let i = 0; i + n <= normTokens.length; i++) {
            const slice = normTokens.slice(i, i + n);

            // N-gramas que son puro relleno no deben disparar correcciones.
            if (slice.every(tok => REWRITE_STOP_WORDS.has(tok))) continue;

            const ngram = slice.join(' ');
            if (ngram.length < 4) continue;

            for (const s of seriesCache) {
                const title = s._searchTitle;
                if (!title || title.length < 4) continue;
                if (title === ngram) {
                    // Ya es exacto — no es typo.
                    return { text: queryText, correction: null };
                }

                const limit = maxTitleDist(title.length);
                if (limit === 0) continue;
                if (Math.abs(title.length - ngram.length) > limit) continue;

                const d = levenshtein(ngram, title, limit);
                if (d > limit) continue;

                // Descartar correcciones triviales tipo "solo" → "solo leveling"
                // (la distancia puede ser baja por prefijo, pero cambian la
                // intención). Exigimos que ngram y título tengan tamaños
                // razonablemente parecidos.
                const ratio = ngram.length / title.length;
                if (ratio < 0.7 || ratio > 1.35) continue;

                const normDist = d / Math.max(title.length, ngram.length);
                if (!best || normDist < best.normDist ||
                    (normDist === best.normDist && title.length > best.series._searchTitle.length)) {
                    best = {
                        ngram,
                        ngramStart: i,
                        ngramEnd: i + n,
                        series: s,
                        dist: d,
                        normDist
                    };
                }
            }
        }
        if (best) break; // preferimos el n-grama más largo que coincidió
    }

    if (!best) return { text: queryText, correction: null };

    // Reemplazar el n-grama (en espacio normalizado) dentro del texto original.
    // Estrategia segura: reconstruimos el texto uniendo tokens ORIGINALES fuera
    // del rango y sustituyendo el rango con el título display de la serie.
    const originalTokens = queryText.trim().split(/\s+/);
    if (originalTokens.length !== normTokens.length) {
        // Desalineación inesperada: no arriesgamos a mutilar la query.
        return { text: queryText, correction: null };
    }

    const titleDisplay = best.series.title || best.series._searchTitle;
    const newTokens = [
        ...originalTokens.slice(0, best.ngramStart),
        titleDisplay,
        ...originalTokens.slice(best.ngramEnd)
    ];

    return {
        text: newTokens.join(' '),
        correction: {
            from: best.ngram,
            to: titleDisplay,
            kind: 'title',
            dist: best.dist,
            seriesId: best.series.id
        }
    };
}

/**
 * Reescribe la query del usuario corrigiendo typos antes de alimentarla al
 * motor de búsqueda. Dos capas independientes:
 *   1. Conceptos: tokens con edición ≤ 1-2 frente a keys de QUERY_EXPANSIONS
 *      ("nicromante" → "nigromante").
 *   2. Títulos: n-gramas con edición pequeña frente a títulos del catálogo
 *      ("solo levling" → "Solo Leveling").
 *
 * Si no hay correcciones confiables, devuelve el texto original sin cambios.
 * El campo `text` es seguro para usar como input de búsqueda; `original` se
 * mantiene para responder al usuario en sus propias palabras.
 */
function rewriteQuery(userMsg, options = {}) {
    const original = (userMsg || '').toString();
    if (!original.trim()) {
        return { text: original, original, corrections: [], changed: false };
    }

    const seriesCache = Array.isArray(options.seriesCache) ? options.seriesCache : [];

    const norm = normalize(original);
    const normTokens = norm.split(' ').filter(Boolean);
    if (normTokens.length === 0) {
        return { text: original, original, corrections: [], changed: false };
    }

    const corrections = [];

    // Capa 1: conceptos. Aplicamos primero porque es rápido y baja ambigüedad.
    const concept = fixConceptTypos(normTokens);
    if (concept.corrections.length > 0) {
        corrections.push(...concept.corrections);
    }

    // Reconstruimos el texto con los tokens corregidos (conservando el resto
    // tal cual). Para mantener el casing del usuario cuando no hubo corrección,
    // operamos sobre los tokens originales y sólo sustituimos los índices
    // efectivamente reemplazados.
    const originalTokens = original.trim().split(/\s+/);
    let conceptText = original;
    if (concept.corrections.length > 0 && originalTokens.length === normTokens.length) {
        const mixed = originalTokens.slice();
        for (let i = 0; i < normTokens.length; i++) {
            if (concept.tokens[i] !== normTokens[i]) {
                mixed[i] = concept.tokens[i];
            }
        }
        conceptText = mixed.join(' ');
    }

    // Capa 2: títulos. Re-normalizamos el texto ya corregido por conceptos.
    const normAfterConcept = normalize(conceptText).split(' ').filter(Boolean);
    const titleResult = fixTitleTypos(conceptText, normAfterConcept, seriesCache);
    if (titleResult.correction) {
        corrections.push(titleResult.correction);
    }

    const finalText = titleResult.text;
    const changed = finalText !== original;

    if (changed) {
        logger.info('Query reescrita', {
            original,
            rewritten: finalText,
            corrections
        });
    }

    return {
        text: finalText,
        original,
        corrections,
        changed
    };
}

module.exports = {
    rewriteQuery,
    levenshtein,
    setLogger
};
