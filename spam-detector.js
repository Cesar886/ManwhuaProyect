// Detector de queries sospechosas (bot / gibberish) para proteger la calidad
// del historial de /api/popular y métricas derivadas.
//
// No bloquea al usuario: las queries sospechosas siguen recibiendo respuesta
// (no queremos alertar al bot). Pero se marcan `suspicious: true` al grabarlas
// y los endpoints de popularidad las filtran.
//
// Dos señales independientes:
//   1. IP rate: >N requests en ventana corta desde la misma IP.
//   2. Gibberish léxico: la query falla validación básica de idioma humano.
//
// express-rate-limit ya bloquea picos agresivos a nivel HTTP; este módulo
// detecta bots que se quedan JUSTO por debajo del umbral.

// ---------------------------- Gibberish léxico -----------------------------

// Vocales (incluye acentos y 'y' como semi-vocal en ES/EN).
const VOWEL_RE = /[aeiouyáéíóúü]/i;
const LETTER_RE = /[a-záéíóúñü]/i;
const ALNUM_RE = /[a-z0-9áéíóúñü]/i;

// Umbral estricto: solo marcar gibberish OBVIO. Falsos positivos cuestan más
// que falsos negativos (un usuario real no debería ser clasificado como bot).
function isGibberishQuery(text) {
    if (text == null) return true;
    if (typeof text !== 'string') return true;

    const raw = text.trim();
    if (raw.length === 0) return true;

    // Queries muy largas (> 500 chars) son sospechosas: nadie escribe eso a mano.
    if (raw.length > 500) return true;

    // Sin ningún carácter alfanumérico (solo símbolos/emojis mashing).
    if (!ALNUM_RE.test(raw)) return true;

    const lower = raw.toLowerCase();
    const letters = lower.replace(/[^a-záéíóúñü]/gi, '');

    // Símbolos dominantes (>50% del texto son no-letra/no-dígito/no-espacio).
    // Aplicado antes del short-circuit de longitud para que "a!@#$%^&*()b"
    // no se cuele por tener <4 letras.
    const nonAlnum = raw.replace(/\s/g, '').replace(/[a-záéíóúñü0-9]/gi, '').length;
    const netLen = raw.replace(/\s/g, '').length;
    if (netLen > 0 && nonAlnum / netLen > 0.5) return true;

    // Permitir queries cortas (≤ 3 letras): "op", "mc", "bl" son legítimas.
    // Solo aplicamos heurísticas de gibberish cuando hay ≥ 4 letras.
    if (letters.length < 4) {
        // Si NO hay letras y solo hay dígitos/símbolos, es sospechoso.
        return letters.length === 0 && lower.length > 3;
    }

    // (a) Todas las letras iguales: "aaaaaaaa", "nnnnn".
    if (/^(.)\1+$/.test(letters)) return true;

    // (b) Sin vocales en una cadena de letras larga (≥ 5).
    //     "bcdfgh" → sospechoso. "op" → OK (ya filtrado arriba por longitud).
    if (letters.length >= 5 && !VOWEL_RE.test(letters)) return true;

    // (c) Secuencia larga de consonantes seguidas (> 6).
    //     Palabras reales raras veces tienen >5 consonantes seguidas.
    if (/[bcdfghjklmnñpqrstvwxz]{7,}/i.test(letters)) return true;

    // (d) Patrón repetido: el mismo 2-3 gram cubre >80% de la cadena de letras.
    //     "asdfasdfasdf" → sospechoso. "jajajaja" también (aceptable colateral).
    if (letters.length >= 8) {
        for (const n of [2, 3, 4]) {
            const chunk = letters.slice(0, n);
            if (!chunk) continue;
            const repeated = chunk.repeat(Math.ceil(letters.length / n)).slice(0, letters.length);
            // Comparación tolerante: permite 1 char de diferencia cada n*2.
            let diffs = 0;
            for (let i = 0; i < letters.length; i++) {
                if (letters[i] !== repeated[i]) diffs++;
            }
            if (diffs <= Math.floor(letters.length * 0.1)) return true;
        }
    }

    // (e) La proporción de no-letras ya se evaluó arriba.
    return false;
}

// -------------------------- IP rate sliding window --------------------------

// Mantiene por IP los timestamps de las últimas N requests. Si la ventana
// densa (últimas N) cabe en < thresholdMs, se considera tráfico bot.
//
// Diseño: un ring buffer de longitud MAX_SAMPLES por IP (no un array creciente)
// para acotar memoria. El LRU global limita el número de IPs rastreadas.

class SpamTracker {
    constructor(options = {}) {
        this.maxIPs = options.maxIPs || 10000;
        this.maxSamples = options.maxSamples || 30;      // requests por ventana
        this.windowMs = options.windowMs || 10_000;      // 10 seg por defecto
        this.now = options.now || (() => Date.now());
        this._ips = new Map(); // ip → { samples: number[] (ring), idx: number, lastTs: number }
    }

    _evictIfFull() {
        if (this._ips.size <= this.maxIPs) return;
        // LRU approximado: borrar la IP con lastTs más antiguo.
        // Aceptable: O(n) peor caso, solo corre cuando saturamos el mapa.
        let oldestKey = null;
        let oldestTs = Infinity;
        for (const [ip, entry] of this._ips) {
            if (entry.lastTs < oldestTs) {
                oldestTs = entry.lastTs;
                oldestKey = ip;
            }
        }
        if (oldestKey != null) this._ips.delete(oldestKey);
    }

    // Registra un hit. Devuelve true si el IP parece bot por rate.
    track(ip) {
        if (!ip || typeof ip !== 'string') return false;
        const now = this.now();

        let entry = this._ips.get(ip);
        if (!entry) {
            entry = {
                samples: new Array(this.maxSamples).fill(0),
                idx: 0,
                filled: 0,
                lastTs: now
            };
            this._ips.set(ip, entry);
            this._evictIfFull();
        }

        entry.samples[entry.idx] = now;
        entry.idx = (entry.idx + 1) % this.maxSamples;
        entry.filled = Math.min(entry.filled + 1, this.maxSamples);
        entry.lastTs = now;

        // Solo podemos juzgar "burst" si ya tenemos MAX_SAMPLES hits grabados.
        if (entry.filled < this.maxSamples) return false;

        // El timestamp más antiguo en el ring es entry.samples[entry.idx]
        // (porque idx apunta al próximo slot a sobrescribir).
        const oldest = entry.samples[entry.idx];
        const span = now - oldest;
        return span <= this.windowMs;
    }

    // Solo consulta (no modifica estado): ¿esta IP está actualmente en burst?
    isSuspicious(ip) {
        if (!ip) return false;
        const entry = this._ips.get(ip);
        if (!entry || entry.filled < this.maxSamples) return false;
        const oldest = entry.samples[entry.idx];
        return (this.now() - oldest) <= this.windowMs;
    }

    reset(ip) {
        if (ip) this._ips.delete(ip);
        else this._ips.clear();
    }

    size() { return this._ips.size; }
}

// ------------------------------- Combinado ----------------------------------

// Extrae IP del req de Express. Respeta X-Forwarded-For si trust proxy está OK.
function extractIp(req) {
    if (!req) return null;
    try {
        if (typeof req.ip === 'string' && req.ip) return req.ip;
        const xff = req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
        if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
        if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
        if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
    } catch { /* ignore */ }
    return null;
}

module.exports = {
    SpamTracker,
    isGibberishQuery,
    extractIp,
};
