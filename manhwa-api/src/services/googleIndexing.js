/**
 * Google Indexing API Service
 * Notifica a Google cuando se publican nuevas URLs para indexacion rapida.
 *
 * Usa google-auth-library (ya instalado) en lugar de googleapis (pesado).
 */

const { GoogleAuth } = require('google-auth-library');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

const CREDENTIALS_PATH = path.join(__dirname, '..', 'config', 'google-indexing-credentials.json');
const HISTORY_PATH = path.join(__dirname, '..', '..', 'data', 'indexing-history.json');
const SITEMAP_URL = 'https://manhwaimperial.site/sitemap-chapters-1.xml';
const SITE_BASE = 'https://manhwaimperial.site';

const DAEMON_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas
const BATCH_SIZE = 20;
const BATCH_DELAY = 1000; // 1s entre requests del batch
const QUOTA_PAUSE_MS = 24 * 60 * 60 * 1000; // 24h pausa por quota exceeded
const MAX_RETRIES = 3;
const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

let daemonTimer = null;
let initialDelayTimer = null;
let quotaPausedUntil = null;
let credentialsExist = null; // cache del check de credenciales

// ============================================
// HISTORIAL DE INDEXACION (en memoria + disco)
// ============================================

let historyCache = null;

function loadHistory() {
    if (historyCache) return historyCache;

    try {
        if (fs.existsSync(HISTORY_PATH)) {
            historyCache = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
            // Validar estructura
            if (!historyCache.indexedUrls || typeof historyCache.indexedUrls !== 'object') {
                historyCache = { indexedUrls: {}, lastDaemonRun: null };
            }
            return historyCache;
        }
    } catch (err) {
        logger.error('[GoogleIndexing] Error leyendo historial:', err.message);
    }
    historyCache = { indexedUrls: {}, lastDaemonRun: null };
    return historyCache;
}

function saveHistory() {
    if (!historyCache) return;
    try {
        const dir = path.dirname(HISTORY_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Escribir a archivo temporal y renombrar para evitar corrupcion
        const tmpPath = HISTORY_PATH + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(historyCache, null, 2), 'utf-8');
        fs.renameSync(tmpPath, HISTORY_PATH);
    } catch (err) {
        logger.error('[GoogleIndexing] Error guardando historial:', err.message);
    }
}

function markUrlIndexed(url) {
    const history = loadHistory();
    history.indexedUrls[url] = {
        indexedAt: new Date().toISOString(),
        status: 'success'
    };
    // No guardar a disco en cada URL, se hace en flush
}

function isUrlIndexed(url) {
    const history = loadHistory();
    return !!history.indexedUrls[url];
}

// Flush periodico del historial a disco (cada 10s si hay cambios)
let historyDirty = false;
let flushTimer = null;

function scheduleFlush() {
    historyDirty = true;
    if (!flushTimer) {
        flushTimer = setInterval(() => {
            if (historyDirty) {
                saveHistory();
                historyDirty = false;
            }
        }, 10000);
    }
}

// ============================================
// AUTENTICACION
// ============================================

let authClient = null;
let authBroken = false; // Si las credenciales son invalidas, no reintentar

function hasCredentials() {
    if (credentialsExist === null) {
        credentialsExist = fs.existsSync(CREDENTIALS_PATH);
    }
    return credentialsExist;
}

/**
 * Normalizar la private key para compatibilidad con OpenSSL 3.x (Node 18+).
 * Convierte PKCS#1 (BEGIN RSA PRIVATE KEY) a PKCS#8 (BEGIN PRIVATE KEY).
 */
function normalizePrivateKey(pem) {
    // Asegurar que los \n escapados sean newlines reales
    let key = pem.replace(/\\n/g, '\n');

    try {
        const keyObj = crypto.createPrivateKey({ key, format: 'pem' });
        return keyObj.export({ type: 'pkcs8', format: 'pem' });
    } catch (e) {
        // Si la conversion falla, devolver la key tal cual y dejar que GoogleAuth intente
        logger.warn('[GoogleIndexing] No se pudo normalizar la clave privada, usando formato original');
        return key;
    }
}

async function getAuthClient() {
    if (authClient) return authClient;

    if (!hasCredentials()) {
        throw new Error('Credenciales de Google Indexing no encontradas');
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

    // Normalizar private key para OpenSSL 3.x
    if (credentials.private_key) {
        credentials.private_key = normalizePrivateKey(credentials.private_key);
    }

    const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/indexing']
    });

    authClient = await auth.getClient();
    return authClient;
}

/**
 * Detectar si un error es de autenticacion/crypto (no retryable).
 */
function isAuthOrCryptoError(err) {
    if (err.response) return false; // Si hay response HTTP, no es error de auth local
    const msg = (err.message || '').toLowerCase();
    return msg.includes('decoder') ||
           msg.includes('unsupported') ||
           msg.includes('private key') ||
           msg.includes('credential') ||
           msg.includes('pem') ||
           msg.includes('asn1') ||
           msg.includes('sign');
}

// ============================================
// NOTIFICACION DE URLS
// ============================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Notificar a Google que una URL fue actualizada/creada.
 * Retorna { success, reason?, error?, data? }
 */
async function notifyUrlUpdated(url) {
    if (!hasCredentials()) {
        return { success: false, reason: 'no_credentials' };
    }

    if (authBroken) {
        return { success: false, reason: 'auth_error' };
    }

    if (quotaPausedUntil && Date.now() < quotaPausedUntil) {
        return { success: false, reason: 'quota_paused' };
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const client = await getAuthClient();
            const { token } = await client.getAccessToken();

            const response = await axios.post(
                INDEXING_API_URL,
                { url, type: 'URL_UPDATED' },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    timeout: 10000
                }
            );

            logger.info(`[GoogleIndexing] URL indexada: ${url}`);
            markUrlIndexed(url);
            scheduleFlush();

            return { success: true, data: response.data };
        } catch (err) {
            const status = err.response?.status;
            const errorMessage = err.response?.data?.error?.message || err.message;

            // Error de auth/crypto (ej: OpenSSL DECODER unsupported) - NO reintentar
            if (isAuthOrCryptoError(err)) {
                authClient = null; // Limpiar cliente roto
                authBroken = true; // No intentar mas hasta reiniciar
                logger.error(`[GoogleIndexing] Error de credenciales/crypto: ${errorMessage}`);
                logger.error('[GoogleIndexing] La clave privada del service account es incompatible con OpenSSL 3.x.');
                logger.error('[GoogleIndexing] Solucion: Descarga una nueva clave JSON desde Google Cloud Console,');
                logger.error('[GoogleIndexing] o inicia el servidor con: NODE_OPTIONS=--openssl-legacy-provider node src/server.js');
                return { success: false, reason: 'auth_error', error: errorMessage };
            }

            // Quota exceeded (429) - pausar 24h, no reintentar
            if (status === 429) {
                quotaPausedUntil = Date.now() + QUOTA_PAUSE_MS;
                logger.error(`[GoogleIndexing] Quota exceeded. Pausando hasta ${new Date(quotaPausedUntil).toISOString()}`);
                return { success: false, reason: 'quota_exceeded' };
            }

            // Error cliente (4xx distinto de 429) - no reintentar, es permanente
            if (status && status >= 400 && status < 500) {
                logger.error(`[GoogleIndexing] Error ${status} indexando ${url}: ${errorMessage}`);
                return { success: false, reason: 'client_error', error: errorMessage };
            }

            // Error de red (sin status) o servidor (5xx) - retry con backoff exponencial
            const delay = Math.pow(2, attempt) * 1000;
            logger.warn(`[GoogleIndexing] Error de red/servidor indexando ${url} (intento ${attempt}/${MAX_RETRIES}): ${errorMessage}`);

            if (attempt < MAX_RETRIES) {
                await sleep(delay);
                continue;
            }

            return { success: false, reason: 'network_error', error: errorMessage };
        }
    }
}

/**
 * Notificar un lote de URLs (en batches de BATCH_SIZE con delays).
 * Se detiene si hay quota exceeded.
 */
async function notifyBatchUrls(urls) {
    const results = { success: 0, failed: 0, skipped: 0, total: urls.length };
    let processed = 0;

    for (const url of urls) {
        // Verificar quota antes de cada request
        if (quotaPausedUntil && Date.now() < quotaPausedUntil) {
            results.skipped = urls.length - processed;
            logger.warn(`[GoogleIndexing] Batch pausado por quota. ${results.skipped} URLs omitidas.`);
            break;
        }

        // Saltar URLs ya indexadas
        if (isUrlIndexed(url)) {
            processed++;
            continue;
        }

        const result = await notifyUrlUpdated(url);
        processed++;

        if (result.success) {
            results.success++;
        } else if (result.reason === 'quota_exceeded' || result.reason === 'auth_error') {
            results.skipped = urls.length - processed;
            break;
        } else {
            results.failed++;
        }

        // Delay entre requests para no saturar la API
        if (processed < urls.length) {
            await sleep(BATCH_DELAY);
        }
    }

    // Flush historial a disco despues de cada batch
    saveHistory();

    logger.info(`[GoogleIndexing] Batch completado: ${results.success} exitosas, ${results.failed} fallidas, ${results.skipped} omitidas de ${results.total}`);
    return results;
}

// ============================================
// INDEXACION DE CAPITULO + CONTEXTO
// ============================================

/**
 * Al crear/publicar un capitulo, indexar:
 * 1. La URL del capitulo nuevo
 * 2. La URL de la serie (para que Google actualice la pagina de la serie)
 * 3. Capitulos vecinos de la misma serie que no se hayan indexado aun
 */
async function notifyChapterPublished(seriesSlug, chapterNumber) {
    if (!hasCredentials()) return;

    const urls = [];

    // URL del capitulo nuevo (prioridad)
    const chapterUrl = `${SITE_BASE}/manhwa/${seriesSlug}/capitulo/${chapterNumber}`;
    urls.push(chapterUrl);

    // URL de la serie (para que Google actualice la pagina con el nuevo capitulo)
    const seriesUrl = `${SITE_BASE}/manhwa/${seriesSlug}`;
    if (!isUrlIndexed(seriesUrl)) {
        urls.push(seriesUrl);
    }

    // Intentar indexar capitulos vecinos que no se hayan indexado
    const neighbors = [
        chapterNumber - 2,
        chapterNumber - 1,
        chapterNumber + 1
    ].filter(n => n > 0);

    for (const num of neighbors) {
        const neighborUrl = `${SITE_BASE}/manhwa/${seriesSlug}/capitulo/${num}`;
        if (!isUrlIndexed(neighborUrl)) {
            urls.push(neighborUrl);
        }
    }

    // Indexar todas en secuencia (fire-and-forget, no bloquear)
    for (const url of urls) {
        try {
            const result = await notifyUrlUpdated(url);
            if (result.reason === 'quota_exceeded' || result.reason === 'quota_paused' || result.reason === 'auth_error') {
                break; // No seguir si no hay quota o auth fallo
            }
            if (urls.indexOf(url) < urls.length - 1) {
                await sleep(500);
            }
        } catch (err) {
            logger.error(`[GoogleIndexing] Error en notifyChapterPublished para ${url}: ${err.message}`);
        }
    }

    saveHistory();
}

// ============================================
// DAEMON DE INDEXACION
// ============================================

/**
 * Parsear sitemap XML y extraer URLs.
 * Soporta sitemap index (con sub-sitemaps) y sitemap directo.
 */
async function fetchSitemapUrls() {
    try {
        const response = await axios.get(SITEMAP_URL, {
            timeout: 15000,
            headers: { 'User-Agent': 'ManhwaImperial-Indexer/1.0' }
        });
        const xml = response.data;

        // Verificar si es un sitemap index (contiene <sitemapindex>)
        if (xml.includes('<sitemapindex')) {
            return await parseSitemapIndex(xml);
        }

        // Sitemap directo
        return extractUrlsFromSitemap(xml);
    } catch (err) {
        logger.error(`[GoogleIndexing] Error fetching sitemap: ${err.message}`);
        return [];
    }
}

/**
 * Extraer URLs de sub-sitemaps referenciados en un sitemap index.
 */
async function parseSitemapIndex(xml) {
    const urls = [];
    const locRegex = /<sitemap>[^]*?<loc>\s*(.*?)\s*<\/loc>[^]*?<\/sitemap>/g;
    let match;

    while ((match = locRegex.exec(xml)) !== null) {
        const sitemapUrl = match[1].trim();
        try {
            const subResponse = await axios.get(sitemapUrl, {
                timeout: 15000,
                headers: { 'User-Agent': 'ManhwaImperial-Indexer/1.0' }
            });
            const subUrls = extractUrlsFromSitemap(subResponse.data);
            urls.push(...subUrls);
        } catch (err) {
            logger.warn(`[GoogleIndexing] Error fetching sub-sitemap ${sitemapUrl}: ${err.message}`);
        }
    }

    return urls;
}

/**
 * Extraer todas las <loc> de un sitemap XML.
 */
function extractUrlsFromSitemap(xml) {
    const urls = [];
    const urlRegex = /<url>[^]*?<loc>\s*(.*?)\s*<\/loc>[^]*?<\/url>/g;
    let match;

    while ((match = urlRegex.exec(xml)) !== null) {
        const url = match[1].trim();
        if (url) urls.push(url);
    }

    return urls;
}

/**
 * Ejecutar ciclo del daemon: escanear sitemap y indexar URLs nuevas.
 */
async function runDaemonCycle() {
    logger.info('[GoogleIndexing] Daemon: iniciando ciclo de indexacion...');

    try {
        const sitemapUrls = await fetchSitemapUrls();
        if (sitemapUrls.length === 0) {
            logger.warn('[GoogleIndexing] Daemon: no se encontraron URLs en el sitemap');
            return;
        }

        logger.info(`[GoogleIndexing] Daemon: ${sitemapUrls.length} URLs en sitemap`);

        const newUrls = sitemapUrls.filter(url => !isUrlIndexed(url));

        if (newUrls.length === 0) {
            logger.info('[GoogleIndexing] Daemon: todas las URLs del sitemap ya estan indexadas');
        } else {
            logger.info(`[GoogleIndexing] Daemon: ${newUrls.length} URLs nuevas encontradas, indexando...`);
            await notifyBatchUrls(newUrls);
        }

        const history = loadHistory();
        history.lastDaemonRun = new Date().toISOString();
        saveHistory();
    } catch (err) {
        logger.error('[GoogleIndexing] Daemon: error en ciclo:', err.message);
    }
}

/**
 * Iniciar el daemon de indexacion periodica.
 */
function startIndexingDaemon() {
    if (!hasCredentials()) {
        logger.warn('[GoogleIndexing] Credenciales no encontradas. Daemon de indexacion desactivado.');
        logger.warn(`[GoogleIndexing] Coloca las credenciales del service account en: ${CREDENTIALS_PATH}`);
        return;
    }

    // Pre-cargar historial en memoria
    loadHistory();

    logger.info(`[GoogleIndexing] Daemon iniciado. Intervalo: ${DAEMON_INTERVAL / 3600000}h`);

    // Primer ciclo despues de 30s (dar tiempo al servidor para estabilizarse)
    initialDelayTimer = setTimeout(() => {
        initialDelayTimer = null;
        runDaemonCycle();
    }, 30000);

    // Ciclos periodicos
    daemonTimer = setInterval(() => {
        runDaemonCycle();
    }, DAEMON_INTERVAL);
}

/**
 * Detener el daemon y limpiar recursos.
 */
function stopIndexingDaemon() {
    if (initialDelayTimer) {
        clearTimeout(initialDelayTimer);
        initialDelayTimer = null;
    }
    if (daemonTimer) {
        clearInterval(daemonTimer);
        daemonTimer = null;
    }
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    // Flush final del historial
    if (historyDirty) {
        saveHistory();
        historyDirty = false;
    }
    logger.info('[GoogleIndexing] Daemon detenido.');
}

module.exports = {
    notifyUrlUpdated,
    notifyBatchUrls,
    notifyChapterPublished,
    startIndexingDaemon,
    stopIndexingDaemon
};
